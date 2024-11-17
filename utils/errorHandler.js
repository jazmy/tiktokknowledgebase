const logger = require("../services/loggerService");

class ErrorHandler {
  static handleError(error, context) {
    logger.error(`Error in ${context}: ${error.message}`);
    console.error(`\n\x1b[31mError in ${context}: ${error.message}\x1b[0m`);
  }

  static handleFatalError(error, context) {
    logger.error(`Fatal error in ${context}: ${error.message}`);
    console.error(`\n\x1b[41m\x1b[37m Fatal error in ${context} \x1b[0m`);
    console.error("\x1b[31m%s\x1b[0m", error.message);
    process.exit(1);
  }

  static handleProcessExit() {
    process.on("unhandledRejection", (error) => {
      this.handleFatalError(error, "unhandled rejection");
    });

    process.on("uncaughtException", (error) => {
      this.handleFatalError(error, "uncaught exception");
    });
  }
}

module.exports = ErrorHandler;
