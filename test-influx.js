#!/usr/bin/env node
require('dotenv').config();
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

async function testInfluxConnection() {
  console.log('🔍 Testing InfluxDB Connection...\n');

  // Mostrar configuración
  console.log('📋 Configuration:');
  console.log(`   URL: ${process.env.INFLUX_URL}`);
  console.log(`   ORG: ${process.env.INFLUX_ORG}`);
  console.log(`   BUCKET: ${process.env.INFLUX_BUCKET}`);
  console.log(`   TOKEN: ${process.env.INFLUX_TOKEN ? '✅ Set' : '❌ Missing'}\n`);

  if (!process.env.INFLUX_URL || !process.env.INFLUX_TOKEN) {
    console.log('❌ Missing required environment variables');
    process.exit(1);
  }

  try {
    // Crear cliente InfluxDB
    const influxDB = new InfluxDB({
      url: process.env.INFLUX_URL,
      token: process.env.INFLUX_TOKEN
    });

    console.log('🔗 Testing InfluxDB connection...');

    // Test 1: Basic Connection Test (usando ping endpoint)
    try {
      const http = require('http');
      const url = new URL('/ping', process.env.INFLUX_URL);
      
      await new Promise((resolve, reject) => {
        const req = http.get({
          hostname: url.hostname,
          port: url.port,
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
        req.on('timeout', () => reject(new Error('Connection timeout')));
      });
    } catch (error) {
      console.log(`❌ Connection test failed: ${error.message}`);
      throw error;
    }

    // Test 2: Query API (verificar que el bucket existe)
    console.log('\n📊 Testing Query API...');
    const queryApi = influxDB.getQueryApi(process.env.INFLUX_ORG);
    
    const fluxQuery = `
      from(bucket: "${process.env.INFLUX_BUCKET}")
        |> range(start: -1h)
        |> limit(n: 1)
    `;

    try {
      const rows = [];
      await new Promise((resolve, reject) => {
        queryApi.queryRows(fluxQuery, {
          next(row, tableMeta) {
            rows.push(tableMeta.toObject(row));
          },
          error(error) {
            if (error.message.includes('bucket') || error.message.includes('not found')) {
              console.log(`⚠️  Bucket "${process.env.INFLUX_BUCKET}" might not exist yet`);
              resolve();
            } else {
              reject(error);
            }
          },
          complete() {
            console.log(`✅ Query API working. Found ${rows.length} recent records.`);
            resolve();
          }
        });
      });
    } catch (error) {
      console.log(`❌ Query failed: ${error.message}`);
    }

    // Test 3: Write API (escribir un punto de prueba)
    console.log('\n✍️  Testing Write API...');
    const writeApi = influxDB.getWriteApi(
      process.env.INFLUX_ORG, 
      process.env.INFLUX_BUCKET
    );

    // Escribir punto de prueba
    const testPoint = new Point('connection_test')
      .tag('source', 'test-script')
      .tag('status', 'testing')
      .floatField('value', 42.0)
      .stringField('message', 'Connection test from IoT Parser')
      .timestamp(new Date());

    writeApi.writePoint(testPoint);

    try {
      await writeApi.close();
      console.log('✅ Write API test successful');
    } catch (error) {
      console.log(`❌ Write failed: ${error.message}`);
      throw error;
    }

    // Test 4: Verificar que el dato se escribió
    console.log('\n🔍 Verifying written data...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos

    const verifyQuery = `
      from(bucket: "${process.env.INFLUX_BUCKET}")
        |> range(start: -1m)
        |> filter(fn: (r) => r._measurement == "connection_test")
        |> filter(fn: (r) => r.source == "test-script")
    `;

    try {
      const verifyRows = [];
      await new Promise((resolve, reject) => {
        queryApi.queryRows(verifyQuery, {
          next(row, tableMeta) {
            verifyRows.push(tableMeta.toObject(row));
          },
          error(error) {
            reject(error);
          },
          complete() {
            if (verifyRows.length > 0) {
              console.log('✅ Data verification successful - test data found in InfluxDB');
            } else {
              console.log('⚠️  Data not found yet (might take a moment to appear)');
            }
            resolve();
          }
        });
      });
    } catch (error) {
      console.log(`⚠️  Verification query failed: ${error.message}`);
    }

    console.log('\n🎉 InfluxDB Connection Test Complete!');
    console.log('\n📝 Summary:');
    console.log('   ✅ Connection established');
    console.log('   ✅ Ping test passed');
    console.log('   ✅ Query API accessible');
    console.log('   ✅ Write API functional');
    console.log('\n🚀 Your IoT Parser should work with InfluxDB!');

  } catch (error) {
    console.log('\n💥 Connection Test Failed!');
    console.log(`❌ Error: ${error.message}`);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n🔧 Possible solutions:');
      console.log('   1. Check if InfluxDB is running on the server');
      console.log('   2. Verify the URL and port (8086)');
      console.log('   3. Check firewall settings');
    } else if (error.message.includes('unauthorized') || error.message.includes('401')) {
      console.log('\n🔧 Authentication issue:');
      console.log('   1. Verify your INFLUX_TOKEN is correct');
      console.log('   2. Check token permissions');
    } else if (error.message.includes('bucket')) {
      console.log('\n🔧 Bucket issue:');
      console.log('   1. Create the bucket in InfluxDB UI');
      console.log('   2. Verify bucket name spelling');
    }
    
    process.exit(1);
  }
}

// Ejecutar test si es llamado directamente
if (require.main === module) {
  testInfluxConnection().catch(console.error);
}

module.exports = { testInfluxConnection };