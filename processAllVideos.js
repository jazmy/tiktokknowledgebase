const config = require("./config");
const { spawn } = require("child_process");
const path = require("path");
const logger = require("./services/loggerService");
const csvService = require("./services/csvService");
const ModelProviderFactory = require("./services/modelProviderFactory");
const fs = require("fs");
const csvParser = require("csv-parser");
const csvWriter = require("csv-writer").createObjectCsvWriter;

async function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const process = spawn("node", [scriptPath], { stdio: "inherit" });

    process.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Script ${scriptPath} exited with code ${code}`));
      } else {
        resolve();
      }
    });

    process.on("error", (err) => {
      reject(err);
    });
  });
}

async function createCombinedAnalysis() {
  logger.info("Creating combined analysis...");

  try {
    const csvFiles = Object.values(config.CSV.OUTPUT).filter(
      (file) => file !== config.CSV.OUTPUT.COMBINED
    );
    const combinedData = new Map();
    let allHeaders = new Set();

    logger.info("Processing CSV files:", csvFiles);

    // Process each CSV file
    for (const csvFile of csvFiles) {
      if (!fs.existsSync(csvFile)) {
        logger.warn(`File not found: ${csvFile}`);
        continue;
      }

      const records = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(csvFile)
          .pipe(csvParser())
          .on("data", (data) => results.push(data))
          .on("end", () => resolve(results))
          .on("error", (error) => reject(error));
      });

      logger.info(`Read ${records.length} records from ${csvFile}`);

      // Process each record
      for (const record of records) {
        const filename = record[Object.keys(record)[0]]; // Use the first column as filename
        if (!filename) {
          logger.warn(`No filename found in record from ${csvFile}`);
          continue;
        }

        if (!combinedData.has(filename)) {
          combinedData.set(filename, {});
        }

        const existingData = combinedData.get(filename);
        combinedData.set(filename, { ...existingData, ...record });

        // Add all fields from the record to the headers set
        Object.keys(record).forEach((key) => allHeaders.add(key));
      }
    }

    logger.info(
      "Data processing completed. Total records found:",
      combinedData.size
    );

    if (combinedData.size === 0) {
      logger.warn("No data to write to combined CSV");
      return;
    }

    // Convert headers set to array
    const headerArray = Array.from(allHeaders);

    // Prepare rows for CSV writing
    const outputRows = Array.from(combinedData.entries()).map(
      ([filename, data]) => {
        return headerArray.reduce((acc, header) => {
          acc[header] = data[header] || "";
          return acc;
        }, {});
      }
    );

    logger.info("Preparing to write rows:", outputRows.length);

    // Write combined analysis to CSV
    const writer = csvWriter({
      path: config.CSV.OUTPUT.COMBINED,
      header: headerArray.map((header) => ({ id: header, title: header })),
    });

    await writer.writeRecords(outputRows);
    logger.info("Combined analysis created successfully");
  } catch (error) {
    logger.error("Error creating combined analysis:", error);
    throw error;
  }
}

async function processAllVideos() {
  try {
    // Verify model provider is available
    const provider = config.PROCESSING_OPTIONS.MODEL_PROVIDER.toLowerCase();
    logger.info(`Initializing ${provider} model provider...`);

    const modelProvider = ModelProviderFactory.getProvider();
    await modelProvider.initialize();

    logger.info(`Successfully initialized ${provider} provider`);

    // Always create transcripts
    logger.info("Creating video transcripts...");
    await runScript(path.join(__dirname, "createVideoTranscripts.js"));

    // Only create and process screenshots if enabled in config
    if (config.PROCESSING_OPTIONS.CREATE_SCREENSHOTS) {
      logger.info("Creating video screenshots...");
      await runScript(path.join(__dirname, "createAllVideoScreenshots.js"));

      logger.info("Processing video screenshots...");
      await runScript(path.join(__dirname, "processVideoScreenshots.js"));
    } else {
      logger.info(
        "Screenshot creation and processing skipped based on configuration"
      );
    }

    logger.info("Processing video transcripts...");
    await runScript(path.join(__dirname, "processVideoTranscripts.js"));

    // Always create combined analysis
    await createCombinedAnalysis();

    logger.info("All processing completed successfully!");
    process.exit(0);
  } catch (error) {
    logger.error(`Error in processing: ${error.message}`);
    process.exit(1);
  }
}

processAllVideos();
