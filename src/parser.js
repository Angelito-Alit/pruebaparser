const mqtt = require('mqtt');
const fs = require('fs');
const EventEmitter = require('eventemitter3');
// const { Kafka } = require('kafkajs'); // Commented for future use
const { InfluxDB, Point } = require('@influxdata/influxdb-client'); // Commented for future use
const { Worker } = require('worker_threads');
const path = require('path');
const Logger = require('./utils/logger');
const config = require('../config/config');

class IotParser extends EventEmitter {
  constructor(customOptions = {}) {
    super();

    // Merge config with custom options (custom options override config)
    this.config = {
      mqtt: { ...config.mqtt, ...customOptions.mqtt },
      parser: { ...config.parser, ...customOptions.parser },
      validation: { ...config.validation, ...customOptions.validation },
      logging: { ...config.logging, ...customOptions.logging }
    };

    this.mqttClient = null;
    // this.kafkaProducer = null; // Future use
    // this.influxClient = null; // Future use
    this.workerPool = [];

    // Initialize logger
    this.logger = new Logger({
      logDir: this.config.parser.logDir,
      enableConsole: this.config.logging.enableConsole,
      enableFile: this.config.logging.enableFile,
      rotateDaily: this.config.logging.rotateDaily
    });

    // Track connection state
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;

    if (this.config.parser.useWorkers) {
      this.initWorkers(this.config.parser.numWorkers);
    }    // Future Kafka setup (commented)
    /*
    if (this.options.kafkaBrokers && this.options.kafkaClientId) {
      const kafka = new Kafka({
        clientId: this.options.kafkaClientId,
        brokers: this.options.kafkaBrokers
      });
      this.kafkaProducer = kafka.producer();
      this.kafkaProducer.connect().catch(err => 
        this.logger.error('Kafka connect error', err)
      );
    }
    */

    // Future Influx setup (commented)
    
     if (this.config.influxdb?.url && this.config.influxdb?.token) {
      this.influxClient = new InfluxDB({
        url: this.options.influxUrl,
        token: this.options.influxToken
      });
    }
    

    // Auto-save stats every 5 minutes
    if (this.config.parser.enableStats) {
      setInterval(() => {
        this.logger.saveStatsToFile();
      }, this.config.stats?.saveInterval || 5 * 60 * 1000);
    }
  }

  initWorkers(numWorkers) {
    this.logger.info(`Initializing ${numWorkers} worker threads`);

    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(path.join(__dirname, './parserWorker.js'));

      worker.on('message', (result) => {
        this.handleParsed(result);
      });

      worker.on('error', (error) => {
        this.logger.error(`Worker ${i} error`, error);
      });

      this.workerPool.push(worker);
    }
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.config.mqtt.caPath)) {
        const error = new Error(`CA file not found at ${this.config.mqtt.caPath}`);
        this.logger.error('CA file missing', { path: this.config.mqtt.caPath });
        return reject(error);
      }

      try {
        const ca = fs.readFileSync(this.config.mqtt.caPath);
        this.logger.info('Connecting to MQTT broker', {
          url: this.config.mqtt.brokerUrl,
          topics: this.config.mqtt.topics.join(', ')
        });

        this.mqttClient = mqtt.connect(this.config.mqtt.brokerUrl, {
          username: this.config.mqtt.username,
          password: this.config.mqtt.password,
          ca: [ca],
          rejectUnauthorized: true,
          ...this.config.mqtt.options
        });

        this.mqttClient.on('connect', () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.logger.success('MQTT connected successfully');

          this.mqttClient.subscribe(this.config.mqtt.topics, (err) => {
            if (err) {
              this.logger.error('Subscribe error', err);
              reject(err);
            } else {
              this.logger.success(`Subscribed to topics: ${this.config.mqtt.topics.join(', ')}`);
              resolve();
            }
          });
        });

        this.mqttClient.on('error', (err) => {
          this.connected = false;
          this.logger.error('MQTT connection error', err);
          reject(err);
        });

        this.mqttClient.on('close', () => {
          this.connected = false;
          this.logger.warn('MQTT connection closed');
        });

        this.mqttClient.on('reconnect', () => {
          this.reconnectAttempts++;
          this.logger.info(`MQTT reconnection attempt ${this.reconnectAttempts}`);

          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error('Max reconnection attempts reached');
            this.mqttClient.end();
          }
        });

        this.mqttClient.on('message', (topic, message) => {
          this.handleMessage(topic, message);
        });

      } catch (error) {
        this.logger.error('Failed to initialize MQTT client', error);
        reject(error);
      }
    });
  }

  handleMessage(topic, message) {
    const str = message.toString().trim();
    const timestamp = new Date().toISOString();

    // Log the received message for debugging
    this.logger.info(`📨 Message received`, {
      topic,
      message: str,
      length: str.length,
      timestamp
    });

    // Display in console for real-time monitoring
    console.log(`\n📨 [${timestamp}] New message on ${topic}:`);
    console.log(`   Raw: ${str}`);

    if (this.config.parser.useWorkers && this.workerPool.length > 0) {
      // Distribute to worker for parallel processing
      const worker = this.workerPool.shift();
      worker.postMessage({ str, topic });
      this.workerPool.push(worker);
    } else {
      const result = this.parse(str, topic);
      this.handleParsed(result);
    }
  }

  parse(str, topic = 'unknown') {
    const startTime = Date.now();
    let data = { _topic: topic, _receivedAt: new Date().toISOString() };
    let valid = true;
    let validationErrors = [];
    let format = 'unknown';

    // Detect format: JSON or pipe
    if (str.trim().startsWith('{')) {
      // JSON format
      format = 'json';
      try {
        const jsonData = JSON.parse(str);

        // Validate required JSON fields
        if (!jsonData.uuid || !jsonData.timestamp) {
          validationErrors.push('Missing required fields (uuid or timestamp) in JSON');
          valid = false;
        }

        // Map JSON fields to our standard format
        if (jsonData.uuid) data.uuid = jsonData.uuid;
        if (jsonData.timestamp) data.timestamp = jsonData.timestamp;
        if (jsonData.temperature !== undefined) data.temperature = jsonData.temperature;
        if (jsonData.humidity !== undefined) data.humidity = jsonData.humidity;
        if (jsonData.version) data.version = jsonData.version;
        if (jsonData.actuator !== undefined) data.actuator = jsonData.actuator;

      } catch (error) {
        validationErrors.push(`Invalid JSON format: ${error.message}`);
        valid = false;
        format = 'invalid-json';
      }
    } else {
      // Pipe format
      format = 'pipe';
      const parts = str.split('|');

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

        // Validate based on key type
        switch (key) {
          case 'tt': // timestamp
            data.timestamp = parseInt(value, 10);
            if (isNaN(data.timestamp)) {
              validationErrors.push(`Invalid timestamp: ${value}`);
              valid = false;
            } else if (data.timestamp > Math.floor(Date.now() / 1000)) {
              validationErrors.push(`Future timestamp: ${value}`);
              valid = false;
            }
            break;

          case 't': // temperature
            data.temperature = parseFloat(value);
            if (isNaN(data.temperature)) {
              validationErrors.push(`Invalid temperature: ${value}`);
              valid = false;
            } else if (data.temperature < this.config.validation.temperature.min ||
              data.temperature > this.config.validation.temperature.max) {
              validationErrors.push(`Temperature out of range: ${value} (must be ${this.config.validation.temperature.min} to ${this.config.validation.temperature.max})`);
              valid = false;
            }
            break;

          case 'h': // humidity
            data.humidity = parseFloat(value);
            if (isNaN(data.humidity)) {
              validationErrors.push(`Invalid humidity: ${value}`);
              valid = false;
            } else if (data.humidity < this.config.validation.humidity.min ||
              data.humidity > this.config.validation.humidity.max) {
              validationErrors.push(`Humidity out of range: ${value} (must be ${this.config.validation.humidity.min} to ${this.config.validation.humidity.max})`);
              valid = false;
            }
            break;

          case 'a': // actuator
            data.actuator = value;
            if (!this.config.validation.actuator.format.test(value)) {
              validationErrors.push(`Invalid actuator format: ${value}`);
              valid = false;
            }
            break;

          case 'v': // version
            data.version = value;
            if (value.length === 0 || value.length > this.config.validation.version.maxLength) {
              validationErrors.push(`Invalid version: ${value}`);
              valid = false;
            }
            break;

          case 'uid': // uuid
            data.uuid = value;
            if (!this.config.validation.uuid.format.test(value)) {
              validationErrors.push(`Invalid UUID format: ${value}`);
              valid = false;
            }
            break;

          default:
            validationErrors.push(`Unknown key: ${key}`);
            valid = false;
        }
      }

      // Check for duplicate keys in pipe format
      const keys = parts.map(part => part.match(/^([a-z]+)/)?.[1]).filter(Boolean);
      if (new Set(keys).size !== keys.length) {
        validationErrors.push('Duplicate keys found');
        valid = false;
      }
    }

    // Validate common fields for both formats
    if (valid) {
      // Validate temperature if present
      if (data.temperature !== undefined) {
        if (data.temperature < this.config.validation.temperature.min ||
          data.temperature > this.config.validation.temperature.max) {
          validationErrors.push(`Temperature out of range: ${data.temperature} (must be ${this.config.validation.temperature.min} to ${this.config.validation.temperature.max})`);
          valid = false;
        }
      }

      // Validate humidity if present
      if (data.humidity !== undefined) {
        if (data.humidity < this.config.validation.humidity.min ||
          data.humidity > this.config.validation.humidity.max) {
          validationErrors.push(`Humidity out of range: ${data.humidity} (must be ${this.config.validation.humidity.min} to ${this.config.validation.humidity.max})`);
          valid = false;
        }
      }

      // Validate UUID if present
      if (data.uuid && !this.config.validation.uuid.format.test(data.uuid)) {
        validationErrors.push(`Invalid UUID format: ${data.uuid}`);
        valid = false;
      }

      // Check required fields
      if (!data.uuid || (!data.timestamp && !data.tt)) {
        validationErrors.push('Missing required fields (uuid or timestamp)');
        valid = false;
      }
    }

    const processingTime = Date.now() - startTime;

    return {
      valid,
      data,
      original: str,
      validationErrors,
      processingTime,
      topic,
      format
    };
  }

  handleParsed({ valid, data, original, validationErrors = [], processingTime = 0, topic = 'unknown', format = 'pipe' }) {
    if (valid) {
      this.logger.success('Message validated successfully', {
        uuid: data.uuid,
        temperature: data.temperature,
        humidity: data.humidity,
        format: format,
        processingTime: `${processingTime}ms`,
        topic
      });

      // Add format and processing time to data for display
      data._format = format;
      data._processingTime = processingTime;

      // Emit success event
      this.emit('data', data);

      // Future Kafka integration (commented)
      /*
      if (this.kafkaProducer) {
        this.kafkaProducer.send({
          topic: 'iot-parsed',
          messages: [{ 
            key: data.uuid,
            value: JSON.stringify(data) 
          }]
        }).catch(err => this.logger.error('Kafka send error', err));
      }
      */

      // Future Influx integration (commented)
      /*
      if (this.influxClient) {
        const writeApi = this.influxClient.getWriteApi(this.options.influxOrg, this.options.influxBucket);
        const point = new Point('iot_telemetry')
          .tag('uuid', data.uuid)
          .intField('timestamp', data.timestamp)
          .floatField('temperature', data.temperature || 0)
          .floatField('humidity', data.humidity || 0)
          .stringField('actuator', data.actuator || '')
          .stringField('version', data.version || '');
        writeApi.writePoint(point);
        writeApi.close().catch(err => this.logger.error('Influx write error', err));
      }
      */

    } else {
      this.logger.warn('Message validation failed', {
        original,
        errors: validationErrors,
        format: format,
        processingTime: `${processingTime}ms`,
        topic
      });

      // Emit error event with enhanced information
      this.emit('error', {
        message: 'Invalid data',
        original,
        validationErrors,
        format,
        processingTime,
        topic
      });
    }
  }

  getStats() {
    return this.logger.getStats();
  }

  isConnected() {
    return this.connected && this.mqttClient && this.mqttClient.connected;
  }

  disconnect() {
    this.logger.info('Disconnecting IoT Parser');

    if (this.mqttClient) {
      this.mqttClient.end();
    }

    // Future disconnections (commented)
    /*
    if (this.kafkaProducer) {
      this.kafkaProducer.disconnect();
    }
    */

    // Terminate workers
    this.workerPool.forEach(worker => worker.terminate());

    // Save final stats
    if (this.config.parser.enableStats) {
      this.logger.saveStatsToFile();
    }

    this.logger.info('IoT Parser disconnected');
  }
}

module.exports = IotParser;
