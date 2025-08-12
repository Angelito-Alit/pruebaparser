#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const IoTSimulator = require('./simulator');

async function quickTest() {
  console.log('🧪 Quick Test - IoT Simulator\n');

  // Verificar variables de entorno
  console.log('📋 Environment Check:');
  console.log(`   MQTT_BROKER_URL: ${process.env.MQTT_BROKER_URL ? '✅' : '❌'}`);
  console.log(`   MQTT_USERNAME: ${process.env.MQTT_USERNAME ? '✅' : '❌'}`);
  console.log(`   MQTT_PASSWORD: ${process.env.MQTT_PASSWORD ? '✅' : '❌'}`);
  console.log(`   MQTT_CA_PATH: ${process.env.MQTT_CA_PATH ? '✅' : '❌'}`);
  console.log(`   CA File exists: ${fs.existsSync(process.env.MQTT_CA_PATH || './emqxsl_ca.pem') ? '✅' : '❌'}`);

  console.log('\n🎯 Test Messages:');

  const simulator = new IoTSimulator();

  // Generar algunos mensajes de ejemplo
  for (let i = 0; i < 3; i++) {
    const device = simulator.devices[i % simulator.devices.length];
    const validMsg = simulator.generateValidMessage(device);
    console.log(`\n📦 Valid Message ${i + 1} (${validMsg.format}):`);
    console.log(`   Device: ${validMsg.device.id} - ${validMsg.device.location}`);
    console.log(`   Data: ${validMsg.message}`);
  }

  console.log('\n💥 Invalid Message Examples:');
  for (let i = 0; i < 3; i++) {
    const invalidMsg = simulator.generateInvalidMessage();
    console.log(`\n❌ Invalid Message ${i + 1}:`);
    console.log(`   Data: ${invalidMsg.message}`);
  }

  console.log('\n🚀 Ready to simulate! Use these commands:');
  console.log('   npm run simulate              # Default 60s simulation');
  console.log('   npm run simulate:burst        # Quick burst test');
  console.log('   npm run simulate:continuous   # Run until Ctrl+C');
  console.log('   npm run help                  # Show all options');
}

quickTest().catch(console.error);
