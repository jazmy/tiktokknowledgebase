const path = require("path");
const fs = require("fs");
const config = require("./config");
const logger = require("./services/loggerService");
const ffmpegService = require("./services/ffmpegService");
const progressBar = require("./utils/progressBar");
const ErrorHandler = require("./utils/errorHandler");

async function processAllVideos() {
  const videosDir = path.join(__dirname, config.FOLDERS.VIDEOS);

  // Check if videos directory exists
  if (!fs.existsSync(videosDir)) {
    console.error("\nVideos directory not found:", videosDir);
    process.exit(1);
  }

  // Get all video files
  const videoFiles = fs
    .readdirSync(videosDir)
    .filter((file) => file.endsWith(".mp4")); // Add other video formats if needed

  const totalVideos = videoFiles.length;
  logger.info(`Found ${totalVideos} videos to process`);
  console.log(`\nFound ${totalVideos} videos to process`);

  if (totalVideos === 0) {
    console.log("\nNo videos found in directory:", videosDir);
    process.exit(0);
  }

  const progress = progressBar.createSingle();
  progress.start(totalVideos, 0);

  // Process each video
  for (const filename of videoFiles) {
    const videoPath = path.join(videosDir, filename);
    console.log(`\nProcessing: ${filename}`);

    try {
      await ffmpegService.extractSceneScreenshots(
        videoPath,
        path.join(__dirname, config.FOLDERS.SCREENSHOTS)
      );
      progress.increment();
    } catch (error) {
      logger.error(`Failed to process ${filename}: ${error.message}`);
      console.error(`\nError processing ${filename}: ${error.message}`);
    }
  }

  progress.stop();
  logger.info("Screenshot extraction completed for all videos");
  console.log("\n\x1b[32m%s\x1b[0m", "Done!");
  process.exit(0);
}

// Initialize error handling
ErrorHandler.handleProcessExit();

// Start processing
processAllVideos().catch((error) => {
  ErrorHandler.handleFatalError(error, "screenshot creation");
});
