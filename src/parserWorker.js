const { parentPort } = require('worker_threads');
const config = require('../config/config');

// Enhanced worker for parsing with better error handling
parentPort.on('message', ({ str, topic = 'unknown' }) => {
  const startTime = Date.now();

  try {
    const result = parseMessage(str, topic);
    parentPort.postMessage(result);
  } catch (error) {
    parentPort.postMessage({
      valid: false,
      data: {},
      original: str,
      validationErrors: [`Worker error: ${error.message}`],
      processingTime: Date.now() - startTime,
      topic
    });
  }
});

function parseMessage(str, topic) {
  const startTime = Date.now();
  const parts = str.split('|');
  const data = { _topic: topic, _receivedAt: new Date().toISOString(), _workerId: process.pid };
  let valid = true;
  let validationErrors = [];

  // Basic format validation
  if (parts.length === 0) {
    validationErrors.push('Empty message');
    valid = false;
  }

  for (const part of parts) {
    if (!part) continue; // Skip empty parts

    const match = part.match(/^([a-z]+)(.*)$/);
    if (!match) {
      validationErrors.push(`Invalid format for part: ${part}`);
      valid = false;
      continue;
    }

    const key = match[1];
    const value = match[2];

    // Check for forbidden characters
    if (value.includes(' ') || value.includes('|')) {
      validationErrors.push(`Invalid characters in ${key}: ${value}`);
      valid = false;
      continue;
    }

    // Validate based on key type using centralized config
    switch (key) {
      case 'tt': // timestamp
        data.timestamp = parseInt(value, 10);
        if (isNaN(data.timestamp)) {
          validationErrors.push(`Invalid timestamp: ${value}`);
          valid = false;
        } else if (!config.validation.timestamp.allowFuture && data.timestamp > Math.floor(Date.now() / 1000)) {
          validationErrors.push(`Future timestamp: ${value}`);
          valid = false;
        }
        break;

      case 't': // temperature
        data.temperature = parseFloat(value);
        if (isNaN(data.temperature)) {
          validationErrors.push(`Invalid temperature: ${value}`);
          valid = false;
        } else if (data.temperature < config.validation.temperature.min ||
          data.temperature > config.validation.temperature.max) {
          validationErrors.push(`Temperature out of range: ${value} (must be ${config.validation.temperature.min} to ${config.validation.temperature.max})`);
          valid = false;
        }
        break;

      case 'h': // humidity
        data.humidity = parseFloat(value);
        if (isNaN(data.humidity)) {
          validationErrors.push(`Invalid humidity: ${value}`);
          valid = false;
        } else if (data.humidity < config.validation.humidity.min ||
          data.humidity > config.validation.humidity.max) {
          validationErrors.push(`Humidity out of range: ${value} (must be ${config.validation.humidity.min} to ${config.validation.humidity.max})`);
          valid = false;
        }
        break;

      case 'a': // actuator
        data.actuator = value;
        if (!config.validation.actuator.format.test(value)) {
          validationErrors.push(`Invalid actuator format: ${value}`);
          valid = false;
        }
        break;

      case 'v': // version
        data.version = value;
        if (value.length === 0 || value.length > config.validation.version.maxLength) {
          validationErrors.push(`Invalid version: ${value}`);
          valid = false;
        }
        break;

      case 'uid': // uuid
        data.uuid = value;
        if (!config.validation.uuid.format.test(value)) {
          validationErrors.push(`Invalid UUID format: ${value}`);
          valid = false;
        }
        break;

      default:
        validationErrors.push(`Unknown key: ${key}`);
        valid = false;
    }
  }

  // Check required fields
  if (config.validation.uuid.required && !data.uuid) {
    validationErrors.push('Missing required field: uuid');
    valid = false;
  }
  if (config.validation.timestamp.required && !data.timestamp) {
    validationErrors.push('Missing required field: timestamp');
    valid = false;
  }

  // Check for duplicate keys
  const keys = parts.map(part => part.match(/^([a-z]+)/)?.[1]).filter(Boolean);
  if (new Set(keys).size !== keys.length) {
    validationErrors.push('Duplicate keys found');
    valid = false;
  }

  const processingTime = Date.now() - startTime;

  return {
    valid,
    data,
    original: str,
    validationErrors,
    processingTime,
    topic
  };
}