const videoProcessor = require("./processors/videoProcessor");
const ErrorHandler = require("./utils/errorHandler");

// Initialize error handling
ErrorHandler.handleProcessExit();

// Start the processing pipeline
console.log(
  "\n\x1b[44m\x1b[37m%s\x1b[0m",
  " Starting Video Processing Pipeline "
);
videoProcessor.processAll();
