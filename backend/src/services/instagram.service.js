'use strict';

/**
 * Instagram Graph API Service
 *
 * Handles:
 *  - Uploading individual images as media containers
 *  - Creating carousel containers from multiple media containers
 *  - Publishing the carousel to the Instagram Business account
 *
 * Requirements:
 *  - Instagram Business Account connected to a Facebook Page
 *  - Meta App with instagram_content_publish permission
 *  - Long-lived access token stored in META_ACCESS_TOKEN env var
 *
 * Docs: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
 */

const axios = require('axios');
const { AppError } = require('../utils/AppError');

const BASE = 'https://graph.facebook.com/v19.0';

function getAccountId() {
  const id = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (!id) throw new AppError('INSTAGRAM_BUSINESS_ACCOUNT_ID is not set', 500, { service: 'instagram' });
  return id;
}

function getToken() {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new AppError('META_ACCESS_TOKEN is not set', 500, { service: 'instagram' });
  return token;
}

/**
 * Step 1: Create a single-image media container.
 * Returns a container ID that can be used in a carousel.
 *
 * @param {string} imageUrl - Publicly accessible image URL
 * @param {boolean} isCarouselItem - Must be true for carousel child items
 * @returns {Promise<string>} container ID
 */
async function createImageContainer(imageUrl, isCarouselItem = true) {
  const accountId = getAccountId();
  const token = getToken();

  const params = {
    image_url: imageUrl,
    access_token: token,
  };
  if (isCarouselItem) {
    params.is_carousel_item = true;
  }

  let data;
  try {
    ({ data } = await axios.post(`${BASE}/${accountId}/media`, params));
  } catch (err) {
    throw new AppError('Instagram image container request failed', 502, {
      service: 'instagram',
      stage: 'createImageContainer',
      detail: err.response?.data || err.message,
    });
  }
  if (!data.id) throw new AppError('Failed to create image container', 502, { service: 'instagram', detail: data });
  return data.id;
}

/**
 * Step 2: Create the carousel container from child container IDs.
 *
 * @param {string[]} childContainerIds - Array of individual image container IDs
 * @param {string} caption - Post caption
 * @returns {Promise<string>} carousel container ID
 */
async function createCarouselContainer(childContainerIds, caption) {
  const accountId = getAccountId();
  const token = getToken();

  if (childContainerIds.length < 2 || childContainerIds.length > 10) {
    throw new AppError('Carousel must have 2–10 images', 400, { service: 'instagram' });
  }

  let data;
  try {
    ({ data } = await axios.post(`${BASE}/${accountId}/media`, {
      media_type: 'CAROUSEL',
      children: childContainerIds.join(','),
      caption,
      access_token: token,
    }));
  } catch (err) {
    throw new AppError('Instagram carousel container request failed', 502, {
      service: 'instagram',
      stage: 'createCarouselContainer',
      detail: err.response?.data || err.message,
    });
  }

  if (!data.id) throw new AppError('Failed to create carousel container', 502, { service: 'instagram', detail: data });
  return data.id;
}

/**
 * Poll a media container status until it is FINISHED (ready to publish).
 * Instagram needs time to process uploaded images.
 *
 * @param {string} containerId
 * @param {number} maxAttempts
 * @returns {Promise<void>}
 */
async function waitForContainerReady(containerId, maxAttempts = 10) {
  const token = getToken();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(3000);
    let data;
    try {
      ({ data } = await axios.get(`${BASE}/${containerId}`, {
        params: { fields: 'status_code', access_token: token },
      }));
    } catch (err) {
      throw new AppError('Instagram container status check failed', 502, {
        service: 'instagram',
        stage: 'waitForContainerReady',
        containerId,
        detail: err.response?.data || err.message,
      });
    }

    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') {
      throw new AppError('Instagram container processing failed', 502, {
        service: 'instagram',
        stage: 'waitForContainerReady',
        containerId,
        status: data.status_code,
      });
    }
  }

  throw new AppError('Instagram container did not become ready in time', 504, {
    service: 'instagram',
    stage: 'waitForContainerReady',
    containerId,
    maxAttempts,
  });
}

/**
 * Step 3: Publish the carousel container.
 *
 * @param {string} carouselContainerId
 * @returns {Promise<string>} Instagram media ID of the published post
 */
async function publishContainer(carouselContainerId) {
  const accountId = getAccountId();
  const token = getToken();

  let data;
  try {
    ({ data } = await axios.post(`${BASE}/${accountId}/media_publish`, {
      creation_id: carouselContainerId,
      access_token: token,
    }));
  } catch (err) {
    throw new AppError('Instagram media publish request failed', 502, {
      service: 'instagram',
      stage: 'publishContainer',
      detail: err.response?.data || err.message,
    });
  }

  if (!data.id) throw new AppError('Failed to publish carousel', 502, { service: 'instagram', detail: data });
  return data.id;
}

/**
 * Full carousel publishing pipeline.
 *
 * @param {{ imageUrls: string[], caption: string }} options
 * @returns {Promise<string>} Instagram post ID
 */
async function publishCarousel({ imageUrls, caption }) {
  if (!imageUrls || imageUrls.length < 2) {
    throw new AppError('At least 2 images are required for a carousel', 400, { service: 'instagram' });
  }

  // 1. Upload each image as a carousel-item container
  const childIds = await Promise.all(
    imageUrls.map((url) => createImageContainer(url, true))
  );

  // 2. Wait for all containers to be ready
  await Promise.all(childIds.map((id) => waitForContainerReady(id)));

  // 3. Create carousel container
  const carouselId = await createCarouselContainer(childIds, caption);

  // 4. Wait for carousel container to be ready
  await waitForContainerReady(carouselId);

  // 5. Publish
  const instagramPostId = await publishContainer(carouselId);
  return instagramPostId;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  createImageContainer,
  createCarouselContainer,
  waitForContainerReady,
  publishContainer,
  publishCarousel,
};
