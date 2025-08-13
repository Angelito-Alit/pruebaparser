#!/usr/bin/env node
require('dotenv').config();
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const fs = require('fs');

async function setupInflux() {
  console.log('🚀 Setting up InfluxDB for IoT Parser\n');

  // Verificar configuración
  console.log('📋 Checking configuration...');
  
  const config = {
    url: process.env.INFLUX_URL,
    token: process.env.INFLUX_TOKEN,
    org: process.env.INFLUX_ORG,
    bucket: process.env.INFLUX_BUCKET
  };

  console.log(`   URL: ${config.url || '❌ Not set'}`);
  console.log(`   ORG: ${config.org || '❌ Not set'}`);
  console.log(`   BUCKET: ${config.bucket || '❌ Not set'}`);
  console.log(`   TOKEN: ${config.token ? '✅ Set' : '❌ Not set'}`);

  if (!config.url || !config.token || !config.org || !config.bucket) {
    console.log('\n❌ Missing required environment variables in .env file');
    console.log('\n📝 Required variables:');
    console.log('INFLUX_URL=http://localhost:8086');
    console.log('INFLUX_TOKEN=your-token-here');
    console.log('INFLUX_ORG=iot-org');
    console.log('INFLUX_BUCKET=iot-data');
    return;
  }

  try {
    // Crear cliente InfluxDB
    const influxDB = new InfluxDB({
      url: config.url,
      token: config.token
    });

    console.log('\n🔗 Testing InfluxDB connection...');

    // Test de conexión
    const queryApi = influxDB.getQueryApi(config.org);
    const testQuery = `from(bucket: "${config.bucket}") |> range(start: -1s) |> limit(n: 1)`;
    
    await new Promise((resolve, reject) => {
      queryApi.queryRows(testQuery, {
        next() {},
        error(error) {
          if (error.message.includes('bucket') && error.message.includes('not found')) {
            console.log('⚠️  Bucket might not exist, but connection is OK');
            resolve();
          } else {
            reject(error);
          }
        },
        complete() {
          resolve();
        }
      });
    });

    console.log('✅ InfluxDB connection successful!');

    // Escribir datos de prueba
    console.log('\n✍️  Writing test data...');
    
    const writeApi = influxDB.getWriteApi(config.org, config.bucket);
    
    // Generar varios puntos de prueba
    const testDevices = [
      {
        uuid: '550e8400-e29b-41d4-a716-446655440001',
        location: 'test-device-1'
      },
      {
        uuid: '550e8400-e29b-41d4-a716-446655440002', 
        location: 'test-device-2'
      }
    ];

    const now = Date.now();
    
    testDevices.forEach((device, index) => {
      for (let i = 0; i < 5; i++) {
        const timestamp = new Date(now - (i * 60000)); // Cada minuto hacia atrás
        const temperature = 20 + Math.random() * 10; // 20-30°C
        const humidity = 40 + Math.random() * 40; // 40-80%
        
        const point = new Point('iot_telemetry')
          .tag('device_uuid', device.uuid)
          .tag('topic', 'test-topic')
          .tag('format', 'test')
          .tag('version', '1.0.0')
          .tag('location', device.location)
          .intField('timestamp', Math.floor(timestamp.getTime() / 1000))
          .floatField('temperature', parseFloat(temperature.toFixed(1)))
          .floatField('humidity', parseFloat(humidity.toFixed(1)))
          .stringField('actuator', Math.random() > 0.5 ? '1' : '0')
          .intField('processing_time_ms', Math.floor(Math.random() * 10))
          .timestamp(timestamp);

        writeApi.writePoint(point);
      }
    });

    await writeApi.close();
    console.log(`✅ Written ${testDevices.length * 5} test data points`);

    // Verificar que los datos se escribieron
    console.log('\n🔍 Verifying written data...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos

    const verifyQuery = `
      from(bucket: "${config.bucket}")
        |> range(start: -1h)
        |> filter(fn: (r) => r._measurement == "iot_telemetry")
        |> filter(fn: (r) => r.location == "test-device-1" or r.location == "test-device-2")
        |> count()
    `;

    let recordCount = 0;
    await new Promise((resolve, reject) => {
      queryApi.queryRows(verifyQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          recordCount += record._value || 0;
        },
        error(error) {
          reject(error);
        },
        complete() {
          resolve();
        }
      });
    });

    console.log(`✅ Found ${recordCount} test records in database`);

    // Crear archivos de ayuda
    console.log('\n📝 Creating helper scripts...');
    
    // Script para NPM
    const packageJsonPath = './package.json';
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Añadir scripts para InfluxDB
      packageJson.scripts = {
        ...packageJson.scripts,
        'influx:check': 'node check-influx.js recent',
        'influx:live': 'node check-influx.js live',
        'influx:stats': 'node check-influx.js stats',
        'influx:test': 'node check-influx.js test'
      };
      
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log('✅ Added InfluxDB scripts to package.json');
    }

    // Mostrar resumen
    console.log('\n🎉 InfluxDB Setup Complete!');
    console.log('\n📊 Available commands:');
    console.log('   npm run influx:check    # View recent data');
    console.log('   npm run influx:live     # Live data monitor');  
    console.log('   npm run influx:stats    # Show statistics');
    console.log('   npm run influx:test     # Test connection');
    console.log('\n🚀 Now you can:');
    console.log('   1. Start the parser: npm start');
    console.log('   2. Run simulator: npm run simulate:burst');
    console.log('   3. Check data: npm run influx:check');
    console.log('   4. Monitor live: npm run influx:live');

    console.log('\n📈 Test data summary:');
    console.log(`   • ${testDevices.length} test devices`);
    console.log(`   • ${testDevices.length * 5} data points`);
    console.log(`   • Temperature range: 20-30°C`);
    console.log(`   • Humidity range: 40-80%`);
    console.log(`   • Time span: Last 5 minutes`);

  } catch (error) {
    console.log('\n💥 Setup failed!');
    console.log(`❌ Error: ${error.message}`);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n🔧 InfluxDB connection failed:');
      console.log('   1. Is InfluxDB running? Check: systemctl status influxdb');
      console.log('   2. Is it listening on port 8086?');
      console.log('   3. Try: sudo systemctl start influxdb');
    } else if (error.message.includes('unauthorized')) {
      console.log('\n🔧 Authentication failed:');
      console.log('   1. Check your INFLUX_TOKEN in .env');
      console.log('   2. Create a new token in InfluxDB UI with read/write permissions');
    } else if (error.message.includes('bucket')) {
      console.log('\n🔧 Bucket issue:');
      console.log('   1. Create bucket "iot-data" in InfluxDB UI');
      console.log('   2. Verify bucket name in INFLUX_BUCKET variable');
    }
    
    process.exit(1);
  }
}

// Ejecutar setup
if (require.main === module) {
  setupInflux().catch(console.error);
}

module.exports = { setupInflux };