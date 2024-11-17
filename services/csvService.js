const fs = require("fs");
const path = require("path");
const csvParser = require("csv-parser");
const csvWriter = require("csv-writer").createObjectCsvWriter;
const config = require("../config");
const logger = require("./loggerService");

class CSVService {
  constructor() {
    this.rootDir = path.join(__dirname, "..");
    this.csvDir = path.join(this.rootDir, config.FOLDERS.CSV);
    if (!fs.existsSync(this.csvDir)) {
      fs.mkdirSync(this.csvDir, { recursive: true });
    }
  }

  createWriter(outputPath, headers, append = false) {
    const fullPath = path.isAbsolute(outputPath)
      ? outputPath
      : path.join(this.rootDir, outputPath);

    return csvWriter({
      path: fullPath,
      header: headers,
      alwaysQuote: config.CSV.SETTINGS.ALWAYS_QUOTE,
      append: append,
    });
  }

  async readCSV(filePath) {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.rootDir, filePath);

    const rows = [];
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(fullPath)) {
        reject(new Error(`CSV file not found: ${fullPath}`));
        return;
      }

      fs.createReadStream(fullPath)
        .pipe(csvParser())
        .on("data", (row) => rows.push(row))
        .on("end", () => resolve(rows))
        .on("error", reject);
    });
  }

  async getProcessedEntries(filePath, filenameColumn) {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.rootDir, filePath);

    const processedEntries = new Set();
    if (fs.existsSync(fullPath)) {
      await new Promise((resolve) => {
        fs.createReadStream(fullPath)
          .pipe(csvParser())
          .on("data", (row) => processedEntries.add(row[filenameColumn]))
          .on("end", resolve);
      });
    }
    return processedEntries;
  }

  async getHeadersFromCSV(csvPath) {
    const fullPath = path.isAbsolute(csvPath)
      ? csvPath
      : path.join(this.rootDir, csvPath);

    return new Promise((resolve, reject) => {
      const headers = [];
      if (!fs.existsSync(fullPath)) {
        reject(new Error(`CSV file not found: ${fullPath}`));
        return;
      }

      fs.createReadStream(fullPath)
        .pipe(csvParser())
        .on("headers", (headerRow) => {
          headers.push(...headerRow);
        })
        .on("end", () => resolve(headers))
        .on("error", reject)
        .on("data", () => {}); // Drain the data
    });
  }

  async checkNeedsScreenshots() {
    const fullPath = path.join(this.rootDir, config.CSV.OUTPUT.GENAI);
    return new Promise((resolve, reject) => {
      let hasScreenshots = false;
      if (!fs.existsSync(fullPath)) {
        reject(new Error(`CSV file not found: ${fullPath}`));
        return;
      }

      fs.createReadStream(fullPath)
        .pipe(csvParser())
        .on("data", (row) => {
          if (row["Needs Screenshots"]?.toLowerCase() === "true") {
            hasScreenshots = true;
          }
        })
        .on("end", () => {
          resolve(hasScreenshots);
        })
        .on("error", (error) => {
          reject(error);
        });
    });
  }

  async writeRecords(writer, records) {
    try {
      await writer.writeRecords(records);
    } catch (error) {
      logger.error(`Error writing CSV records: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new CSVService();
