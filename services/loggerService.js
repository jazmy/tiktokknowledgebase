const winston = require("winston");
const path = require("path");
const fs = require("fs");
const config = require("../config");

class LoggerService {
  constructor() {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(__dirname, "..", "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.logger = winston.createLogger({
      level: config.LOGGING.LEVEL,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp }) => {
          return `${timestamp} ${level}: ${message}`;
        })
      ),
      transports: [
        new winston.transports.File({
          filename: path.join(
            __dirname,
            "..",
            config.LOGGING.PROCESS_LOGS.SCREENSHOTS
          ),
        }),
        new winston.transports.File({
          filename: path.join(__dirname, "..", config.LOGGING.COMBINED_LOG),
        }),
        new winston.transports.File({
          filename: path.join(__dirname, "..", config.LOGGING.ERROR_LOG),
          level: "error",
        }),
      ],
    });

    // Add console transport for development
    if (process.env.NODE_ENV !== "production") {
      this.logger.add(
        new winston.transports.Console({
          format: winston.format.simple(),
        })
      );
    }
  }

  info(message) {
    this.logger.info(message);
  }

  error(message) {
    this.logger.error(message);
  }

  warn(message) {
    this.logger.warn(message);
  }
}

module.exports = new LoggerService();
