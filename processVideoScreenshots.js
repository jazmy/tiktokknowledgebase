const fs = require("fs");
const path = require("path");
const config = require("./config");
const logger = require("./services/loggerService");
const ModelProviderFactory = require("./services/modelProviderFactory");
const modelProvider = ModelProviderFactory.getProvider();
const csvService = require("./services/csvService");
const progressBar = require("./utils/progressBar");
const ErrorHandler = require("./utils/errorHandler");
const pLimit = require("p-limit");

async function processAllScreenshots() {
  const screenshotsDir = path.join(__dirname, config.FOLDERS.SCREENSHOTS);

  // Check if screenshots directory exists
  if (!fs.existsSync(screenshotsDir)) {
    console.error("\nScreenshots directory not found:", screenshotsDir);
    process.exit(1);
  }

  // Get all video folders
  const videoFolders = fs
    .readdirSync(screenshotsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  if (videoFolders.length === 0) {
    console.log("\nNo screenshot folders found to process");
    process.exit(0);
  }

  // Initialize CSV writer
  const writer = csvService.createWriter(
    config.CSV.OUTPUT.SCREENSHOTS,
    [
      { id: "filename", title: "Filename" },
      { id: "screenshot_count", title: "Screenshot Count" },
      { id: "extracted_text", title: "Extracted Text" },
      { id: "summary", title: "Content Summary" },
      ...config.SCREENSHOT_PROCESSING.COLUMNS.OUTPUT.CUSTOM_FIELDS.map(
        (field) => ({
          id: field.id || field.name.toLowerCase().replace(/\s+/g, "_"),
          title: field.name,
        })
      ),
    ],
    fs.existsSync(path.join(__dirname, config.CSV.OUTPUT.SCREENSHOTS))
  );

  // Get already processed videos
  const processedVideos = new Set();
  if (fs.existsSync(path.join(__dirname, config.CSV.OUTPUT.SCREENSHOTS))) {
    const processedEntries = await csvService.readCSV(
      config.CSV.OUTPUT.SCREENSHOTS
    );
    processedEntries.forEach((row) => {
      processedVideos.add(row.Filename);
    });
    console.log(`Found ${processedVideos.size} already processed videos`);
  }

  // Initialize concurrent limiters
  const screenshotLimiter = pLimit(
    config.SCREENSHOT_PROCESSING.CONCURRENT_PROCESSING.SCREENSHOTS
  );

  // Process each video folder
  const progress = progressBar.createMultiBar(videoFolders.length, {
    name: "Processing Videos",
  });

  // Process video folders concurrently
  await Promise.all(
    videoFolders.map(async (videoName) => {
      const filename = `${videoName}.mp4`;
      if (processedVideos.has(filename)) {
        console.log(`\nSkipping ${videoName} - already processed`);
        progress.increment();
        return;
      }

      const folderPath = path.join(screenshotsDir, videoName);
      const screenshots = fs
        .readdirSync(folderPath)
        .filter((file) => file.endsWith(".jpg"));

      if (screenshots.length === 0) {
        console.log(`\nSkipping ${videoName} - no screenshots found`);
        progress.increment();
        return;
      }

      console.log(
        `\nProcessing ${screenshots.length} screenshots for ${videoName}`
      );

      // Process all screenshots concurrently with rate limiting
      const analyses = await Promise.all(
        screenshots.map((screenshot) =>
          screenshotLimiter(async () => {
            try {
              const imagePath = path.join(folderPath, screenshot);
              const imageBuffer = await fs.promises.readFile(imagePath);
              const analysis = await modelProvider.analyzeScreenshot(
                imageBuffer.toString("base64")
              );
              return { screenshot, extracted_text: analysis };
            } catch (error) {
              logger.error(
                `Error processing screenshot ${screenshot}: ${error.message}`
              );
              return {
                screenshot,
                extracted_text: "Error processing screenshot",
              };
            }
          })
        )
      );

      // Combine all extracted text
      const combinedText = analyses
        .map((a) => a.extracted_text)
        .filter(
          (text) => text !== "Error processing screenshot" && text !== "N/A"
        )
        .join("\n\n");

      // Generate summary for all screenshots in this video
      const summary = await modelProvider.generateSummary([
        { extracted_text: combinedText },
      ]);

      // Generate custom fields based on all extracted text
      const customFields = {};
      for (const field of config.SCREENSHOT_PROCESSING.COLUMNS.OUTPUT
        .CUSTOM_FIELDS) {
        const fieldId =
          field.id || field.name.toLowerCase().replace(/\s+/g, "_");
        customFields[fieldId] = await modelProvider.generateCustomFieldContent(
          combinedText,
          field.prompt
        );
      }

      // Write single row for the video
      await csvService.writeRecords(writer, [
        {
          filename: filename,
          screenshot_count: screenshots.length,
          extracted_text: combinedText,
          summary,
          ...customFields,
        },
      ]);

      progress.increment();
    })
  );

  progress.stop();
  logger.info("Screenshot analysis completed successfully");
  console.log("\n\x1b[32m%s\x1b[0m", "Done!");
  process.exit(0);
}

// Initialize error handling
ErrorHandler.handleProcessExit();

// Start processing
processAllScreenshots().catch((error) => {
  ErrorHandler.handleFatalError(error, "screenshot processing");
});
