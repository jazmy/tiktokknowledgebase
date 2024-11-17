module.exports = {
  PROCESSING_OPTIONS: {
    CREATE_SCREENSHOTS: true,
    MODEL_PROVIDER: "openai",
  },

  API_SETTINGS: {
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
    RATE_LIMIT_DELAY: 5000,
  },

  MODELS: {
    SUMMARY: "gpt-4o-mini",
    TAGS: "gpt-4o-mini",
    CUSTOM: "gpt-4o-mini",
    VISION: "gpt-4o-mini",
  },

  FOLDERS: {
    VIDEOS: "videos",
    SCREENSHOTS: "screenshots",
    AUDIO: "audio",
    CSV: "csv",
  },

  CSV: {
    INPUT: {
      SCREENSHOTS: "csv/transcription_processed.csv",
      TRANSCRIPTS: "csv/transcriptions.csv",
    },
    OUTPUT: {
      SCREENSHOTS: "csv/screenshots_processed.csv",
      TRANSCRIPTS: "csv/transcriptions.csv",
      GENAI: "csv/transcription_processed.csv",
      COMBINED: "csv/combined_analysis.csv",
    },
    SETTINGS: {
      ALWAYS_QUOTE: true,
      DELIMITER: ",",
    },
  },

  SCREENSHOT_PROCESSING: {
    SCENE_THRESHOLD: 0.3,
    VISION_PROMPT:
      "Extract all text from the image including captions, Product Names and any URLs. If there are no captions,products or URLs, just return N/A. Do not include any other text.",
    SUMMARY_PROMPT:
      "Based on all the extracted text from the video screenshots create a concise summary of the content.",
    MAX_TOKENS: 2000,
    CONCURRENT_PROCESSING: {
      VIDEOS: 10,
      SCREENSHOTS: 10,
    },
    COLUMNS: {
      INPUT: {
        FILENAME: "Filename",
        NEEDS_SCREENSHOTS: "Needs Screenshots",
      },
      OUTPUT: {
        FILENAME: "Filename",
        SCREENSHOT: "Screenshot",
        EXTRACTED_TEXT: "Extracted Text",
        SUMMARY: "Content Summary",
        CUSTOM_FIELDS: [
          {
            name: "Screenshot Products",
            prompt:
              "For each product add a colon and then a concise sentence on why it was recommended including the URL. If there is no URL, just add the product name. If this is no product, just add NA. Do not include any other text.",
          },
        ],
      },
    },
  },

  TRANSCRIPT_PROCESSING: {
    MIN_LENGTH: 10,
    MAX_TOKENS: {
      SUMMARY: 150,
      TAGS: 50,
      CUSTOM: 250,
    },
    TEMPERATURE: {
      SUMMARY: 0.7,
      TAGS: 0.7,
      CUSTOM: 0.7,
    },
    COLUMNS: {
      INPUT: {
        FILENAME: "Filename",
        TRANSCRIPT: "Transcription",
      },
      OUTPUT: {
        FILENAME: "Filename",
        TRANSCRIPT: "Transcription",
        SUMMARY: "Summary",
        TAGS: "Tags",
        NEEDS_SCREENSHOTS: "Needs Screenshots",
        CUSTOM_FIELDS: [
          {
            name: "Products",
            prompt:
              "Create a comma delimited list of products/solutions mentioned in the transcript, for each product/solution add a colon and then a concise sentence on why it was recommended.",
          },
        ],
      },
    },
    PROMPTS: {
      SUMMARY: "Please provide a brief summary of this transcript:",
      TAGS: "Based on this transcript, provide a comma-separated list of relevant tags (maximum 5 tags):",
      NEEDS_SCREENSHOTS:
        "If the transcript consists solely of mentions of music or the transcript does not include the name and URL of a product then respond with 'True', otherwise respond with 'False'",
    },
  },

  WHISPER_SETTINGS: {
    MODEL_NAME: "base.en",
    OPTIONS: {
      language: "en",
      task: "transcribe",
      gen_file_txt: false,
      gen_file_subtitle: false,
      gen_file_vtt: false,
      word_timestamps: false,
      beam_size: 1,
      temperature: 0,
    },
    AUDIO: {
      FREQUENCY: 16000,
      CHANNELS: 1,
    },
    RETRY: {
      MAX_ATTEMPTS: 3,
      DELAY: 5000,
    },
    CONCURRENT_PROCESSING: 10,
  },

  SUPPORTED_FORMATS: {
    VIDEO: [".mp4", ".avi", ".mov"],
    AUDIO: [".wav", ".mp3"],
  },

  LOGGING: {
    ERROR_LOG: "logs/error.log",
    COMBINED_LOG: "logs/combined.log",
    PROCESS_LOGS: {
      TRANSCRIPTS: "logs/transcripts.log",
      SCREENSHOTS: "logs/screenshots.log",
      GENAI: "logs/genai.log",
    },
    LEVEL: "info",
  },

  PROGRESS_BAR: {
    FORMAT: "{name} |" + "{bar}" + "| {percentage}% || {value}/{total} {unit}",
    CLEAR_ON_COMPLETE: false,
    HIDE_CURSOR: true,
  },

  API_LIMITS: {
    CONCURRENT_OPENAI_CALLS: 5,
  },
};
