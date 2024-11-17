const path = require("path");
const config = require("../config");
const logger = require("../services/loggerService");
const ModelProviderFactory = require("../services/modelProviderFactory");
const modelProvider = ModelProviderFactory.getProvider();
const csvService = require("../services/csvService");
const progressBar = require("../utils/progressBar");
const pLimit = require("p-limit");

class TranscriptProcessor {
  constructor() {
    this.writer = csvService.createWriter(
      config.CSV.OUTPUT.GENAI,
      [
        {
          id: "filename",
          title: config.TRANSCRIPT_PROCESSING.COLUMNS.OUTPUT.FILENAME,
        },
        {
          id: "transcription",
          title: config.TRANSCRIPT_PROCESSING.COLUMNS.OUTPUT.TRANSCRIPT,
        },
        {
          id: "summary",
          title: config.TRANSCRIPT_PROCESSING.COLUMNS.OUTPUT.SUMMARY,
        },
        { id: "tags", title: config.TRANSCRIPT_PROCESSING.COLUMNS.OUTPUT.TAGS },
        {
          id: "needs_screenshots",
          title: config.TRANSCRIPT_PROCESSING.COLUMNS.OUTPUT.NEEDS_SCREENSHOTS,
        },
        ...config.TRANSCRIPT_PROCESSING.COLUMNS.OUTPUT.CUSTOM_FIELDS.map(
          (field) => ({
            id: field.name.toLowerCase().replace(/\s+/g, "_"),
            title: field.name,
          })
        ),
      ],
      false
    );

    this.limiter = pLimit(config.API_LIMITS.CONCURRENT_OPENAI_CALLS);
  }

  async processRow(row, processedCount, totalCount) {
    try {
      if (
        !row[config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.TRANSCRIPT] ||
        row[config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.TRANSCRIPT].length <
          config.TRANSCRIPT_PROCESSING.MIN_LENGTH
      ) {
        logger.info(
          `Skipping ${
            row[config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.FILENAME]
          } - transcription too short or empty`
        );
        return {
          filename: row[config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.FILENAME],
          transcription:
            row[config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.TRANSCRIPT],
          summary: "Transcription too short or empty",
          tags: "",
          needs_screenshots: "True",
          ...Object.fromEntries(
            config.TRANSCRIPT_PROCESSING.COLUMNS.OUTPUT.CUSTOM_FIELDS.map(
              (field) => [field.name.toLowerCase().replace(/\s+/g, "_"), ""]
            )
          ),
        };
      }

      try {
        const [summary, tags, needs_screenshots] = await Promise.all([
          modelProvider.generateSummary([
            {
              extracted_text:
                row[config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.TRANSCRIPT],
            },
          ]),
          modelProvider.generateCustomFieldContent(
            row[config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.TRANSCRIPT],
            config.TRANSCRIPT_PROCESSING.PROMPTS.TAGS
          ),
          modelProvider.generateCustomFieldContent(
            row[config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.TRANSCRIPT],
            config.TRANSCRIPT_PROCESSING.PROMPTS.NEEDS_SCREENSHOTS
          ),
        ]);

        const customFields = {};
        for (const field of config.TRANSCRIPT_PROCESSING.COLUMNS.OUTPUT
          .CUSTOM_FIELDS) {
          logger.info(
            `Generating ${field.name} for ${
              row[config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.FILENAME]
            }`
          );
          const content = await modelProvider.generateCustomFieldContent(
            row[config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.TRANSCRIPT],
            field.prompt
          );
          customFields[field.name.toLowerCase().replace(/\s+/g, "_")] = content;
        }

        logger.info(
          `Completed ${processedCount + 1}/${totalCount}: ${
            row[config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.FILENAME]
          }`
        );

        return {
          filename: row[config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.FILENAME],
          transcription:
            row[config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.TRANSCRIPT],
          summary,
          tags,
          needs_screenshots,
          ...customFields,
        };
      } catch (error) {
        logger.error(
          `Error processing with ${config.PROCESSING_OPTIONS.MODEL_PROVIDER}: ${error.message}`
        );
        return {
          filename: row[config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.FILENAME],
          transcription:
            row[config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.TRANSCRIPT],
          summary: `Error: ${error.message}`,
          tags: "Error generating tags",
          needs_screenshots: "True",
          ...Object.fromEntries(
            config.TRANSCRIPT_PROCESSING.COLUMNS.OUTPUT.CUSTOM_FIELDS.map(
              (field) => [
                field.name.toLowerCase().replace(/\s+/g, "_"),
                "Error generating content",
              ]
            )
          ),
        };
      }
    } catch (error) {
      logger.error(
        `Error processing ${
          row[config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.FILENAME]
        }: ${error.message}`
      );
      return {
        filename: row[config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.FILENAME],
        transcription:
          row[config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.TRANSCRIPT],
        summary: `Error: ${error.message}`,
        tags: "Error generating tags",
        needs_screenshots: "True",
        ...Object.fromEntries(
          config.TRANSCRIPT_PROCESSING.COLUMNS.OUTPUT.CUSTOM_FIELDS.map(
            (field) => [
              field.name.toLowerCase().replace(/\s+/g, "_"),
              "Error generating content",
            ]
          )
        ),
      };
    }
  }

  async processCSV() {
    const processedEntries = await csvService.getProcessedEntries(
      config.CSV.OUTPUT.GENAI,
      config.TRANSCRIPT_PROCESSING.COLUMNS.OUTPUT.FILENAME
    );

    const rows = await csvService.readCSV(config.CSV.INPUT.TRANSCRIPTS);

    const remainingRows = rows.filter(
      (row) =>
        !processedEntries.has(
          row[config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.FILENAME]
        )
    );

    logger.info(`Found ${rows.length} total rows`);
    logger.info(`${remainingRows.length} rows remaining to process`);

    const progress = progressBar.create(remainingRows.length, {
      name: "Processing",
    });

    const promises = remainingRows.map((row, index) =>
      this.limiter(async () => {
        const processedRow = await this.processRow(
          row,
          index,
          remainingRows.length
        );
        await csvService.writeRecords(this.writer, [processedRow]);
        progress.increment();
        return processedRow;
      })
    );

    await Promise.all(promises);

    progress.stop();
    logger.info("All transcripts processed");
    console.log("\n\x1b[32m%s\x1b[0m", "Done!");
    process.exit(0);
  }
}

module.exports = new TranscriptProcessor();
