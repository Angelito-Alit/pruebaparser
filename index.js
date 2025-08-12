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

    await parser.connect();
    console.log('✅ Parser started successfully!');
    console.log(`📊 Listening for messages on topics: ${config.mqtt.topics.join(', ')}`);

    // Display enhanced statistics every 30 seconds
    setInterval(() => {
      const stats = parser.getStats();
      const uptime = Math.round(stats.uptime / 1000 / 60);
      const successRate = parseFloat(stats.validationRate);

      console.log('\n� ============= LIVE DASHBOARD =============');
      console.log(`🕒 System Uptime: ${uptime} minutes`);
      console.log(`📨 Total Messages: ${stats.totalMessages}`);

      // Success/Error breakdown with visual indicators
      const validBar = '█'.repeat(Math.floor(successRate / 5));
      const invalidBar = '█'.repeat(Math.floor((100 - successRate) / 5));

      console.log(`✅ Valid Messages: ${stats.validMessages} (${successRate}%) ${validBar}`);
      console.log(`❌ Invalid Messages: ${stats.invalidMessages} (${(100 - successRate).toFixed(2)}%) ${invalidBar}`);
      console.log(`� System Errors: ${stats.errors}`);

      // Performance indicators
      const messageRate = uptime > 0 ? (stats.totalMessages / uptime).toFixed(2) : '0.00';
      console.log(`⚡ Message Rate: ${messageRate} msg/min`);

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
    process.exit(1);
  }
}// Graceful shutdown
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

  parser.disconnect();
  console.log('✅ Parser disconnected');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  parser.disconnect();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  parser.disconnect();
  process.exit(1);
});

// Start the parser
startParser();