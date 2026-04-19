'use strict';

require('dotenv').config();

const app = require('./app');
const { initQueues } = require('./jobs/queue');

const PORT = process.env.PORT || 3001;

async function main() {
  try {
    await initQueues();
    app.listen(PORT, () => {
      console.log(`[InstaPoster] Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    });
  } catch (err) {
    console.error('[InstaPoster] Failed to start server:', err);
    process.exit(1);
  }
}

main();
