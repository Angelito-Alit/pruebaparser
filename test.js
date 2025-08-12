#!/usr/bin/env node
const IotParser = require('./src/parser');

// Enhanced test with both JSON and pipe formats
function runEnhancedTests() {
  console.log('🧪 Running Enhanced IoT Parser Tests (JSON + Pipe)\n');

  // Create parser with minimal custom options for testing
  const parser = new IotParser({
    mqtt: {
      caPath: './emqxsl_ca.pem' // Override just the CA path for testing
    }
  });

  // Test valid pipe messages
  const validPipeMessages = [
    'tt1703123456|uid550e8400-e29b-41d4-a716-446655440000|t23.5|h65.2|v1.0',
    'tt1703123457|uid550e8400-e29b-41d4-a716-446655440001|t22.1|h70.5|a1|v1.2',
    'tt1703123458|uid550e8400-e29b-41d4-a716-446655440002|t24.8|h58.3'
  ];

  // Test valid JSON messages
  const validJsonMessages = [
    '{"timestamp":1703123456,"uuid":"550e8400-e29b-41d4-a716-446655440000","temperature":23.5,"humidity":65.2,"version":"1.0"}',
    '{"timestamp":1703123457,"id":"550e8400-e29b-41d4-a716-446655440001","temp":22.1,"humid":70.5,"actuator":"1","ver":"1.2"}',
    '{"timestamp":1703123458,"device_id":"550e8400-e29b-41d4-a716-446655440002","temperature":24.8,"humidity":58.3}'
  ];

  // Test invalid messages
  const invalidMessages = [
    'invalid|message',                                    // Invalid pipe format
    'tt|uid550e8400-e29b-41d4-a716-446655440000',        // Missing values
    '{"timestamp":1703123456,"uuid":"123","temperature":150}', // Invalid JSON (temp out of range)
    '{"invalid":"json","missing":"required_fields"}',    // Invalid JSON structure
    'not_json_or_pipe_format',                           // Unknown format
    '{"timestamp":"not_a_number","uuid":"550e8400-e29b-41d4-a716-446655440000"}' // Invalid JSON timestamp
  ];

  console.log('✅ Testing valid PIPE messages:');
  console.log('===============================');

  validPipeMessages.forEach((message, index) => {
    const result = parser.parse(message, 'test-topic');
    console.log(`Test ${index + 1}: ${result.valid ? '✅ PASS' : '❌ FAIL'} (${result.format})`);
    if (!result.valid) {
      console.log(`  Errors: ${result.validationErrors.join(', ')}`);
    } else {
      console.log(`  Device: ${result.data.uuid}, Temp: ${result.data.temperature}°C, Humidity: ${result.data.humidity}%`);
    }
    console.log(`  Processing: ${result.processingTime}ms\n`);
  });

  console.log('✅ Testing valid JSON messages:');
  console.log('===============================');

  validJsonMessages.forEach((message, index) => {
    const result = parser.parse(message, 'test-topic');
    console.log(`Test ${index + 1}: ${result.valid ? '✅ PASS' : '❌ FAIL'} (${result.format})`);
    if (!result.valid) {
      console.log(`  Errors: ${result.validationErrors.join(', ')}`);
    } else {
      console.log(`  Device: ${result.data.uuid}, Temp: ${result.data.temperature}°C, Humidity: ${result.data.humidity}%`);
    }
    console.log(`  Processing: ${result.processingTime}ms\n`);
  });

  console.log('❌ Testing invalid messages:');
  console.log('============================');

  invalidMessages.forEach((message, index) => {
    const result = parser.parse(message, 'test-topic');
    console.log(`Test ${index + 1}: ${result.valid ? '❌ UNEXPECTED PASS' : '✅ CORRECTLY REJECTED'} (${result.format})`);
    if (!result.valid) {
      console.log(`  Errors: ${result.validationErrors.join(', ')}`);
    }
    console.log(`  Processing: ${result.processingTime}ms\n`);
  });

  console.log('📊 Enhanced Test Summary:');
  console.log('=========================');
  console.log(`Valid PIPE messages should pass: ${validPipeMessages.length} tests`);
  console.log(`Valid JSON messages should pass: ${validJsonMessages.length} tests`);
  console.log(`Invalid messages should fail: ${invalidMessages.length} tests`);
  console.log('\n✅ All enhanced tests completed!');
  console.log('\n💡 The parser now supports:');
  console.log('   📦 Pipe format: tt1234|uid123|t25.5|h60.2');
  console.log('   🎯 JSON format: {"timestamp":1234,"uuid":"123","temperature":25.5}');
  console.log('   🔄 Auto-detection of message format');
  console.log('   ⚡ Real-time performance metrics');
  console.log('   📊 Enhanced error reporting');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runEnhancedTests();
}

module.exports = { runEnhancedTests };
