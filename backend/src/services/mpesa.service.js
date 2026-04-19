'use strict';

/**
 * M-Pesa Daraja API Service — STK Push (Lipa Na M-Pesa Online)
 *
 * Flow:
 *  1. generateToken()       — get Bearer token from Safaricom OAuth
 *  2. initiateSTKPush()     — trigger payment prompt on customer's phone
 *  3. parseCallback()       — validate & extract data from Safaricom callback
 *
 * Environment variables required:
 *   MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET
 *   MPESA_SHORTCODE, MPESA_PASSKEY
 *   MPESA_CALLBACK_URL
 *   MPESA_ENV  ("sandbox" | "production")
 *
 * Docs: https://developer.safaricom.co.ke/APIs/MpesaExpressSimulate
 */

const axios = require('axios');
const { AppError } = require('../utils/AppError');

const SANDBOX_BASE = 'https://sandbox.safaricom.co.ke';
const PROD_BASE = 'https://api.safaricom.co.ke';

function getBase() {
  return process.env.MPESA_ENV === 'production' ? PROD_BASE : SANDBOX_BASE;
}

/**
 * Generate an OAuth access token from Safaricom.
 * Tokens expire after ~1 hour; in production, cache this.
 *
 * @returns {Promise<string>} Bearer token
 */
async function generateToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;

  if (!key || !secret) {
    throw new AppError('MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET must be set', 500, {
      service: 'mpesa',
      stage: 'generateToken',
    });
  }

  const credentials = Buffer.from(`${key}:${secret}`).toString('base64');

  let data;
  try {
    ({ data } = await axios.get(`${getBase()}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${credentials}` },
    }));
  } catch (err) {
    throw new AppError('M-Pesa OAuth token request failed', 502, {
      service: 'mpesa',
      stage: 'generateToken',
      detail: err.response?.data || err.message,
    });
  }

  if (!data.access_token) {
    throw new AppError('M-Pesa token generation failed', 502, {
      service: 'mpesa',
      stage: 'generateToken',
      detail: data,
    });
  }

  return data.access_token;
}

/**
 * Build the Base64-encoded password used in STK push requests.
 * Format: Base64(Shortcode + Passkey + Timestamp)
 *
 * @returns {{ password: string, timestamp: string }}
 */
function buildPassword() {
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;

  if (!shortcode || !passkey) {
    throw new AppError('MPESA_SHORTCODE and MPESA_PASSKEY must be set', 500, {
      service: 'mpesa',
      stage: 'buildPassword',
    });
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14);

  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  return { password, timestamp };
}

/**
 * Initiate an STK Push (Lipa Na M-Pesa Online).
 * Sends a payment request to the customer's phone.
 *
 * @param {{ phone: string, amount: number, orderId: string, description?: string }} params
 * @returns {Promise<{ checkoutRequestId: string, merchantRequestId: string, responseCode: string }>}
 */
async function initiateSTKPush({ phone, amount, orderId, description = 'InstaPoster Order' }) {
  const shortcode = process.env.MPESA_SHORTCODE;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;

  if (!shortcode) throw new AppError('MPESA_SHORTCODE is not set', 500, { service: 'mpesa', stage: 'initiateSTKPush' });
  if (!callbackUrl) throw new AppError('MPESA_CALLBACK_URL is not set', 500, { service: 'mpesa', stage: 'initiateSTKPush' });

  // Normalize phone: must be in format 2547XXXXXXXX
  const normalizedPhone = normalizePhone(phone);

  const token = await generateToken();
  const { password, timestamp } = buildPassword();

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.ceil(amount), // M-Pesa requires whole numbers
    PartyA: normalizedPhone,
    PartyB: shortcode,
    PhoneNumber: normalizedPhone,
    CallBackURL: callbackUrl,
    AccountReference: `ORDER-${orderId}`,
    TransactionDesc: description,
  };

  let data;
  try {
    ({ data } = await axios.post(
      `${getBase()}/mpesa/stkpush/v1/processrequest`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    ));
  } catch (err) {
    throw new AppError('M-Pesa STK push request failed', 502, {
      service: 'mpesa',
      stage: 'initiateSTKPush',
      orderId,
      detail: err.response?.data || err.message,
    });
  }

  if (data.ResponseCode !== '0') {
    throw new AppError('STK Push failed', 502, {
      service: 'mpesa',
      stage: 'initiateSTKPush',
      orderId,
      detail: data.ResponseDescription || data,
    });
  }

  return {
    checkoutRequestId: data.CheckoutRequestID,
    merchantRequestId: data.MerchantRequestID,
    responseCode: data.ResponseCode,
  };
}

/**
 * Parse and validate a Safaricom STK callback payload.
 *
 * @param {object} body - Raw callback body from Safaricom
 * @returns {{ success: boolean, checkoutRequestId: string, receiptNumber?: string, amount?: number, resultCode: number, resultDesc: string }}
 */
function parseCallback(body) {
  const callback = body?.Body?.stkCallback;
  if (!callback) {
    throw new AppError('Invalid M-Pesa callback body structure', 400, {
      service: 'mpesa',
      stage: 'parseCallback',
    });
  }

  const resultCode = callback.ResultCode;
  const resultDesc = callback.ResultDesc;
  const checkoutRequestId = callback.CheckoutRequestID;
  const success = resultCode === 0;

  let receiptNumber = null;
  let amount = null;

  if (success && callback.CallbackMetadata?.Item) {
    const items = callback.CallbackMetadata.Item;
    receiptNumber = findMetaItem(items, 'MpesaReceiptNumber');
    amount = findMetaItem(items, 'Amount');
  }

  return { success, checkoutRequestId, receiptNumber, amount, resultCode, resultDesc };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function normalizePhone(phone) {
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('0')) return `254${cleaned.slice(1)}`;
  if (cleaned.startsWith('254')) return cleaned;
  if (cleaned.startsWith('+254')) return cleaned.slice(1);
  throw new AppError('Cannot normalize phone number', 400, {
    service: 'mpesa',
    stage: 'normalizePhone',
    phone,
  });
}

function findMetaItem(items, name) {
  const found = items.find((i) => i.Name === name);
  return found ? found.Value : null;
}

module.exports = {
  generateToken,
  initiateSTKPush,
  parseCallback,
  normalizePhone,
};
