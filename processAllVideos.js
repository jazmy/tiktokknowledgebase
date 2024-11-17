// Import necessary modules and services
const config = require("./config");
const { spawn } = require("child_process");
const path = require("path");
const logger = require("./services/loggerService");
const ModelProviderFactory = require("./services/modelProviderFactory");
const fs = require("fs");
const csvParser = require("csv-parser");
const csvWriter = require("csv-writer").createObjectCsvWriter;

// Function to run a script using Node.js child process
async function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    // Spawn a new process to run the script
    const process = spawn("node", [scriptPath], { stdio: "inherit" });

    // Listen for the process to close and resolve or reject based on exit code
    process.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Script ${scriptPath} exited with code ${code}`));
      } else {
        resolve();
      }
    });

    // Handle any errors that occur during the process execution
    process.on("error", (err) => {
      reject(err);
    });
  });
}

// Function to create a combined analysis from multiple CSV files
async function createCombinedAnalysis() {
  logger.info("Creating combined analysis...");

  try {
    // Get all CSV output files except the combined one
    const csvFiles = Object.values(config.CSV.OUTPUT).filter(
      (file) => file !== config.CSV.OUTPUT.COMBINED
    );
    const combinedData = new Map(); // Map to store combined data
    let allHeaders = new Set(); // Set to store all unique headers

    logger.info("Processing CSV files:", csvFiles);

    // Iterate over each CSV file
    for (const csvFile of csvFiles) {
      // Check if the file exists
      if (!fs.existsSync(csvFile)) {
        logger.warn(`File not found: ${csvFile}`);
        continue;
      }

      // Read and parse the CSV file
      const records = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(csvFile)
          .pipe(csvParser())
          .on("data", (data) => results.push(data))
          .on("end", () => resolve(results))
          .on("error", (error) => reject(error));
      });

      logger.info(`Read ${records.length} records from ${csvFile}`);

      // Process each record in the CSV file
      for (const record of records) {
        const filename = record[Object.keys(record)[0]]; // Use the first column as filename
        if (!filename) {
          logger.warn(`No filename found in record from ${csvFile}`);
          continue;
        }

        // Initialize or update the combined data for the filename
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

    // Check if there is any data to write
    if (combinedData.size === 0) {
      logger.warn("No data to write to combined CSV");
      return;
    }

    // Convert headers set to array for CSV writing
    const headerArray = Array.from(allHeaders);

    // Prepare rows for CSV writing
    const outputRows = Array.from(combinedData.entries()).map(
      ([filename, data]) => {
        return headerArray.reduce((acc, header) => {
          acc[header] = data[header] || ""; // Ensure all headers are present
          return acc;
        }, {});
      }
    );

    logger.info("Preparing to write rows:", outputRows.length);

    // Write combined analysis to a new CSV file
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

// Main function to process all videos
async function processAllVideos() {
  try {
    // Verify and initialize the model provider
    const provider = config.PROCESSING_OPTIONS.MODEL_PROVIDER.toLowerCase();
    logger.info(`Initializing ${provider} model provider...`);

    const modelProvider = ModelProviderFactory.getProvider();
    await modelProvider.initialize();

    logger.info(`Successfully initialized ${provider} provider`);

    // Always create transcripts for videos
    logger.info("Creating video transcripts...");
    await runScript(path.join(__dirname, "createVideoTranscripts.js"));

    // Conditionally create and process screenshots based on configuration
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

    // Process the video transcripts
    logger.info("Processing video transcripts...");
    await runScript(path.join(__dirname, "processVideoTranscripts.js"));

    // Always create a combined analysis of the processed data
    await createCombinedAnalysis();

    logger.info("All processing completed successfully!");
    process.exit(0); // Exit the process with success code
  } catch (error) {
    logger.error(`Error in processing: ${error.message}`);
    process.exit(1); // Exit the process with error code
  }
}

// Start the video processing pipeline
processAllVideos();
