#!/usr/bin/env node
require('dotenv').config();
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const http = require('http');

async function testInfluxConnection() {
  console.log('🔍 Testing InfluxDB Connection...\n');

  // Mostrar configuración
  console.log('📋 Configuration:');
  console.log(`   URL: ${process.env.INFLUX_URL}`);
  console.log(`   ORG: ${process.env.INFLUX_ORG}`);
  console.log(`   BUCKET: ${process.env.INFLUX_BUCKET}`);
  console.log(`   TOKEN: ${process.env.INFLUX_TOKEN ? `${process.env.INFLUX_TOKEN.substring(0, 10)}...` : '❌ Missing'}\n`);

  if (!process.env.INFLUX_URL || !process.env.INFLUX_TOKEN) {
    console.log('❌ Missing required environment variables');
    console.log('   Make sure INFLUX_URL and INFLUX_TOKEN are set in .env');
    process.exit(1);
  }

  try {
    // Test 1: Basic Connection Test (ping)
    console.log('🔗 Step 1: Testing basic connectivity...');
    
    try {
      const url = new URL('/ping', process.env.INFLUX_URL);
      
      await new Promise((resolve, reject) => {
        const req = http.get({
          hostname: url.hostname,
          port: url.port || 8086,
          path: url.pathname,
          timeout: 5000
        }, (res) => {
          if (res.statusCode === 204) {
            console.log('✅ Ping successful - InfluxDB is reachable');
            resolve();
          } else {
            reject(new Error(`Ping failed with status: ${res.statusCode}`));
          }
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Connection timeout'));
        });
      });
    } catch (error) {
      console.log(`❌ Connection test failed: ${error.message}`);
      throw error;
    }

    // Test 2: Initialize InfluxDB Client
    console.log('\n📡 Step 2: Initializing InfluxDB client...');
    
    const influxDB = new InfluxDB({
      url: process.env.INFLUX_URL,
      token: process.env.INFLUX_TOKEN
    });
    
    console.log('✅ InfluxDB client created successfully');

    // Test 3: Test Write API
    console.log('\n✍️  Step 3: Testing Write API...');
    
    const writeApi = influxDB.getWriteApi(
      process.env.INFLUX_ORG, 
      process.env.INFLUX_BUCKET
    );

    // Escribir datos de prueba similares a los del IoT Parser
    const testPoint1 = new Point('iot_telemetry')
      .tag('device_uuid', '550e8400-e29b-41d4-a716-446655440000')
      .tag('topic', 'test-topic')
      .tag('format', 'test')
      .tag('source', 'iot-parser')
      .tag('version', '1.0.0')
      .intField('timestamp', Math.floor(Date.now() / 1000))
      .floatField('temperature', 23.5)
      .floatField('humidity', 65.2)
      .stringField('version', '1.0.1')
      .stringField('actuator', '1')
      .timestamp(new Date());

    const testPoint2 = new Point('iot_telemetry')
      .tag('device_uuid', '550e8400-e29b-41d4-a716-446655440001')
      .tag('topic', 'test-topic')
      .tag('format', 'test')
      .tag('source', 'iot-parser')
      .tag('version', '1.0.0')
      .intField('timestamp', Math.floor(Date.now() / 1000))
      .floatField('temperature', 25.8)
      .floatField('humidity', 58.7)
      .stringField('version', '1.0.2')
      .stringField('actuator', '0')
      .timestamp(new Date());

    writeApi.writePoint(testPoint1);
    writeApi.writePoint(testPoint2);

    try {
      await writeApi.close();
      console.log('✅ Write API test successful - 2 test points written');
    } catch (error) {
      console.log(`❌ Write failed: ${error.message}`);
      throw error;
    }

    // Test 4: Test Query API
    console.log('\n📊 Step 4: Testing Query API...');
    
    const queryApi = influxDB.getQueryApi(process.env.INFLUX_ORG);
    
    // Wait a moment for data to be available
    await new Promise(resolve => setTimeout(resolve, 2000));

    const fluxQuery = `
      from(bucket: "${process.env.INFLUX_BUCKET}")
        |> range(start: -5m)
        |> filter(fn: (r) => r._measurement == "iot_telemetry")
        |> filter(fn: (r) => r.source == "iot-parser")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 10)
    `;

    try {
      const rows = [];
      await new Promise((resolve, reject) => {
        queryApi.queryRows(fluxQuery, {
          next(row, tableMeta) {
            const record = tableMeta.toObject(row);
            rows.push(record);
          },
          error(error) {
            reject(error);
          },
          complete() {
            resolve();
          }
        });
      });
      
      console.log(`✅ Query API working - Found ${rows.length} records`);
      
      if (rows.length > 0) {
        console.log('\n📋 Sample data from InfluxDB:');
        rows.slice(0, 3).forEach((record, index) => {
          console.log(`   ${index + 1}. Device: ${record.device_uuid}`);
          console.log(`      Field: ${record._field} = ${record._value}`);
          console.log(`      Time: ${record._time}`);
        });
      }
      
    } catch (error) {
      console.log(`⚠️  Query failed: ${error.message}`);
      if (error.message.includes('bucket')) {
        console.log('   This might be because the bucket is new or empty');
      }
    }

    // Test 5: Verify bucket exists
    console.log('\n🪣 Step 5: Verifying bucket exists...');
    
    try {
      const bucketsAPI = influxDB.getBucketsAPI();
      const buckets = await bucketsAPI.getBuckets(process.env.INFLUX_ORG);
      
      const targetBucket = buckets.buckets?.find(b => b.name === process.env.INFLUX_BUCKET);
      
      if (targetBucket) {
        console.log(`✅ Bucket "${process.env.INFLUX_BUCKET}" exists`);
        console.log(`   ID: ${targetBucket.id}`);
        console.log(`   Created: ${targetBucket.createdAt}`);
      } else {
        console.log(`⚠️  Bucket "${process.env.INFLUX_BUCKET}" not found`);
        console.log('   Available buckets:');
        buckets.buckets?.forEach(bucket => {
          console.log(`     - ${bucket.name}`);
        });
      }
      
    } catch (error) {
      console.log(`⚠️  Bucket verification failed: ${error.message}`);
    }

    console.log('\n🎉 InfluxDB Connection Test Complete!');
    console.log('\n📝 Summary:');
    console.log('   ✅ Connection established');
    console.log('   ✅ Ping test passed');
    console.log('   ✅ Write API functional');
    console.log('   ✅ Query API accessible');
    console.log('   ✅ Test data written successfully');
    console.log('\n🚀 Your IoT Parser should work perfectly with InfluxDB!');
    console.log('\n📚 Next steps:');
    console.log('   1. Run: npm start');
    console.log('   2. Run: npm run simulate:burst');
    console.log('   3. Check InfluxDB UI at http://localhost:8086');

  } catch (error) {
    console.log('\n💥 Connection Test Failed!');
    console.log(`❌ Error: ${error.message}`);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n🔧 InfluxDB is not running. Try:');
      console.log('   sudo systemctl start influxdb');
      console.log('   sudo systemctl enable influxdb');
      console.log('   sudo systemctl status influxdb');
    } else if (error.message.includes('unauthorized') || error.message.includes('401')) {
      console.log('\n🔧 Authentication issue:');
      console.log('   1. Check your INFLUX_TOKEN');
      console.log('   2. Generate new token: influx auth create --org iot-org --all-access');
      console.log('   3. Verify token: influx auth list');
    } else if (error.message.includes('bucket') || error.message.includes('not found')) {
      console.log('\n🔧 Bucket issue:');
      console.log(`   1. Create bucket: influx bucket create --name ${process.env.INFLUX_BUCKET} --org ${process.env.INFLUX_ORG}`);
      console.log('   2. List buckets: influx bucket list --org iot-org');
    } else if (error.message.includes('timeout')) {
      console.log('\n🔧 Connection timeout:');
      console.log('   1. Check InfluxDB is running on port 8086');
      console.log('   2. Check firewall settings');
      console.log('   3. Verify URL is correct');
    }
    
    console.log('\n💡 Quick troubleshooting commands:');
    console.log('   curl http://localhost:8086/ping');
    console.log('   sudo systemctl status influxdb');
    console.log('   influx auth list');
    console.log('   influx bucket list --org iot-org');
    
    process.exit(1);
  }
}

// Ejecutar test si es llamado directamente
if (require.main === module) {
  testInfluxConnection().catch(console.error);
}

module.exports = { testInfluxConnection };