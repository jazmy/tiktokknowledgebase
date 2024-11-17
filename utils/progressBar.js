const cliProgress = require("cli-progress");
const config = require("../config");

class ProgressBarManager {
  constructor() {
    this.multibar = new cliProgress.MultiBar(
      {
        clearOnComplete: config.PROGRESS_BAR.CLEAR_ON_COMPLETE,
        hideCursor: config.PROGRESS_BAR.HIDE_CURSOR,
        format: config.PROGRESS_BAR.FORMAT.replace("{unit}", "Videos"),
      },
      cliProgress.Presets.shades_classic
    );
  }

  create(total, options = {}) {
    return this.multibar.create(total, 0, options);
  }

  createMultiBar(total, options = {}) {
    return this.multibar.create(total, 0, {
      name: options.name || "Progress",
      total,
    });
  }

  createSingle(options = {}) {
    return new cliProgress.SingleBar(
      {
        clearOnComplete: config.PROGRESS_BAR.CLEAR_ON_COMPLETE,
        hideCursor: config.PROGRESS_BAR.HIDE_CURSOR,
        format: config.PROGRESS_BAR.FORMAT.replace("{unit}", "Videos"),
        ...options,
      },
      cliProgress.Presets.shades_classic
    );
  }

  stop() {
    this.multibar.stop();
  }
}

module.exports = new ProgressBarManager();
