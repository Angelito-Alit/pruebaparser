#!/usr/bin/env node
const StatisticsGenerator = require('./src/services/statisticsGenerator');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);

function showHelp() {
  console.log(`
📊 IoT Parser Statistics CLI

Usage:
  node stats.js [command] [options]

Commands:
  report                    Generate markdown report
  csv                      Export data as CSV
  json                     Export statistics as JSON
  live                     Show live statistics (if parser is running)
  clean                    Clean old log files

Options:
  --log-dir <path>         Log directory path (default: ./logs)
  --output-dir <path>      Output directory path (default: ./statistics)
  --days <number>          Number of days to keep (for clean command)
  --help                   Show this help

Examples:
  node stats.js report
  node stats.js csv --output-dir ./exports
  node stats.js clean --days 7
  node stats.js live
`);
}

function getLiveStats() {
  try {
    const logDir = args.includes('--log-dir')
      ? args[args.indexOf('--log-dir') + 1]
      : './logs';

    const statsFiles = fs.readdirSync(logDir)
      .filter(file => file.startsWith('stats-'))
      .sort()
      .reverse();

    if (statsFiles.length === 0) {
      console.log('❌ No statistics files found. Parser might not be running.');
      return;
    }

    const latestStatsFile = path.join(logDir, statsFiles[0]);
    const stats = JSON.parse(fs.readFileSync(latestStatsFile, 'utf8'));

    console.log('\n📊 Live Statistics:');
    console.log('===================');
    console.log(`📨 Total Messages: ${stats.totalMessages}`);
    console.log(`✅ Valid Messages: ${stats.validMessages}`);
    console.log(`❌ Invalid Messages: ${stats.invalidMessages}`);
    console.log(`🚨 Errors: ${stats.errors}`);
    console.log(`📈 Success Rate: ${stats.validationRate}%`);
    console.log(`⏱️  Uptime: ${Math.round(stats.uptime / 1000 / 60)} minutes`);
    console.log(`🕒 Last Updated: ${new Date(stats.lastReset).toLocaleString()}`);

    if (Object.keys(stats.messagesByHour).length > 0) {
      console.log('\n📊 Messages by Hour:');
      Object.entries(stats.messagesByHour)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([hour, count]) => {
          console.log(`  ${hour.padStart(2, '0')}:00 - ${count} messages`);
        });
    }

  } catch (error) {
    console.error('❌ Error reading live stats:', error.message);
  }
}

function cleanOldFiles() {
  const logDir = args.includes('--log-dir')
    ? args[args.indexOf('--log-dir') + 1]
    : './logs';

  const days = args.includes('--days')
    ? parseInt(args[args.indexOf('--days') + 1])
    : 30;

  if (!fs.existsSync(logDir)) {
    console.log('❌ Log directory does not exist');
    return;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const files = fs.readdirSync(logDir);
  let deletedCount = 0;

  files.forEach(file => {
    const filePath = path.join(logDir, file);
    const stats = fs.statSync(filePath);

    if (stats.mtime < cutoffDate) {
      fs.unlinkSync(filePath);
      deletedCount++;
      console.log(`🗑️  Deleted: ${file}`);
    }
  });

  console.log(`\n✅ Cleaned ${deletedCount} old files (older than ${days} days)`);
}

function main() {
  const command = args[0];

  if (args.includes('--help') || !command) {
    showHelp();
    return;
  }

  const logDir = args.includes('--log-dir')
    ? args[args.indexOf('--log-dir') + 1]
    : './logs';

  const outputDir = args.includes('--output-dir')
    ? args[args.indexOf('--output-dir') + 1]
    : './statistics';

  try {
    const statsGen = new StatisticsGenerator(logDir);

    switch (command) {
      case 'report':
        console.log('📊 Generating statistics report...');
        const { reportPath, statsPath } = statsGen.saveReport(outputDir);
        console.log(`✅ Report saved to: ${reportPath}`);
        console.log(`📈 Statistics saved to: ${statsPath}`);
        break;

      case 'csv':
        console.log('📄 Exporting CSV data...');
        const csvPath = statsGen.saveCSV(outputDir);
        console.log(`✅ CSV exported to: ${csvPath}`);
        break;

      case 'json':
        console.log('📊 Generating JSON statistics...');
        const stats = statsGen.generateStatistics();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const jsonPath = path.join(outputDir, `stats-${timestamp}.json`);

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(jsonPath, JSON.stringify(stats, null, 2));
        console.log(`✅ JSON exported to: ${jsonPath}`);
        break;

      case 'live':
        getLiveStats();
        break;

      case 'clean':
        cleanOldFiles();
        break;

      default:
        console.log(`❌ Unknown command: ${command}`);
        showHelp();
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
