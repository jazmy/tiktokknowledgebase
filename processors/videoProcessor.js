const { exec, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const config = require("../config");
const logger = require("../services/loggerService");
const csvService = require("../services/csvService");

class VideoProcessor {
  async executeScript(scriptName, waitForExit = false) {
    return new Promise((resolve, reject) => {
      console.log(`\nStarting ${scriptName}...`);
      const child = spawn("node", [scriptName], {
        stdio: "inherit",
      });

      child.on("exit", (code) => {
        if (code === 0) {
          console.log(`\n${scriptName} completed successfully`);
          resolve();
        } else {
          reject(new Error(`Command failed: node ${scriptName}`));
        }
      });

      child.on("error", (err) => {
        reject(new Error(`Error executing ${scriptName}: ${err.message}`));
      });
    });
  }

  async combineCSVs() {
    console.log(
      "\n\x1b[36m%s\x1b[0m",
      "Creating combined analysis spreadsheet..."
    );

    const combinedData = new Map();
    const csvFiles = {
      processed: path.join(__dirname, "..", config.CSV.OUTPUT.GENAI),
      screenshots: path.join(__dirname, "..", config.CSV.OUTPUT.SCREENSHOTS),
    };

    // Get headers from each file
    const headers = new Set();
    for (const [key, filepath] of Object.entries(csvFiles)) {
      if (fs.existsSync(filepath)) {
        console.log(`Reading headers from ${key}...`);
        const fileHeaders = await csvService.getHeadersFromCSV(filepath);
        fileHeaders.forEach((header) => headers.add(header));
      }
    }

    console.log("\nFound columns:", Array.from(headers));

    // Create header configuration for CSV writer
    const headerConfig = Array.from(headers).map((header) => ({
      id: header.toLowerCase().replace(/\s+/g, "_"),
      title: header,
    }));

    // Read and combine data from all files
    for (const [fileType, filepath] of Object.entries(csvFiles)) {
      if (fs.existsSync(filepath)) {
        console.log(`\nProcessing ${fileType}...`);
        const rows = await csvService.readCSV(filepath);
        rows.forEach((row) => {
          const existing = combinedData.get(row.Filename) || {};
          combinedData.set(row.Filename, {
            ...existing,
            ...Object.fromEntries(
              Object.entries(row).map(([key, value]) => [
                key.toLowerCase().replace(/\s+/g, "_"),
                value,
              ])
            ),
          });
        });
      }
    }

    // Write combined data
    const combinedWriter = csvService.createWriter(
      config.CSV.OUTPUT.COMBINED || "csv/combined_analysis.csv",
      headerConfig
    );

    await csvService.writeRecords(
      combinedWriter,
      Array.from(combinedData.values())
    );
    console.log(
      "\x1b[32m%s\x1b[0m",
      "Combined analysis spreadsheet created successfully!"
    );
  }

  async processAll() {
    try {
      // Step 1: Create transcripts
      console.log("\n\x1b[35m%s\x1b[0m", "STEP 1: Creating Transcripts");
      await this.executeScript("createVideoTranscripts.js", true);

      // Wait a moment to ensure file system sync
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 2: Process transcripts
      console.log("\n\x1b[35m%s\x1b[0m", "STEP 2: Processing Transcripts");
      await this.executeScript("processVideoTranscripts.js", true);

      // Check if any videos need screenshots
      const needsScreenshots = await csvService.checkNeedsScreenshots();

      if (needsScreenshots) {
        // Step 3: Create screenshots
        console.log("\n\x1b[35m%s\x1b[0m", "STEP 3: Creating Screenshots");
        await this.executeScript("createVideoScreenshots.js", true);

        // Step 4: Process screenshots
        console.log("\n\x1b[35m%s\x1b[0m", "STEP 4: Processing Screenshots");
        await this.executeScript("processVideoScreenshots.js", true);
      } else {
        console.log(
          "\n\x1b[33m%s\x1b[0m",
          "No videos need screenshots. Processing complete."
        );
      }

      // Add combined analysis step at the end
      console.log(
        "\n\x1b[35m%s\x1b[0m",
        "FINAL STEP: Creating Combined Analysis"
      );
      await this.combineCSVs();

      // Final success message
      console.log(
        "\n\x1b[42m\x1b[30m%s\x1b[0m",
        " All processing completed successfully! "
      );
      process.exit(0);
    } catch (error) {
      console.error(
        "\n\x1b[41m\x1b[37m%s\x1b[0m",
        " Error in processing pipeline "
      );
      console.error("\x1b[31m%s\x1b[0m", error.message);
      process.exit(1);
    }
  }
}

module.exports = new VideoProcessor();
