const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const path = require("path");
const fs = require("fs");
const config = require("../config");
const logger = require("./loggerService");

class FFmpegService {
  constructor() {
    ffmpeg.setFfmpegPath(ffmpegPath);
    this.screenshotsDir = path.join(
      __dirname,
      "..",
      config.FOLDERS.SCREENSHOTS
    );

    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
  }

  async extractSceneScreenshots(videoPath, outputFolder) {
    const videoName = path.parse(videoPath).name;
    const videoOutputFolder = path.join(outputFolder, videoName);

    // Check if folder exists and contains screenshots
    if (fs.existsSync(videoOutputFolder)) {
      const existingScreenshots = fs
        .readdirSync(videoOutputFolder)
        .filter((f) => f.endsWith(".jpg"));
      if (existingScreenshots.length > 0) {
        console.log(
          `\nSkipping ${videoName} - ${existingScreenshots.length} screenshots already exist`
        );
        return videoOutputFolder;
      }
    }

    if (!fs.existsSync(videoOutputFolder)) {
      fs.mkdirSync(videoOutputFolder, { recursive: true });
    }

    console.log(`\nProcessing video: ${videoPath}`);
    console.log(`Saving screenshots to: ${videoOutputFolder}`);

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .on("start", (command) => {
          console.log("\nFFmpeg command:", command);
        })
        .outputOptions([
          `-vf select='gt(scene,${config.SCREENSHOT_PROCESSING.SCENE_THRESHOLD})',scale=1280:-1`,
          "-vsync",
          "0",
          "-frame_pts",
          "1",
        ])
        .output(`${videoOutputFolder}/${videoName}-frame-%03d.jpg`)
        .on("end", () => {
          // Verify screenshots were created
          const screenshots = fs
            .readdirSync(videoOutputFolder)
            .filter((f) => f.endsWith(".jpg"));
          const screenshotCount = screenshots.length;

          if (screenshotCount === 0) {
            console.log(
              `\nNo screenshots generated for ${videoName}. Trying with lower threshold...`
            );
            // Try again with lower threshold if no screenshots were generated
            ffmpeg(videoPath)
              .outputOptions([
                `-vf select='gt(scene,0.1)',scale=1280:-1`,
                "-vsync",
                "0",
                "-frame_pts",
                "1",
              ])
              .output(`${videoOutputFolder}/${videoName}-frame-%03d.jpg`)
              .on("end", () => {
                const retryScreenshots = fs
                  .readdirSync(videoOutputFolder)
                  .filter((f) => f.endsWith(".jpg"));
                console.log(
                  `Created ${retryScreenshots.length} screenshots for ${videoName} with lower threshold`
                );
                resolve(videoOutputFolder);
              })
              .on("error", reject)
              .run();
          } else {
            console.log(
              `Created ${screenshotCount} screenshots for ${videoName}`
            );
            resolve(videoOutputFolder);
          }
        })
        .on("error", (err) => {
          console.error(`Error processing ${videoPath}: ${err.message}`);
          logger.error(`Error extracting screenshots: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }
}

module.exports = new FFmpegService();
