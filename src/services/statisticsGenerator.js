const fs = require('fs');
const path = require('path');

class StatisticsGenerator {
  constructor(logDir = './logs') {
    this.logDir = logDir;
  }

  readLogFiles() {
    if (!fs.existsSync(this.logDir)) {
      throw new Error(`Log directory ${this.logDir} does not exist`);
    }

    const logFiles = fs.readdirSync(this.logDir)
      .filter(file => file.endsWith('.log'))
      .map(file => path.join(this.logDir, file));

    const logs = [];
    for (const file of logFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.trim().split('\n').filter(line => line);

      for (const line of lines) {
        try {
          logs.push(JSON.parse(line));
        } catch (e) {
          console.warn(`Failed to parse log line: ${line}`);
        }
      }
    }

    return logs;
  }

  generateStatistics() {
    const logs = this.readLogFiles();

    const stats = {
      summary: {
        totalLogs: logs.length,
        validMessages: 0,
        invalidMessages: 0,
        errors: 0,
        successRate: 0
      },
      timeRange: {
        firstLog: null,
        lastLog: null,
        durationHours: 0
      },
      messagesByLevel: {},
      messagesByHour: {},
      messagesByDay: {},
      sensorData: {
        temperatureStats: { min: null, max: null, avg: 0, count: 0 },
        humidityStats: { min: null, max: null, avg: 0, count: 0 },
        uniqueDevices: new Set(),
        versions: {}
      },
      validationErrors: {}
    };

    let tempSum = 0, tempCount = 0;
    let humSum = 0, humCount = 0;

    for (const log of logs) {
      // Time range
      const logTime = new Date(log.timestamp);
      if (!stats.timeRange.firstLog || logTime < new Date(stats.timeRange.firstLog)) {
        stats.timeRange.firstLog = log.timestamp;
      }
      if (!stats.timeRange.lastLog || logTime > new Date(stats.timeRange.lastLog)) {
        stats.timeRange.lastLog = log.timestamp;
      }

      // Count by level
      stats.messagesByLevel[log.level] = (stats.messagesByLevel[log.level] || 0) + 1;

      // Count by hour
      const hour = logTime.getHours();
      stats.messagesByHour[hour] = (stats.messagesByHour[hour] || 0) + 1;

      // Count by day
      const day = logTime.toISOString().split('T')[0];
      stats.messagesByDay[day] = (stats.messagesByDay[day] || 0) + 1;

      // Analyze data based on log level and content
      switch (log.level) {
        case 'success':
          stats.summary.validMessages++;
          if (log.data) {
            // Track unique devices
            if (log.data.uuid) {
              stats.sensorData.uniqueDevices.add(log.data.uuid);
            }

            // Track versions
            if (log.data.version) {
              stats.sensorData.versions[log.data.version] =
                (stats.sensorData.versions[log.data.version] || 0) + 1;
            }

            // Temperature stats
            if (log.data.temperature !== undefined) {
              const temp = log.data.temperature;
              tempSum += temp;
              tempCount++;

              if (stats.sensorData.temperatureStats.min === null ||
                temp < stats.sensorData.temperatureStats.min) {
                stats.sensorData.temperatureStats.min = temp;
              }
              if (stats.sensorData.temperatureStats.max === null ||
                temp > stats.sensorData.temperatureStats.max) {
                stats.sensorData.temperatureStats.max = temp;
              }
            }

            // Humidity stats
            if (log.data.humidity !== undefined) {
              const hum = log.data.humidity;
              humSum += hum;
              humCount++;

              if (stats.sensorData.humidityStats.min === null ||
                hum < stats.sensorData.humidityStats.min) {
                stats.sensorData.humidityStats.min = hum;
              }
              if (stats.sensorData.humidityStats.max === null ||
                hum > stats.sensorData.humidityStats.max) {
                stats.sensorData.humidityStats.max = hum;
              }
            }
          }
          break;
        case 'warn':
          stats.summary.invalidMessages++;
          // Track validation errors
          if (log.message && log.message.includes('Invalid')) {
            stats.validationErrors[log.message] =
              (stats.validationErrors[log.message] || 0) + 1;
          }
          break;
        case 'error':
          stats.summary.errors++;
          break;
      }
    }

    // Calculate averages and rates
    stats.sensorData.temperatureStats.avg = tempCount > 0 ? (tempSum / tempCount).toFixed(2) : 0;
    stats.sensorData.temperatureStats.count = tempCount;

    stats.sensorData.humidityStats.avg = humCount > 0 ? (humSum / humCount).toFixed(2) : 0;
    stats.sensorData.humidityStats.count = humCount;

    stats.sensorData.uniqueDevices = Array.from(stats.sensorData.uniqueDevices);

    stats.summary.successRate = stats.summary.totalLogs > 0
      ? ((stats.summary.validMessages / stats.summary.totalLogs) * 100).toFixed(2)
      : 0;

    // Calculate duration
    if (stats.timeRange.firstLog && stats.timeRange.lastLog) {
      const duration = new Date(stats.timeRange.lastLog) - new Date(stats.timeRange.firstLog);
      stats.timeRange.durationHours = (duration / (1000 * 60 * 60)).toFixed(2);
    }

    return stats;
  }

  generateReport() {
    const stats = this.generateStatistics();

    let report = `
# IoT Parser Statistics Report
Generated: ${new Date().toISOString()}

## Summary
- **Total Messages Processed**: ${stats.summary.totalLogs}
- **Valid Messages**: ${stats.summary.validMessages}
- **Invalid Messages**: ${stats.summary.invalidMessages}
- **Errors**: ${stats.summary.errors}
- **Success Rate**: ${stats.summary.successRate}%

## Time Range
- **First Log**: ${stats.timeRange.firstLog || 'N/A'}
- **Last Log**: ${stats.timeRange.lastLog || 'N/A'}
- **Duration**: ${stats.timeRange.durationHours} hours

## Sensor Data Analysis
### Temperature
- **Min**: ${stats.sensorData.temperatureStats.min}°C
- **Max**: ${stats.sensorData.temperatureStats.max}°C
- **Average**: ${stats.sensorData.temperatureStats.avg}°C
- **Readings**: ${stats.sensorData.temperatureStats.count}

### Humidity
- **Min**: ${stats.sensorData.humidityStats.min}%
- **Max**: ${stats.sensorData.humidityStats.max}%
- **Average**: ${stats.sensorData.humidityStats.avg}%
- **Readings**: ${stats.sensorData.humidityStats.count}

### Devices
- **Unique Devices**: ${stats.sensorData.uniqueDevices.length}
- **Device UUIDs**: ${stats.sensorData.uniqueDevices.join(', ')}

### Versions
${Object.entries(stats.sensorData.versions).map(([version, count]) =>
      `- **${version}**: ${count} messages`).join('\n')}

## Messages by Hour
${Object.entries(stats.messagesByHour).map(([hour, count]) =>
        `- **${hour}:00**: ${count} messages`).join('\n')}

## Messages by Level
${Object.entries(stats.messagesByLevel).map(([level, count]) =>
          `- **${level.toUpperCase()}**: ${count} messages`).join('\n')}

## Validation Errors
${Object.entries(stats.validationErrors).map(([error, count]) =>
            `- **${error}**: ${count} occurrences`).join('\n')}
`;

    return { report, stats };
  }

  saveReport(outputDir = './statistics') {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const { report, stats } = this.generateReport();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Save markdown report
    const reportPath = path.join(outputDir, `report-${timestamp}.md`);
    fs.writeFileSync(reportPath, report);

    // Save JSON stats
    const statsPath = path.join(outputDir, `stats-${timestamp}.json`);
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));

    return { reportPath, statsPath, stats };
  }

  generateCSV() {
    const logs = this.readLogFiles();

    let csv = 'timestamp,level,message,uuid,temperature,humidity,version,actuator\n';

    for (const log of logs) {
      const data = log.data || {};
      csv += `${log.timestamp},${log.level},"${log.message}",${data.uuid || ''},${data.temperature || ''},${data.humidity || ''},${data.version || ''},${data.actuator || ''}\n`;
    }

    return csv;
  }

  saveCSV(outputDir = './statistics') {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const csv = this.generateCSV();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const csvPath = path.join(outputDir, `data-${timestamp}.csv`);

    fs.writeFileSync(csvPath, csv);
    return csvPath;
  }
}

module.exports = StatisticsGenerator;
