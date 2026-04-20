'use strict';

/**
 * M-Pesa Service Unit Tests
 * Tests parsing and normalization logic without real API calls.
 */

const { normalizePhone, parseCallback } = require('../services/mpesa.service');

describe('mpesa.service', () => {
  describe('normalizePhone', () => {
    it('converts 07XXXXXXXX to 2547XXXXXXXX', () => {
      expect(normalizePhone('0712345678')).toBe('254712345678');
    });

    it('accepts 2547XXXXXXXX unchanged', () => {
      expect(normalizePhone('254712345678')).toBe('254712345678');
    });

    it('strips +254 prefix', () => {
      expect(normalizePhone('+254712345678')).toBe('254712345678');
    });

    it('throws on unrecognized format', () => {
      expect(() => normalizePhone('1234')).toThrow();
    });
  });

  describe('parseCallback', () => {
    const successBody = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'merchant-req-1',
          CheckoutRequestID: 'checkout-req-1',
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: 1500 },
              { Name: 'MpesaReceiptNumber', Value: 'ABC123XYZ' },
              { Name: 'TransactionDate', Value: 20231001120000 },
              { Name: 'PhoneNumber', Value: 254712345678 },
            ],
          },
        },
      },
    };

    const failureBody = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'merchant-req-2',
          CheckoutRequestID: 'checkout-req-2',
          ResultCode: 1032,
          ResultDesc: 'Request cancelled by user',
        },
      },
    };

    it('parses a successful callback correctly', () => {
      const result = parseCallback(successBody);
      expect(result.success).toBe(true);
      expect(result.checkoutRequestId).toBe('checkout-req-1');
      expect(result.receiptNumber).toBe('ABC123XYZ');
      expect(result.amount).toBe(1500);
      expect(result.resultCode).toBe(0);
    });

    it('parses a failed callback correctly', () => {
      const result = parseCallback(failureBody);
      expect(result.success).toBe(false);
      expect(result.checkoutRequestId).toBe('checkout-req-2');
      expect(result.receiptNumber).toBeNull();
      expect(result.resultCode).toBe(1032);
      expect(result.resultDesc).toBe('Request cancelled by user');
    });

    it('throws on malformed body', () => {
      expect(() => parseCallback({})).toThrow('Invalid M-Pesa callback body structure');
      expect(() => parseCallback({ Body: {} })).toThrow('Invalid M-Pesa callback body structure');
    });
  });
});
