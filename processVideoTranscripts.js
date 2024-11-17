const transcriptProcessor = require("./processors/transcriptProcessor");
const ErrorHandler = require("./utils/errorHandler");

// Initialize error handling
ErrorHandler.handleProcessExit();

// Start processing
transcriptProcessor.processCSV().catch((error) => {
  ErrorHandler.handleFatalError(error, "transcript processing");
});
