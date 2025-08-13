require('dotenv').config();
const IotParser = require('./src/parser');
const StatisticsGenerator = require('./src/services/statisticsGenerator');
const config = require('./config/config');

// Initialize parser with centralized configuration
const parser = new IotParser();

// Enhanced event handling with detailed display
parser.on('data', (data) => {
  // Valid data received - show detailed information
  const timestamp = new Date().toISOString();
  console.log('\n🎉 ===== VALID MESSAGE PROCESSED =====');
  console.log(`⏰ Time: ${timestamp}`);
  console.log(`📟 Device: ${data.uuid}`);
  console.log(`🌡️  Temperature: ${data.temperature}°C`);
  console.log(`💧 Humidity: ${data.humidity}%`);
  console.log(`📦 Format: ${data._format || 'pipe'}`);
  console.log(`📡 Topic: ${data._topic}`);
  if (data.version) console.log(`🔖 Version: ${data.version}`);
  if (data.actuator) console.log(`⚙️  Actuator: ${data.actuator}`);
  if (config.influxdb?.enabled) console.log(`💾 InfluxDB: ✅ Saved`);
  console.log('=====================================\n');
});

parser.on('error', (error) => {
  // Invalid data received - show detailed error information
  const timestamp = new Date().toISOString();
  console.log('\n❌ ===== INVALID MESSAGE DETECTED =====');
  console.log(`⏰ Time: ${timestamp}`);
  console.log(`📨 Original: ${error.original}`);
  console.log(`📡 Topic: ${error.topic}`);
  console.log(`📦 Format: ${error.format || 'unknown'}`);
  console.log('🚨 Validation Errors:');
  error.validationErrors.forEach((err, index) => {
    console.log(`   ${index + 1}. ${err}`);
  });
  console.log('=======================================\n');
});

// Connection management
async function startParser() {
  try {
    console.log('🚀 Starting IoT Parser...');
    console.log(`📡 Connecting to: ${config.mqtt.brokerUrl}`);
    console.log(`📊 Logging to: ${config.parser.logDir}`);
    console.log(`⚡ Workers enabled: ${config.parser.useWorkers}`);
    
    // Show InfluxDB status
    if (config.influxdb?.enabled) {
      console.log(`💾 InfluxDB: ${config.influxdb.url} (${config.influxdb.org}/${config.influxdb.bucket})`);
    } else {
      console.log(`💾 InfluxDB: ❌ Disabled`);
    }

    await parser.connect();
    console.log('✅ Parser started successfully!');
    console.log(`📊 Listening for messages on topics: ${config.mqtt.topics.join(', ')}`);

    // Display enhanced statistics every 30 seconds
    setInterval(() => {
      const stats = parser.getStats();
      const uptime = Math.round(stats.uptime / 1000 / 60);
      const successRate = parseFloat(stats.validationRate);

      console.log('\n📊 ============= LIVE DASHBOARD =============');
      console.log(`🕒 System Uptime: ${uptime} minutes`);
      console.log(`📨 Total Messages: ${stats.totalMessages}`);

      // Success/Error breakdown with visual indicators
      const validBar = '█'.repeat(Math.floor(successRate / 5));
      const invalidBar = '█'.repeat(Math.floor((100 - successRate) / 5));

      console.log(`✅ Valid Messages: ${stats.validMessages} (${successRate}%) ${validBar}`);
      console.log(`❌ Invalid Messages: ${stats.invalidMessages} (${(100 - successRate).toFixed(2)}%) ${invalidBar}`);
      console.log(`🔴 System Errors: ${stats.errors}`);

      // Performance indicators
      const messageRate = uptime > 0 ? (stats.totalMessages / uptime).toFixed(2) : '0.00';
      console.log(`⚡ Message Rate: ${messageRate} msg/min`);

      // InfluxDB status
      if (config.influxdb?.enabled) {
        console.log(`💾 InfluxDB: 🟢 ACTIVE (${config.influxdb.bucket})`);
      } else {
        console.log(`💾 InfluxDB: ⚪ DISABLED`);
      }

      // Status indicator
      let statusIcon = '🟢';
      let statusText = 'HEALTHY';

      if (successRate < 50) {
        statusIcon = '🔴';
        statusText = 'CRITICAL';
      } else if (successRate < 80) {
        statusIcon = '🟡';
        statusText = 'WARNING';
      }

      console.log(`${statusIcon} System Status: ${statusText}`);
      console.log('===========================================\n');
    }, 30000);

  } catch (error) {
    console.error('❌ Failed to start parser:', error.message);
    
    // Specific error handling for InfluxDB
    if (error.message.includes('InfluxDB') || error.message.includes('ECONNREFUSED')) {
      console.log('\n🔧 InfluxDB Connection Issues:');
      console.log('   1. Check if InfluxDB is running: sudo systemctl status influxdb');
      console.log('   2. Verify connection: curl http://localhost:8086/ping');
      console.log('   3. Check your token and credentials');
      console.log('   4. Set INFLUX_ENABLED=false to disable InfluxDB integration');
    }
    
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');

  try {
    // Generate final statistics report
    const statsGen = new StatisticsGenerator(config.parser.logDir);
    const { reportPath, statsPath } = statsGen.saveReport('./statistics');
    console.log(`📊 Final report saved to: ${reportPath}`);
    console.log(`📈 Statistics saved to: ${statsPath}`);

    // Save CSV export
    const csvPath = statsGen.saveCSV('./statistics');
    console.log(`📄 CSV data exported to: ${csvPath}`);

  } catch (error) {
    console.log('⚠️  Could not generate final report:', error.message);
  }

  // Gracefully disconnect parser (including InfluxDB)
  await parser.disconnect();
  console.log('✅ Parser disconnected');
  
  if (config.influxdb?.enabled) {
    console.log('💾 InfluxDB connection closed');
  }
  
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('💥 Uncaught Exception:', error);
  
  try {
    await parser.disconnect();
  } catch (disconnectError) {
    console.error('Error during emergency disconnect:', disconnectError);
  }
  
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  
  try {
    await parser.disconnect();
  } catch (disconnectError) {
    console.error('Error during emergency disconnect:', disconnectError);
  }
  
  process.exit(1);
});

// Test InfluxDB connection on startup
async function testInfluxConnection() {
  if (!config.influxdb?.enabled) {
    console.log('ℹ️  InfluxDB integration disabled');
    return;
  }

  try {
    console.log('🔍 Testing InfluxDB connection...');
    
    const { InfluxDB, Point } = require('@influxdata/influxdb-client');
    const testClient = new InfluxDB({
      url: config.influxdb.url,
      token: config.influxdb.token
    });

    // Test write API
    const writeApi = testClient.getWriteApi(config.influxdb.org, config.influxdb.bucket);
    
    const testPoint = new Point('connection_test')
      .tag('source', 'parser-startup')
      .floatField('test_value', 1.0)
      .timestamp(new Date());

    writeApi.writePoint(testPoint);
    await writeApi.close();
    
    console.log('✅ InfluxDB connection test successful');
    
  } catch (error) {
    console.log(`⚠️  InfluxDB connection test failed: ${error.message}`);
    console.log('   Parser will continue without InfluxDB integration');
    console.log('   Set INFLUX_ENABLED=false to suppress this warning');
  }
}

// Enhanced startup sequence
async function enhancedStartup() {
  console.log('🌟 IoT Parser Enhanced Edition');
  console.log('==============================');
  
  // Show configuration summary
  console.log('📋 Configuration Summary:');
  console.log(`   📡 MQTT: ${config.mqtt.brokerUrl}`);
  console.log(`   📂 Logs: ${config.parser.logDir}`);
  console.log(`   ⚡ Workers: ${config.parser.useWorkers ? config.parser.numWorkers : 'Disabled'}`);
  console.log(`   💾 InfluxDB: ${config.influxdb?.enabled ? `${config.influxdb.url}` : 'Disabled'}`);
  console.log('');

  // Test InfluxDB if enabled
  if (config.influxdb?.enabled) {
    await testInfluxConnection();
  }

  // Start the main parser
  await startParser();
}

// Start the enhanced parser
enhancedStartup().catch(async (error) => {
  console.error('💥 Startup failed:', error.message);
  
  if (error.message.includes('InfluxDB') || error.message.includes('ECONNREFUSED')) {
    console.log('\n🔧 InfluxDB Troubleshooting:');
    console.log('   1. Start InfluxDB: sudo systemctl start influxdb');
    console.log('   2. Check status: sudo systemctl status influxdb');
    console.log('   3. Verify token: influx auth list');
    console.log('   4. Test connection: curl http://localhost:8086/ping');
    console.log('   5. Disable if needed: INFLUX_ENABLED=false');
  }
  
  process.exit(1);
});