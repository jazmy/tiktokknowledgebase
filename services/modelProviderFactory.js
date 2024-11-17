const config = require("../config");
const openaiService = require("./openaiService");

class ModelProviderFactory {
  static getProvider() {
    const provider = config.PROCESSING_OPTIONS.MODEL_PROVIDER.toLowerCase();

    if (provider !== "openai") {
      throw new Error(
        `Unsupported model provider: ${provider}. Only 'openai' is supported.`
      );
    }
    return openaiService;
  }
}

module.exports = ModelProviderFactory;
