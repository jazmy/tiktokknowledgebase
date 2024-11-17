const OpenAI = require("openai");
const config = require("../config.js");
const logger = require("./loggerService.js");
const path = require("path");
const dotenv = require("dotenv");
const pLimit = require("p-limit");

// Load environment variables from .env file
const envPath = path.join(__dirname, "..", ".env");
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error("\n\x1b[41m%s\x1b[0m", " ERROR: Could not load .env file! ");
  console.error("\x1b[33m%s\x1b[0m", "Error details:", result.error.message);
  process.exit(1);
}

class OpenAIService {
  async initialize() {
    if (!process.env.OPENAI_API_KEY) {
      console.error(
        "\n\x1b[41m%s\x1b[0m",
        " ERROR: OpenAI API key not found! "
      );
      console.error("\x1b[33m%s\x1b[0m", "Please check:");
      console.error("1. .env file exists at:", envPath);
      console.error("2. OPENAI_API_KEY is set in .env");
      console.error("3. .env file is in the correct directory");
      process.exit(1);
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Initialize rate limiter
    this.limiter = pLimit(config.API_LIMITS.CONCURRENT_OPENAI_CALLS);
  }

  async retryOperation(operation, operationName) {
    for (
      let attempt = 1;
      attempt <= config.API_SETTINGS.MAX_RETRIES;
      attempt++
    ) {
      try {
        return await operation();
      } catch (error) {
        if (error.response?.status === 429) {
          // Rate limit hit - wait longer
          await new Promise((resolve) =>
            setTimeout(resolve, config.API_SETTINGS.RATE_LIMIT_DELAY)
          );
        } else if (attempt < config.API_SETTINGS.MAX_RETRIES) {
          // Other error - use standard retry delay
          await new Promise((resolve) =>
            setTimeout(resolve, config.API_SETTINGS.RETRY_DELAY)
          );
        } else {
          throw this.handleOpenAIError(error, operationName);
        }
      }
    }
  }

  async analyzeScreenshot(base64Image) {
    return this.limiter(async () => {
      console.log(
        `\n🤖 Using OpenAI ${config.MODELS.VISION} for screenshot analysis`
      );
      return this.retryOperation(async () => {
        const response = await this.openai.chat.completions.create({
          model: config.MODELS.VISION,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: config.SCREENSHOT_PROCESSING.VISION_PROMPT,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                    detail: config.SCREENSHOT_PROCESSING.VISION_DETAIL,
                  },
                },
              ],
            },
          ],
          max_tokens: config.SCREENSHOT_PROCESSING.MAX_TOKENS,
          temperature: config.SCREENSHOT_PROCESSING.TEMPERATURE,
        });
        return response.choices[0].message.content.trim();
      }, "screenshot analysis");
    });
  }

  async generateSummary(analyses) {
    return this.limiter(async () => {
      console.log(
        `\n🤖 Using OpenAI ${config.MODELS.SUMMARY} for summary generation`
      );
      return this.retryOperation(async () => {
        const allText = analyses.map((a) => a.extracted_text).join("\n\n");
        const response = await this.openai.chat.completions.create({
          model: config.MODELS.SUMMARY,
          messages: [
            {
              role: "user",
              content: `${config.SCREENSHOT_PROCESSING.SUMMARY_PROMPT}\n\nExtracted Text from Screenshots:\n${allText}`,
            },
          ],
          max_tokens: config.TRANSCRIPT_PROCESSING.MAX_TOKENS.SUMMARY,
          temperature: config.TRANSCRIPT_PROCESSING.TEMPERATURE.SUMMARY,
        });

        return response.choices[0].message.content.trim();
      }, "summary generation");
    });
  }

  async generateCustomFieldContent(extractedText, fieldPrompt) {
    return this.limiter(async () => {
      console.log(
        `\n🤖 Using OpenAI ${config.MODELS.CUSTOM} for custom field generation`
      );
      return this.retryOperation(async () => {
        const response = await this.openai.chat.completions.create({
          model: config.MODELS.CUSTOM,
          messages: [
            {
              role: "user",
              content: `${fieldPrompt}\n\nExtracted Text: ${extractedText}`,
            },
          ],
          max_tokens: config.TRANSCRIPT_PROCESSING.MAX_TOKENS.CUSTOM,
          temperature: config.TRANSCRIPT_PROCESSING.TEMPERATURE.CUSTOM,
        });

        return response.choices[0].message.content.trim();
      }, "custom field generation");
    });
  }

  handleOpenAIError(error, operation) {
    if (error.response?.status === 401) {
      console.error("\n\x1b[41m%s\x1b[0m", " ERROR: Invalid OpenAI API key ");
      console.error(
        "\x1b[33m%s\x1b[0m",
        "Please check your API key in .env file"
      );
      process.exit(1);
    } else if (error.response?.status === 429) {
      console.error(
        "\n\x1b[41m%s\x1b[0m",
        " ERROR: OpenAI API rate limit exceeded "
      );
      console.error(
        "\x1b[33m%s\x1b[0m",
        "Please wait a few minutes and try again"
      );
      process.exit(1);
    } else if (error.response?.status === 500) {
      console.error("\n\x1b[41m%s\x1b[0m", " ERROR: OpenAI API server error ");
      console.error("\x1b[33m%s\x1b[0m", "Please try again later");
      process.exit(1);
    }
    logger.error(`Error during ${operation}: ${error.message}`);
    return error;
  }
}

// Create and initialize the service
const service = new OpenAIService();
service.initialize();

module.exports = service;
