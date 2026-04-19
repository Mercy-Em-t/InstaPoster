'use strict';

const { Router } = require('express');
const multer = require('multer');
const postsController = require('../controllers/posts.controller');

const router = Router();

// multer — store uploads in memory; persist to cloud in controller
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per image
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

router.get('/', postsController.listPosts);
router.post('/', upload.array('images', 10), postsController.createPost);
router.get('/:id', postsController.getPost);
router.patch('/:id', postsController.updatePost);
router.delete('/:id', postsController.deletePost);
router.post('/:id/publish', postsController.publishPost);
router.post('/:id/schedule', postsController.schedulePost);

module.exports = router;
