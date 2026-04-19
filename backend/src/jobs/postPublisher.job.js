'use strict';

/**
 * Post Publisher Job
 *
 * Triggered by BullMQ when a scheduled post's delay expires.
 * Publishes the carousel to Instagram via the Instagram Graph API.
 */

const prisma = require('../db/prisma');
const instagramService = require('../services/instagram.service');

/**
 * @param {import('bullmq').Job} job
 */
async function processPostPublish(job) {
  const { postId } = job.data;

  console.log(`[PostPublisher] Processing post ${postId}`);

  const post = await prisma.contentPost.findUnique({
    where: { id: postId },
    include: { slides: { orderBy: { slideOrder: 'asc' } } },
  });

  if (!post) {
    console.warn(`[PostPublisher] Post ${postId} not found — skipping`);
    return;
  }

  if (post.status === 'POSTED') {
    console.log(`[PostPublisher] Post ${postId} already published — skipping`);
    return;
  }

  if (post.slides.length < 2) {
    await prisma.contentPost.update({
      where: { id: postId },
      data: { status: 'FAILED' },
    });
    throw new Error(`Post ${postId} has fewer than 2 slides — cannot create carousel`);
  }

  const imageUrls = post.slides.map((s) => s.imageUrl);

  try {
    const instagramPostId = await instagramService.publishCarousel({
      imageUrls,
      caption: post.caption,
    });

    await prisma.contentPost.update({
      where: { id: postId },
      data: { status: 'POSTED', postedAt: new Date(), instagramPostId },
    });

    console.log(`[PostPublisher] Post ${postId} published → IG ID: ${instagramPostId}`);
  } catch (err) {
    await prisma.contentPost.update({
      where: { id: postId },
      data: { status: 'FAILED' },
    });
    console.error(`[PostPublisher] Post ${postId} failed:`, err.message);
    throw err; // rethrow so BullMQ can retry
  }
}

module.exports = { processPostPublish };
