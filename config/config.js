// Configuration template for IoT Parser
module.exports = {
  // MQTT Configuration
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtts://your-broker.com:8883',
    username: process.env.MQTT_USERNAME || 'your-username',
    password: process.env.MQTT_PASSWORD || 'your-password',
    caPath: process.env.MQTT_CA_PATH || './emqxsl_ca.pem',
    topics: (process.env.ALLOWED_TOPICS || 'IDGS10-Pruebas-Sensores').split(','),
    options: {
      reconnectPeriod: 5000,
      connectTimeout: 30000,
      keepalive: 60
    }
  },

  // Parser Configuration
  parser: {
    useWorkers: process.env.USE_WORKERS === 'true' || false,
    numWorkers: parseInt(process.env.NUM_WORKERS) || 4,
    enableStats: process.env.ENABLE_STATS !== 'false',
    logDir: process.env.LOG_DIR || './logs'
  },

  // Validation Rules
  validation: {
    temperature: {
      min: -40,
      max: 85,
      required: false
    },
    humidity: {
      min: 0,
      max: 100,
      required: false
    },
    timestamp: {
      required: true,
      allowFuture: false
    },
    uuid: {
      required: true,
      format: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    },
    actuator: {
      required: false,
      format: /^[a-z0-9]$/i
    },
    version: {
      required: false,
      maxLength: 20
    }
  },

  // Future integrations (commented for now)
  /*
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || 'iot-parser',
    brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092'],
    topics: {
      output: 'iot-parsed-data',
      errors: 'iot-validation-errors'
    }
  },

  influxdb: {
    url: process.env.INFLUX_URL || 'http://localhost:8086',
    token: process.env.INFLUX_TOKEN,
    org: process.env.INFLUX_ORG || 'your-org',
    bucket: process.env.INFLUX_BUCKET || 'iot-data',
    measurement: 'iot_telemetry'
  },
  */

  // Statistics and Reporting
  stats: {
    saveInterval: 5 * 60 * 1000, // 5 minutes
    reportInterval: 60 * 60 * 1000, // 1 hour
    retentionDays: 30
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: process.env.ENABLE_CONSOLE_LOG !== 'false',
    enableFile: process.env.ENABLE_FILE_LOG !== 'false',
    rotateDaily: process.env.ROTATE_DAILY !== 'false',
    maxFileSize: parseInt(process.env.MAX_LOG_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  }
};
