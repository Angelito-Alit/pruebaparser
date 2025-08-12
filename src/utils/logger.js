const fs = require('fs');
const path = require('path');
const EventEmitter = require('eventemitter3');

class Logger extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      logDir: options.logDir || path.join(process.cwd(), 'logs'),
      enableConsole: options.enableConsole !== false,
      enableFile: options.enableFile !== false,
      rotateDaily: options.rotateDaily !== false,
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      ...options
    };

    this.stats = {
      totalMessages: 0,
      validMessages: 0,
      invalidMessages: 0,
      errors: 0,
      lastReset: new Date(),
      messagesByHour: {},
      validationRate: 0
    };

    this.ensureLogDir();
    this.currentLogFile = this.getLogFileName();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.options.logDir)) {
      fs.mkdirSync(this.options.logDir, { recursive: true });
    }
  }

  getLogFileName() {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.options.logDir, `iot-parser-${date}.log`);
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    // Console output
    if (this.options.enableConsole) {
      const colorCode = this.getColorCode(level);
      console.log(`${colorCode}[${timestamp}] ${level.toUpperCase()}: ${message}${'\x1b[0m'}`);
      if (data) console.log(data);
    }

    // File output
    if (this.options.enableFile) {
      // Check if we need to rotate the log file
      if (this.options.rotateDaily) {
        const newLogFile = this.getLogFileName();
        if (newLogFile !== this.currentLogFile) {
          this.currentLogFile = newLogFile;
        }
      }

      fs.appendFileSync(this.currentLogFile, logLine);
    }

    // Update statistics
    this.updateStats(level, data);

    // Emit event for real-time monitoring
    this.emit('log', logEntry);
  }

  getColorCode(level) {
    const colors = {
      error: '\x1b[31m',    // Red
      warn: '\x1b[33m',     // Yellow
      info: '\x1b[36m',     // Cyan
      debug: '\x1b[35m',    // Magenta
      success: '\x1b[32m'   // Green
    };
    return colors[level] || '\x1b[37m'; // White default
  }

  updateStats(level, data) {
    this.stats.totalMessages++;

    const hour = new Date().getHours();
    if (!this.stats.messagesByHour[hour]) {
      this.stats.messagesByHour[hour] = 0;
    }
    this.stats.messagesByHour[hour]++;

    switch (level) {
      case 'success':
        this.stats.validMessages++;
        break;
      case 'warn':
        this.stats.invalidMessages++;
        break;
      case 'error':
        this.stats.errors++;
        break;
    }

    this.stats.validationRate = this.stats.totalMessages > 0
      ? (this.stats.validMessages / this.stats.totalMessages * 100).toFixed(2)
      : 0;
  }

  info(message, data) {
    this.log('info', message, data);
  }

  success(message, data) {
    this.log('success', message, data);
  }

  warn(message, data) {
    this.log('warn', message, data);
  }

  error(message, data) {
    this.log('error', message, data);
  }

  debug(message, data) {
    this.log('debug', message, data);
  }

  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.lastReset.getTime()
    };
  }

  resetStats() {
    this.stats = {
      totalMessages: 0,
      validMessages: 0,
      invalidMessages: 0,
      errors: 0,
      lastReset: new Date(),
      messagesByHour: {},
      validationRate: 0
    };
  }

  saveStatsToFile() {
    const statsFile = path.join(this.options.logDir, `stats-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(statsFile, JSON.stringify(this.getStats(), null, 2));
  }
}

module.exports = Logger;
