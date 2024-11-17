const fs = require("fs");
const path = require("path");
const config = require("../config");
const logger = require("../services/loggerService");
const openaiService = require("../services/openaiService");
const csvService = require("../services/csvService");
const progressBar = require("../utils/progressBar");

class ScreenshotProcessor {
  constructor() {
    this.baseHeaders = [
      { id: "filename", title: "Filename" },
      { id: "screenshot", title: "Screenshot" },
      { id: "extracted_text", title: "Extracted Text" },
      { id: "summary", title: "Content Summary" },
    ];

    this.customFieldHeaders =
      config.SCREENSHOT_PROCESSING.COLUMNS.OUTPUT.CUSTOM_FIELDS.map(
        (field) => ({
          id: field.id || field.name.toLowerCase().replace(/\s+/g, "_"),
          title: field.name,
        })
      );
  }

  async readInputCSV() {
    const rows = [];
    const inputCsvPath = path.join(__dirname, "..", config.CSV.OUTPUT.GENAI);
    const screenshotsDir = path.join(
      __dirname,
      "..",
      config.FOLDERS.SCREENSHOTS
    );
    const outputCsvPath = path.join(
      __dirname,
      "..",
      config.CSV.OUTPUT.SCREENSHOTS
    );

    console.log("\nLooking for input CSV file:", inputCsvPath);
    console.log("Looking for screenshots in:", screenshotsDir);
    console.log("Checking for existing output file:", outputCsvPath);

    // Track processed screenshots using combination of filename and screenshot
    const processedScreenshots = new Set();
    if (fs.existsSync(outputCsvPath)) {
      console.log("Found existing output file, checking processed entries...");
      const processedEntries = await csvService.readCSV(outputCsvPath);
      processedEntries.forEach((row) => {
        const key = `${row.Filename}|${row.Screenshot}`;
        processedScreenshots.add(key);
      });
      console.log(
        `Found ${processedScreenshots.size} already processed screenshots`
      );
    }

    const inputRows = await csvService.readCSV(inputCsvPath);
    for (const row of inputRows) {
      if (row["Needs Screenshots"]?.toLowerCase() === "true") {
        const videoName = path.parse(row.Filename).name;
        const screenshotFolder = path.join(screenshotsDir, videoName);

        console.log(`\nChecking ${videoName} (Needs Screenshots: True):`);

        if (fs.existsSync(screenshotFolder)) {
          const allScreenshots = fs
            .readdirSync(screenshotFolder)
            .filter((file) => file.endsWith(".jpg"));

          const unprocessedScreenshots = allScreenshots.filter(
            (screenshot) =>
              !processedScreenshots.has(`${row.Filename}|${screenshot}`)
          );

          if (unprocessedScreenshots.length > 0) {
            console.log(
              `Found ${
                unprocessedScreenshots.length
              } new screenshots to analyze (${
                allScreenshots.length - unprocessedScreenshots.length
              } already processed)`
            );
            rows.push({
              filename: row.Filename,
              screenshotFolder,
              screenshots: unprocessedScreenshots,
            });
          } else {
            console.log(
              `All ${allScreenshots.length} screenshots already processed`
            );
          }
        } else {
          console.log(
            "Screenshot folder not found - may need to run createVideoScreenshots first"
          );
        }
      } else {
        console.log(`\nSkipping ${row.Filename} (Needs Screenshots: False)`);
      }
    }

    const totalScreenshots = rows.reduce(
      (sum, row) => sum + row.screenshots.length,
      0
    );
    console.log(`\nTotal new screenshots to analyze: ${totalScreenshots}`);

    if (rows.length === 0) {
      console.log("\nNo new screenshots to process!");
      process.exit(0);
    }

    console.log(
      "\nVideos with unprocessed screenshots:",
      rows.map((r) => `${r.filename} (${r.screenshots.length} screenshots)`)
    );
    return rows;
  }

  async processVideos() {
    const foldersToProcess = await this.readInputCSV();
    logger.info(
      `Found ${foldersToProcess.length} new folders with screenshots to analyze`
    );

    if (foldersToProcess.length === 0) {
      console.log(
        "\n\x1b[32m%s\x1b[0m",
        "Done! No new screenshots to process."
      );
      process.exit(0);
    }

    const totalProgress = progressBar.createMultiBar(foldersToProcess.length, {
      name: "Remaining Videos",
    });

    const writer = csvService.createWriter(
      config.CSV.OUTPUT.SCREENSHOTS,
      [...this.baseHeaders, ...this.customFieldHeaders],
      fs.existsSync(path.join(__dirname, "..", config.CSV.OUTPUT.SCREENSHOTS))
    );

    try {
      for (
        let i = 0;
        i < foldersToProcess.length;
        i += config.SCREENSHOT_PROCESSING.CONCURRENT_PROCESSING.VIDEOS
      ) {
        const batch = foldersToProcess.slice(
          i,
          i + config.SCREENSHOT_PROCESSING.CONCURRENT_PROCESSING.VIDEOS
        );

        await Promise.all(
          batch.map(async ({ filename, screenshotFolder, screenshots }) => {
            try {
              logger.info(
                `Processing ${screenshots.length} screenshots for ${filename}`
              );
              const analyses = [];

              for (
                let j = 0;
                j < screenshots.length;
                j +=
                  config.SCREENSHOT_PROCESSING.CONCURRENT_PROCESSING.SCREENSHOTS
              ) {
                const screenshotBatch = screenshots.slice(
                  j,
                  j +
                    config.SCREENSHOT_PROCESSING.CONCURRENT_PROCESSING
                      .SCREENSHOTS
                );

                const batchAnalyses = await Promise.all(
                  screenshotBatch.map(async (screenshot) => {
                    const imagePath = path.join(screenshotFolder, screenshot);
                    const imageBuffer = await fs.promises.readFile(imagePath);
                    const analysis = await openaiService.analyzeScreenshot(
                      imageBuffer.toString("base64")
                    );
                    return { screenshot, extracted_text: analysis };
                  })
                );

                analyses.push(...batchAnalyses);
              }

              const summary = await openaiService.generateSummary(analyses);

              for (const analysis of analyses) {
                await csvService.writeRecords(writer, [
                  {
                    filename,
                    screenshot: analysis.screenshot,
                    extracted_text: analysis.extracted_text,
                    summary,
                    screenshot_products:
                      await openaiService.generateCustomFieldContent(
                        analysis.extracted_text,
                        config.SCREENSHOT_PROCESSING.COLUMNS.OUTPUT
                          .CUSTOM_FIELDS[0].prompt
                      ),
                  },
                ]);
              }

              logger.info(`Completed analysis for ${filename}`);
            } catch (error) {
              logger.error(`Failed to process ${filename}: ${error.message}`);
            }
          })
        );

        totalProgress.increment(batch.length);
      }

      progressBar.stop();
      logger.info("Screenshot analysis completed successfully");
      console.log("\n\x1b[32m%s\x1b[0m", "Done!");
      process.exit(0);
    } catch (error) {
      progressBar.stop();
      logger.error("Error in main process:", error);
      console.log("\n\x1b[31m%s\x1b[0m", "Error! Check logs for details.");
      process.exit(1);
    }
  }
}

module.exports = new ScreenshotProcessor();
