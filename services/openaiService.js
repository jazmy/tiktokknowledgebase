const OpenAI = require("openai");
const config = require("../config");
const logger = require("./loggerService");
const path = require("path");
const dotenv = require("dotenv");

// Load environment variables from .env file
const envPath = path.join(__dirname, "..", ".env");
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error("\n\x1b[41m%s\x1b[0m", " ERROR: Could not load .env file! ");
  console.error("\x1b[33m%s\x1b[0m", "Error details:", result.error.message);
  process.exit(1);
}

class OpenAIService {
  constructor() {
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
  }

  async analyzeScreenshot(base64Image) {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: config.SCREENSHOT_PROCESSING.VISION_PROMPT,
              },
              {
                type: "image",
                image_url: `data:image/jpeg;base64,${base64Image}`,
              },
            ],
          },
        ],
        max_tokens: 500,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      throw this.handleOpenAIError(error, "screenshot analysis");
    }
  }

  async generateSummary(analyses) {
    try {
      const allText = analyses.map((a) => a.extracted_text).join("\n\n");
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "user",
            content: `${config.SCREENSHOT_PROCESSING.SUMMARY_PROMPT}\n\nExtracted Text from Screenshots:\n${allText}`,
          },
        ],
        max_tokens: config.SCREENSHOT_PROCESSING.MAX_TOKENS,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      logger.error(`Error generating summary: ${error.message}`);
      return "Error generating summary";
    }
  }

  async generateCustomFieldContent(extractedText, fieldPrompt) {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "user",
            content: `${fieldPrompt}\n\nExtracted Text: ${extractedText}`,
          },
        ],
        max_tokens: 500,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      logger.error(`Error generating custom field content: ${error.message}`);
      return "Error generating content";
    }
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

module.exports = new OpenAIService();
