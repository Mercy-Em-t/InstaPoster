'use strict';

/**
 * BullMQ Queue Manager
 *
 * Queues:
 *   - post-publisher    : publishes scheduled Instagram carousels
 *   - payment-monitor   : times out pending M-Pesa payments
 *   - payment-retry     : retries failed STK pushes (limited attempts)
 *   - analytics         : aggregates click & conversion metrics
 */

const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const { logInfo, logError, logQueueFailure } = require('../services/log.service');

let connection = null;
let queues = {};

function getRedisConnection() {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null, // required by BullMQ
    });
    connection.on('error', (err) => logError({
      message: '[Redis] Connection error',
      stack: err.stack,
      meta: { detail: err.message },
    }));
  }
  return connection;
}

const QUEUE_NAMES = {
  POST_PUBLISHER: 'post-publisher',
  PAYMENT_MONITOR: 'payment-monitor',
  PAYMENT_RETRY: 'payment-retry',
  ANALYTICS: 'analytics',
};

async function initQueues() {
  const conn = getRedisConnection();

  queues[QUEUE_NAMES.POST_PUBLISHER] = new Queue(QUEUE_NAMES.POST_PUBLISHER, { connection: conn });
  queues[QUEUE_NAMES.PAYMENT_MONITOR] = new Queue(QUEUE_NAMES.PAYMENT_MONITOR, { connection: conn });
  queues[QUEUE_NAMES.PAYMENT_RETRY] = new Queue(QUEUE_NAMES.PAYMENT_RETRY, { connection: conn });
  queues[QUEUE_NAMES.ANALYTICS] = new Queue(QUEUE_NAMES.ANALYTICS, { connection: conn });

  // Start recurring jobs
  await queues[QUEUE_NAMES.PAYMENT_MONITOR].add(
    'timeout-check',
    {},
    { repeat: { every: 2 * 60 * 1000 }, removeOnComplete: true } // every 2 minutes
  );

  await queues[QUEUE_NAMES.ANALYTICS].add(
    'aggregate',
    {},
    { repeat: { every: 60 * 60 * 1000 }, removeOnComplete: true } // every hour
  );

  startWorkers(conn);
  logInfo('BullMQ queues initialized');
}

function startWorkers(conn) {
  const { processPostPublish } = require('./postPublisher.job');
  const { processPaymentMonitor } = require('./paymentMonitor.job');
  const { processPaymentRetry } = require('./paymentRetry.job');
  const { processAnalytics } = require('./analytics.job');

  const workers = [
    new Worker(QUEUE_NAMES.POST_PUBLISHER, processPostPublish, { connection: conn, concurrency: 2 }),
    new Worker(QUEUE_NAMES.PAYMENT_MONITOR, processPaymentMonitor, { connection: conn }),
    new Worker(QUEUE_NAMES.PAYMENT_RETRY, processPaymentRetry, { connection: conn }),
    new Worker(QUEUE_NAMES.ANALYTICS, processAnalytics, { connection: conn }),
  ];

  workers.forEach((worker) => {
    worker.on('failed', (job, err) => {
      logQueueFailure({
        queue: worker.name,
        jobName: job?.name,
        jobId: job?.id,
        data: job?.data,
        error: err.message,
      });
    });
  });
}

/**
 * Enqueue a post to be published at a specific future time.
 *
 * @param {string} postId
 * @param {number} delayMs - milliseconds from now
 */
async function addPostPublishJob(postId, delayMs) {
  const queue = queues[QUEUE_NAMES.POST_PUBLISHER];
  if (!queue) throw new Error('Queues not initialized');

  await queue.add('publish', { postId }, {
    delay: delayMs,
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 }, // retry after 1min, 2min, 4min
    removeOnComplete: true,
    removeOnFail: 50,
  });
}

/**
 * Enqueue a payment retry job.
 *
 * @param {string} paymentId
 * @param {number} attempt - current attempt number
 */
async function addPaymentRetryJob(paymentId, attempt) {
  const queue = queues[QUEUE_NAMES.PAYMENT_RETRY];
  if (!queue) throw new Error('Queues not initialized');

  const delay = Math.pow(2, attempt) * 60000; // exponential: 2min, 4min, 8min
  await queue.add('retry', { paymentId, attempt }, {
    delay,
    removeOnComplete: true,
    removeOnFail: 20,
  });
}

module.exports = { initQueues, addPostPublishJob, addPaymentRetryJob, QUEUE_NAMES };
