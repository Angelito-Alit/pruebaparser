#!/usr/bin/env node
require('dotenv').config();
const mqtt = require('mqtt');
const fs = require('fs');

class IoTSimulator {
  constructor() {
    this.config = {
      brokerUrl: process.env.MQTT_BROKER_URL,
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      caPath: process.env.MQTT_CA_PATH || './emqxsl_ca.pem',
      topic: process.env.ALLOWED_TOPICS || 'IDGS10-Pruebas-Sensores'
    };

    this.client = null;
    this.isRunning = false;
    this.messageCount = 0;

    // Simulación de dispositivos ESP32
    this.devices = [
      {
        id: 'esp32-001',
        uuid: '550e8400-e29b-41d4-a716-446655440001',
        location: 'Sala Principal',
        tempRange: [20, 30],
        humidRange: [40, 80],
        version: '1.0.1'
      },
      {
        id: 'esp32-002',
        uuid: '550e8400-e29b-41d4-a716-446655440002',
        location: 'Cocina',
        tempRange: [22, 35],
        humidRange: [30, 70],
        version: '1.0.2'
      },
      {
        id: 'esp32-003',
        uuid: '550e8400-e29b-41d4-a716-446655440003',
        location: 'Dormitorio',
        tempRange: [18, 26],
        humidRange: [45, 75],
        version: '1.1.0'
      },
      {
        id: 'esp32-004',
        uuid: '550e8400-e29b-41d4-a716-446655440004',
        location: 'Garage',
        tempRange: [15, 40],
        humidRange: [20, 90],
        version: '1.0.1'
      }
    ];
  }

  async connect() {
    if (!fs.existsSync(this.config.caPath)) {
      throw new Error(`❌ CA file not found at ${this.config.caPath}`);
    }

    const ca = fs.readFileSync(this.config.caPath);

    console.log('🔌 Connecting to MQTT broker...');
    console.log(`📡 Broker: ${this.config.brokerUrl}`);
    console.log(`📤 Target topic: ${this.config.topic}`);

    this.client = mqtt.connect(this.config.brokerUrl, {
      username: this.config.username,
      password: this.config.password,
      ca: [ca],
      rejectUnauthorized: true
    });

    return new Promise((resolve, reject) => {
      this.client.on('connect', () => {
        console.log('✅ Connected to MQTT broker!');
        console.log(`🤖 Simulating ${this.devices.length} ESP32 devices\n`);
        resolve();
      });

      this.client.on('error', (err) => {
        console.error('❌ MQTT connection error:', err);
        reject(err);
      });
    });
  }

  generateValidMessage(device) {
    const timestamp = Math.floor(Date.now() / 1000);
    const temp = this.randomBetween(device.tempRange[0], device.tempRange[1]);
    const humidity = this.randomBetween(device.humidRange[0], device.humidRange[1]);

    // 70% formato pipe, 30% formato JSON
    if (Math.random() < 0.7) {
      // Formato pipe
      let message = `tt${timestamp}|uid${device.uuid}|t${temp.toFixed(1)}|h${humidity.toFixed(1)}`;

      // Agregar campos opcionales aleatoriamente
      if (Math.random() < 0.8) message += `|v${device.version}`;
      if (Math.random() < 0.3) message += `|a${Math.floor(Math.random() * 2)}`; // actuator 0 o 1

      return {
        format: 'pipe',
        message: message,
        device: device
      };
    } else {
      // Formato JSON
      const jsonData = {
        timestamp: timestamp,
        uuid: device.uuid,
        temperature: parseFloat(temp.toFixed(1)),
        humidity: parseFloat(humidity.toFixed(1)),
        version: device.version
      };

      // Agregar actuator ocasionalmente
      if (Math.random() < 0.3) {
        jsonData.actuator = Math.floor(Math.random() * 2).toString();
      }

      return {
        format: 'json',
        message: JSON.stringify(jsonData),
        device: device
      };
    }
  }

  generateInvalidMessage() {
    const invalidTypes = [
      // Mensajes completamente inválidos
      () => 'invalid_message_format',
      () => 'no|pipes|but|missing|required|fields',
      () => 'tt|uid|t|h', // Campos vacíos

      // JSON inválido
      () => '{"invalid": "json", "missing": "required_fields"}',
      () => '{"timestamp": "not_a_number", "uuid": "invalid_uuid"}',
      () => '{"malformed": json without closing brace',

      // Valores fuera de rango
      () => `tt${Math.floor(Date.now() / 1000)}|uid550e8400-e29b-41d4-a716-446655440099|t150.0|h50.0`, // Temp muy alta
      () => `tt${Math.floor(Date.now() / 1000)}|uid550e8400-e29b-41d4-a716-446655440099|t25.0|h150.0`, // Humidity muy alta
      () => `tt${Math.floor(Date.now() / 1000)}|uid550e8400-e29b-41d4-a716-446655440099|t-100.0|h50.0`, // Temp muy baja

      // UUID inválido
      () => `tt${Math.floor(Date.now() / 1000)}|uid123456|t25.0|h50.0`,
      () => `tt${Math.floor(Date.now() / 1000)}|uidinvalid-uuid-format|t25.0|h50.0`,

      // Timestamp futuro
      () => `tt${Math.floor(Date.now() / 1000) + 86400}|uid550e8400-e29b-41d4-a716-446655440099|t25.0|h50.0`,

      // Caracteres prohibidos
      () => `tt${Math.floor(Date.now() / 1000)}|uid550e8400-e29b-41d4-a716-446655440099|t 25.0|h50.0`, // Espacio en valor
      () => `tt${Math.floor(Date.now() / 1000)}|uid550e8400-e29b-41d4-a716-446655440099|t25.0|h50|extra`, // Pipe en valor
    ];

    const randomInvalid = invalidTypes[Math.floor(Math.random() * invalidTypes.length)];
    return {
      format: 'invalid',
      message: randomInvalid(),
      device: { id: 'corrupted-data', location: 'Unknown' }
    };
  }

  randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  async sendMessage(messageData) {
    return new Promise((resolve) => {
      this.client.publish(this.config.topic, messageData.message, (err) => {
        if (err) {
          console.error('❌ Failed to send message:', err);
        } else {
          this.messageCount++;
          const emoji = messageData.format === 'invalid' ? '💥' :
            messageData.format === 'json' ? '🎯' : '📦';

          console.log(`${emoji} [${this.messageCount.toString().padStart(3, '0')}] ${messageData.device.id} (${messageData.device.location || 'Unknown'})`);
          console.log(`    📤 ${messageData.message}`);
          console.log(`    📊 Format: ${messageData.format}\n`);
        }
        resolve();
      });
    });
  }

  async startSimulation(options = {}) {
    const {
      duration = 60, // segundos
      messageInterval = 5, // segundos entre mensajes
      invalidRate = 0.15 // 15% de mensajes inválidos
    } = options;

    console.log('🚀 Starting IoT Simulation...');
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📡 Message interval: ${messageInterval} seconds`);
    console.log(`❌ Invalid message rate: ${(invalidRate * 100).toFixed(1)}%`);
    console.log('='.repeat(50));

    this.isRunning = true;
    const startTime = Date.now();

    while (this.isRunning && (Date.now() - startTime) < duration * 1000) {
      // Decidir si enviar mensaje válido o inválido
      const sendInvalid = Math.random() < invalidRate;

      let messageData;
      if (sendInvalid) {
        messageData = this.generateInvalidMessage();
      } else {
        const randomDevice = this.devices[Math.floor(Math.random() * this.devices.length)];
        messageData = this.generateValidMessage(randomDevice);
      }

      await this.sendMessage(messageData);

      // Esperar antes del siguiente mensaje
      await new Promise(resolve => setTimeout(resolve, messageInterval * 1000));
    }

    console.log('\n🏁 Simulation completed!');
    console.log(`📊 Total messages sent: ${this.messageCount}`);
  }

  stop() {
    this.isRunning = false;
    if (this.client) {
      this.client.end();
      console.log('🔌 Disconnected from MQTT broker');
    }
  }
}

// Función principal
async function main() {
  const args = process.argv.slice(2);

  // Mostrar ayuda
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🤖 IoT Simulator - ESP32 Data Generator

Usage:
  node simulator.js [options]

Options:
  --duration <seconds>    Simulation duration (default: 60)
  --interval <seconds>    Message interval (default: 5)
  --invalid-rate <0-1>    Invalid message rate (default: 0.15)
  --continuous           Run continuously until Ctrl+C
  --burst                Send burst of messages quickly

Examples:
  node simulator.js                           # Default simulation
  node simulator.js --duration 120            # Run for 2 minutes
  node simulator.js --interval 2              # Send every 2 seconds
  node simulator.js --invalid-rate 0.3        # 30% invalid messages
  node simulator.js --continuous              # Run until stopped
  node simulator.js --burst                   # Quick burst mode
`);
    return;
  }

  const simulator = new IoTSimulator();

  // Configurar opciones
  const options = {};

  if (args.includes('--duration')) {
    options.duration = parseInt(args[args.indexOf('--duration') + 1]) || 60;
  }

  if (args.includes('--interval')) {
    options.messageInterval = parseInt(args[args.indexOf('--interval') + 1]) || 5;
  }

  if (args.includes('--invalid-rate')) {
    options.invalidRate = parseFloat(args[args.indexOf('--invalid-rate') + 1]) || 0.15;
  }

  if (args.includes('--continuous')) {
    options.duration = 86400; // 24 horas
  }

  if (args.includes('--burst')) {
    options.duration = 30;
    options.messageInterval = 1;
    options.invalidRate = 0.2;
  }

  // Manejar Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping simulation...');
    simulator.stop();
    process.exit(0);
  });

  try {
    await simulator.connect();
    await simulator.startSimulation(options);
    simulator.stop();
  } catch (error) {
    console.error('💥 Simulation failed:', error.message);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = IoTSimulator;
