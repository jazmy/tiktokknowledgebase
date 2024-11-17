const fs = require("fs");
const path = require("path");
const config = require("./config");
const logger = require("./services/loggerService");
const openaiService = require("./services/openaiService");
const csvService = require("./services/csvService");
const progressBar = require("./utils/progressBar");
const ErrorHandler = require("./utils/errorHandler");

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
      { id: "screenshot", title: "Screenshot" },
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

  // Get already processed screenshots
  const processedScreenshots = new Set();
  if (fs.existsSync(path.join(__dirname, config.CSV.OUTPUT.SCREENSHOTS))) {
    const processedEntries = await csvService.readCSV(
      config.CSV.OUTPUT.SCREENSHOTS
    );
    processedEntries.forEach((row) => {
      const key = `${row.Filename}|${row.Screenshot}`;
      processedScreenshots.add(key);
    });
    console.log(
      `Found ${processedScreenshots.size} already processed screenshots`
    );
  }

  // Process each video folder
  const progress = progressBar.createMultiBar(videoFolders.length, {
    name: "Processing Videos",
  });

  for (const videoName of videoFolders) {
    const folderPath = path.join(screenshotsDir, videoName);
    const screenshots = fs
      .readdirSync(folderPath)
      .filter((file) => file.endsWith(".jpg"))
      .filter(
        (screenshot) =>
          !processedScreenshots.has(`${videoName}.mp4|${screenshot}`)
      );

    if (screenshots.length === 0) {
      console.log(
        `\nSkipping ${videoName} - all screenshots already processed`
      );
      progress.increment();
      continue;
    }

    console.log(
      `\nProcessing ${screenshots.length} screenshots for ${videoName}`
    );
    const analyses = [];

    // Process screenshots in batches
    for (
      let i = 0;
      i < screenshots.length;
      i += config.SCREENSHOT_PROCESSING.CONCURRENT_PROCESSING.SCREENSHOTS
    ) {
      const batch = screenshots.slice(
        i,
        i + config.SCREENSHOT_PROCESSING.CONCURRENT_PROCESSING.SCREENSHOTS
      );

      const batchAnalyses = await Promise.all(
        batch.map(async (screenshot) => {
          const imagePath = path.join(folderPath, screenshot);
          const imageBuffer = await fs.promises.readFile(imagePath);
          const analysis = await openaiService.analyzeScreenshot(
            imageBuffer.toString("base64")
          );
          return { screenshot, extracted_text: analysis };
        })
      );

      analyses.push(...batchAnalyses);
    }

    // Generate summary for all screenshots in this folder
    const summary = await openaiService.generateSummary(analyses);

    // Write results to CSV
    for (const analysis of analyses) {
      await csvService.writeRecords(writer, [
        {
          filename: `${videoName}.mp4`,
          screenshot: analysis.screenshot,
          extracted_text: analysis.extracted_text,
          summary,
          screenshot_products: await openaiService.generateCustomFieldContent(
            analysis.extracted_text,
            config.SCREENSHOT_PROCESSING.COLUMNS.OUTPUT.CUSTOM_FIELDS[0].prompt
          ),
        },
      ]);
    }

    progress.increment();
  }

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
