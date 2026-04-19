'use strict';

const prisma = require('../../db/prisma');
const instagramService = require('../../services/instagram.service');
const { addPostPublishJob } = require('../../jobs/queue');
const { createError } = require('../../middleware/errorHandler');
const { nanoid } = require('nanoid');

/**
 * GET /api/posts
 * List all posts with pagination.
 */
async function listPosts(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const status = req.query.status; // optional filter

    const where = status ? { status } : {};

    const [posts, total] = await Promise.all([
      prisma.contentPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          slides: { orderBy: { slideOrder: 'asc' } },
          contentProducts: true,
          trackingLinks: true,
        },
      }),
      prisma.contentPost.count({ where }),
    ]);

    res.json({ data: posts, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/posts
 * Create a new carousel post (with optional image uploads and linked products).
 *
 * Body (multipart/form-data):
 *   title, caption, scheduledAt?, images (files), products (JSON array)
 */
async function createPost(req, res, next) {
  try {
    const { title, caption, scheduledAt, products: productsJson } = req.body;

    if (!title || !caption) {
      return next(createError(400, 'title and caption are required'));
    }

    // In production, upload req.files to cloud storage and return URLs.
    // Here we accept image URLs passed as JSON array in the 'imageUrls' field,
    // or build placeholder URLs from uploaded file names.
    let imageUrls = [];
    if (req.body.imageUrls) {
      imageUrls = JSON.parse(req.body.imageUrls);
    } else if (req.files && req.files.length > 0) {
      // Placeholder: replace with actual cloud upload logic
      imageUrls = req.files.map(
        (f, i) => `https://cdn.yourdomain.com/uploads/${Date.now()}_${i}_${f.originalname}`
      );
    }

    const linkedProducts = productsJson ? JSON.parse(productsJson) : [];

    const post = await prisma.contentPost.create({
      data: {
        title,
        caption,
        status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        slides: {
          create: imageUrls.map((url, index) => ({
            imageUrl: url,
            slideOrder: index + 1,
          })),
        },
        contentProducts: {
          create: linkedProducts.map((p) => ({
            productId: p.productId,
            productSource: p.productSource || 'main_store',
          })),
        },
        trackingLinks: {
          create: {
            code: nanoid(8),
          },
        },
      },
      include: { slides: true, contentProducts: true, trackingLinks: true },
    });

    // If scheduled, enqueue the publish job
    if (scheduledAt) {
      const delay = new Date(scheduledAt).getTime() - Date.now();
      if (delay > 0) {
        await addPostPublishJob(post.id, delay);
      }
    }

    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/posts/:id
 */
async function getPost(req, res, next) {
  try {
    const post = await prisma.contentPost.findUnique({
      where: { id: req.params.id },
      include: {
        slides: { orderBy: { slideOrder: 'asc' } },
        contentProducts: true,
        trackingLinks: true,
      },
    });

    if (!post) return next(createError(404, 'Post not found'));
    res.json(post);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/posts/:id
 * Update title, caption, or status.
 */
async function updatePost(req, res, next) {
  try {
    const { title, caption, scheduledAt, status } = req.body;

    const post = await prisma.contentPost.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(caption && { caption }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
        ...(status && { status }),
      },
    });

    res.json(post);
  } catch (err) {
    if (err.code === 'P2025') return next(createError(404, 'Post not found'));
    next(err);
  }
}

/**
 * DELETE /api/posts/:id
 */
async function deletePost(req, res, next) {
  try {
    await prisma.contentPost.delete({ where: { id: req.params.id } });
    res.json({ message: 'Post deleted' });
  } catch (err) {
    if (err.code === 'P2025') return next(createError(404, 'Post not found'));
    next(err);
  }
}

/**
 * POST /api/posts/:id/publish
 * Immediately publish a post to Instagram.
 */
async function publishPost(req, res, next) {
  try {
    const post = await prisma.contentPost.findUnique({
      where: { id: req.params.id },
      include: { slides: { orderBy: { slideOrder: 'asc' } } },
    });

    if (!post) return next(createError(404, 'Post not found'));
    if (post.status === 'POSTED') return next(createError(409, 'Post already published'));
    if (post.slides.length < 2) return next(createError(400, 'A carousel needs at least 2 slides'));

    const imageUrls = post.slides.map((s) => s.imageUrl);
    const instagramPostId = await instagramService.publishCarousel({
      imageUrls,
      caption: post.caption,
    });

    const updated = await prisma.contentPost.update({
      where: { id: post.id },
      data: { status: 'POSTED', postedAt: new Date(), instagramPostId },
    });

    res.json(updated);
  } catch (err) {
    // Mark post as FAILED if Instagram errors
    if (req.params.id) {
      await prisma.contentPost
        .update({ where: { id: req.params.id }, data: { status: 'FAILED' } })
        .catch(() => {});
    }
    next(err);
  }
}

/**
 * POST /api/posts/:id/schedule
 * Update or set the scheduled time for a post.
 */
async function schedulePost(req, res, next) {
  try {
    const { scheduledAt } = req.body;
    if (!scheduledAt) return next(createError(400, 'scheduledAt is required'));

    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
      return next(createError(400, 'scheduledAt must be in the future'));
    }

    const post = await prisma.contentPost.update({
      where: { id: req.params.id },
      data: { status: 'SCHEDULED', scheduledAt: scheduledDate },
    });

    const delay = scheduledDate.getTime() - Date.now();
    await addPostPublishJob(post.id, delay);

    res.json(post);
  } catch (err) {
    if (err.code === 'P2025') return next(createError(404, 'Post not found'));
    next(err);
  }
}

module.exports = { listPosts, createPost, getPost, updatePost, deletePost, publishPost, schedulePost };
