'use strict';

const fs = require('fs');
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
const logDir = path.resolve(process.cwd(), 'logs');

function ensureLogDir() {
  if (!isProd) return;
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

function toLine(level, payload) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    ...payload,
  };

  try {
    return JSON.stringify(entry);
  } catch (_err) {
    return JSON.stringify({
      ts: entry.ts,
      level,
      message: 'Failed to serialize log payload',
    });
  }
}

function write(level, payload = {}) {
  const line = toLine(level, payload);

  if (!isTest) {
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }

  if (isProd) {
    ensureLogDir();
    const file = path.join(logDir, `${level}.log`);
    fs.appendFile(file, `${line}\n`, () => {});
  }
}

const logger = {
  info(payload) {
    write('info', payload);
  },
  warn(payload) {
    write('warn', payload);
  },
  error(payload) {
    write('error', payload);
  },
};

module.exports = { logger };
