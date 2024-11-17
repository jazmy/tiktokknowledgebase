const fs = require("fs");
const path = require("path");
const csvWriter = require("csv-writer").createObjectCsvWriter;
const csvParser = require("csv-parser");
const whisper = require("whisper-node").default;
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const config = require("./config");
const winston = require("winston");
const cliProgress = require("cli-progress");
const colors = require("ansi-colors");
ffmpeg.setFfmpegPath(ffmpegPath);

// Create necessary directories first
const logsDir = path.join(__dirname, "logs");
const csvDir = path.join(__dirname, config.FOLDERS.CSV);

[logsDir, csvDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Initialize logger with correct paths
const logger = winston.createLogger({
  level: config.LOGGING.LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, config.LOGGING.PROCESS_LOGS.TRANSCRIPTS),
    }),
    new winston.transports.File({
      filename: path.join(__dirname, config.LOGGING.COMBINED_LOG),
    }),
    new winston.transports.File({
      filename: path.join(__dirname, config.LOGGING.ERROR_LOG),
      level: "error",
    }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

// File paths from config
const inputFolder = path.join(__dirname, config.FOLDERS.VIDEOS);
const audioFolder = path.join(__dirname, config.FOLDERS.AUDIO);
const outputCsv = path.join(__dirname, config.CSV.OUTPUT.TRANSCRIPTS);

// Whisper options from config
const options = {
  modelName: config.WHISPER_SETTINGS.MODEL_NAME,
  whisperOptions: config.WHISPER_SETTINGS.OPTIONS,
};

const MAX_RETRIES = config.WHISPER_SETTINGS.RETRY.MAX_ATTEMPTS;
const RETRY_DELAY = config.WHISPER_SETTINGS.RETRY.DELAY;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function transcribeAudioWithRetry(audioPath, retries = 0) {
  try {
    return await transcribeAudio(audioPath);
  } catch (error) {
    if (retries < MAX_RETRIES) {
      logger.info(`Retry attempt ${retries + 1} for ${audioPath}`);
      await sleep(RETRY_DELAY);
      return transcribeAudioWithRetry(audioPath, retries + 1);
    }
    throw error;
  }
}

// Ensure the audio folder exists
if (!fs.existsSync(audioFolder)) {
  fs.mkdirSync(audioFolder, { recursive: true });
}

// CSV writer configuration
const csvWriterInstance = csvWriter({
  path: outputCsv,
  header: [
    {
      id: "filename",
      title: config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.FILENAME,
    },
    {
      id: "transcription",
      title: config.TRANSCRIPT_PROCESSING.COLUMNS.INPUT.TRANSCRIPT,
    },
  ],
  alwaysQuote: config.CSV.SETTINGS.ALWAYS_QUOTE,
  append: fs.existsSync(outputCsv),
});

async function convertVideoToAudio(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .audioFrequency(config.WHISPER_SETTINGS.AUDIO.FREQUENCY)
      .audioChannels(config.WHISPER_SETTINGS.AUDIO.CHANNELS)
      .output(audioPath)
      .on("end", () => {
        logger.info(`Audio conversion completed: ${audioPath}`);
        resolve(audioPath);
      })
      .on("error", (err) => {
        logger.error(
          `An error occurred during audio conversion: ${err.message}`
        );
        reject(err);
      })
      .run();
  });
}

async function transcribeAudio(audioPath) {
  try {
    const result = await whisper(audioPath, options);
    if (!result) {
      throw new Error("Transcription result is null or undefined");
    }
    if (!Array.isArray(result)) {
      throw new Error("Transcription result is not an array");
    }
    return result
      .map((item) => item.speech)
      .join(" ")
      .trim();
  } catch (error) {
    logger.error(`Error in transcribeAudio for ${audioPath}:`, error);
    throw error;
  }
}

// Helper function to process chunks of videos
async function processVideoChunk(videos, startIdx, chunkSize) {
  const chunk = videos.slice(startIdx, startIdx + chunkSize);
  return Promise.all(chunk.map(processOneVideo));
}

async function processOneVideo(video) {
  if (processedFiles.has(video)) {
    logger.info(`Skipping ${video} as it has already been processed.`);
    return;
  }

  const videoPath = path.join(inputFolder, video);
  const audioPath = path.join(audioFolder, `${path.parse(video).name}.wav`);

  try {
    // Check if audio file already exists
    if (!fs.existsSync(audioPath)) {
      // Convert to audio only if it doesn't exist
      await convertVideoToAudio(videoPath, audioPath);
      logger.info(`Audio file created at: ${audioPath}`);
    } else {
      logger.info(`Using existing audio file: ${audioPath}`);
    }

    // Transcribe
    const transcription = await transcribeAudioWithRetry(audioPath);

    // Write to CSV
    await csvWriterInstance.writeRecords([{ filename: video, transcription }]);
    processedFiles.add(video);
    logger.info(`Transcribed and saved: ${video}`);
  } catch (error) {
    logger.error(`Error processing ${video} after all retries:`, error);
  }
}

async function processVideos() {
  const videos = fs
    .readdirSync(inputFolder)
    .filter((file) =>
      config.SUPPORTED_FORMATS.VIDEO.includes(path.extname(file).toLowerCase())
    );

  const totalVideos = videos.length;
  logger.info(`Found ${totalVideos} videos to process`);

  // Create a single progress bar
  const progressBar = new cliProgress.SingleBar(
    {
      format: `{name} |{bar}| {percentage}% || {value}/{total} Videos`,
      barCompleteChar: "█",
      barIncompleteChar: "░",
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic
  );

  // Start the progress bar
  progressBar.start(totalVideos, 0, {
    name: "Progress",
  });

  // First, increment for already processed files
  const alreadyProcessed = videos.filter((video) =>
    processedFiles.has(video)
  ).length;
  progressBar.update(alreadyProcessed);

  // Process remaining videos in chunks
  for (
    let i = 0;
    i < videos.length;
    i += config.WHISPER_SETTINGS.CONCURRENT_PROCESSING
  ) {
    logger.info(
      `Processing batch ${
        Math.floor(i / config.WHISPER_SETTINGS.CONCURRENT_PROCESSING) + 1
      }`
    );
    await processVideoChunk(
      videos,
      i,
      config.WHISPER_SETTINGS.CONCURRENT_PROCESSING
    );
    // Only increment for newly processed files
    const newlyProcessed = videos
      .slice(i, i + config.WHISPER_SETTINGS.CONCURRENT_PROCESSING)
      .filter((video) => !processedFiles.has(video)).length;
    if (newlyProcessed > 0) {
      progressBar.increment(newlyProcessed);
    }
  }

  progressBar.stop();
  logger.info(`All transcriptions completed. Results saved in ${outputCsv}`);
  console.log("\n\x1b[32m%s\x1b[0m", "Done!");
  process.exit(0);
}

// Read existing CSV and start processing
const processedFiles = new Set();
if (fs.existsSync(outputCsv)) {
  fs.createReadStream(outputCsv)
    .pipe(csvParser())
    .on("data", (row) => {
      // Fix the case sensitivity issue with the filename field
      processedFiles.add(row.filename || row.Filename);
    })
    .on("end", () => {
      logger.info("CSV file read successfully");
      processVideos().catch((error) => logger.error(error));
    });
} else {
  processVideos().catch((error) => logger.error(error));
}
