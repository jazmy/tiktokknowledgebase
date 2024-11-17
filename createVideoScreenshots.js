const path = require("path");
const fs = require("fs");
const config = require("./config");
const logger = require("./services/loggerService");
const ffmpegService = require("./services/ffmpegService");
const csvService = require("./services/csvService");
const progressBar = require("./utils/progressBar");
const ErrorHandler = require("./utils/errorHandler");

async function processVideos() {
  const rows = await csvService.readCSV(config.CSV.OUTPUT.GENAI);
  // Filter rows that need screenshots
  const videosNeedingScreenshots = rows
    .filter((row) => row["Needs Screenshots"]?.toLowerCase() === "true")
    .map((row) => row.Filename); // Extract just the filename

  const totalVideos = videosNeedingScreenshots.length;
  logger.info(`Found ${totalVideos} videos that need screenshots`);
  console.log(`\nFound ${totalVideos} videos that need screenshots`);

  if (totalVideos === 0) {
    console.log("\nNo videos to process");
    process.exit(0);
  }

  const progress = progressBar.createSingle();
  progress.start(totalVideos, 0);

  for (const filename of videosNeedingScreenshots) {
    const videoPath = path.join(__dirname, config.FOLDERS.VIDEOS, filename);

    if (!fs.existsSync(videoPath)) {
      logger.error(`Video file not found: ${videoPath}`);
      continue;
    }

    try {
      await ffmpegService.extractSceneScreenshots(
        videoPath,
        path.join(__dirname, config.FOLDERS.SCREENSHOTS)
      );
      progress.increment();
    } catch (error) {
      logger.error(`Failed to process ${filename}: ${error.message}`);
    }
  }

  progress.stop();
  logger.info("Screenshot extraction completed");
  console.log("\n\x1b[32m%s\x1b[0m", "Done!");
  process.exit(0);
}

// Initialize error handling
ErrorHandler.handleProcessExit();

// Start processing
processVideos().catch((error) => {
  ErrorHandler.handleFatalError(error, "screenshot creation");
});
