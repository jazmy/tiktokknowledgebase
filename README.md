# Video Processing Pipeline Configuration Guide

## Initial Setup

1. Clone the repository:

   ```sh
   git clone git@github.com:jazmy/tiktokknowledgebase.git
   cd tiktokknowledgebase
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Install Whisper and download the base.en model:

   ```sh
   npx whisper-node download
   ```

press enter to download the base.en as default

4. Rename .env-example to .env and paste in your OpenAI API key

5. Update the configuration file:

   The configuration parameters are defined in the `config.js` file. Below is a description of each parameter:

6. Place all your videos into the "videos" folder.

7. Run the video processing pipeline:

   ```sh
   node processAllVideos.js
   ```

## Configuration Parameters

The configuration parameters are defined in the `config.js` file. Below is a detailed description of each section:

### API Settings

- `API_SETTINGS.MAX_RETRIES`: Number of retry attempts for failed API calls (default: 3)
- `API_SETTINGS.RETRY_DELAY`: Delay in milliseconds between retry attempts (default: 2000ms)
- `API_SETTINGS.RATE_LIMIT_DELAY`: Delay for rate limiting in milliseconds (default: 5000ms)

### AI Models

- `MODELS`: Specifies which AI models to use for different processing tasks:
  - `SUMMARY`: Model for generating content summaries
  - `TAGS`: Model for generating content tags
  - `CUSTOM`: Model for custom analysis tasks
  - `VISION`: Model for image analysis

### Directory Structure

- `FOLDERS`: Defines the working directories:
  - `VIDEOS`: Directory for source video files (default: "./videos")
  - `SCREENSHOTS`: Directory for extracted video screenshots (default: "./screenshots")
  - `AUDIO`: Directory for extracted audio files (default: "./audio")
  - `CSV`: Directory for CSV output files (default: "./csv")

### CSV Configuration

- `CSV.INPUT`: Input CSV file paths for processing
- `CSV.OUTPUT`: Output CSV file paths for results
- `CSV.SETTINGS`:
  - `ALWAYS_QUOTE`: Whether to quote all CSV fields (default: true)
  - `DELIMITER`: CSV field separator (default: ",")

### Screenshot Processing

- `SCREENSHOT_PROCESSING`:
  - `SCENE_THRESHOLD`: Threshold for detecting scene changes (default: 0.3)
  - `MAX_TOKENS`: Maximum tokens for AI responses (default: 500)
  - `CONCURRENT_PROCESSING`:
    - `VIDEOS`: Number of videos to process simultaneously (default: 3)
    - `SCREENSHOTS`: Number of screenshots to process simultaneously (default: 5)

### Transcript Processing

- `TRANSCRIPT_PROCESSING`:
  - `MIN_LENGTH`: Minimum transcript length to process
  - `MAX_TOKENS`: Token limits for different processing tasks
  - `TEMPERATURE`: AI temperature settings for different tasks
  - Custom fields and prompts can be configured for specific analysis needs

### Whisper Settings

- `WHISPER_SETTINGS`:
  - `MODEL_NAME`: Whisper model to use (default: "base.en")
  - `OPTIONS`: Transcription options including language and processing parameters
  - `AUDIO`: Audio processing settings (frequency and channels)
  - `CONCURRENT_PROCESSING`: Number of concurrent transcription processes (default: 3)

### Supported Formats

- `SUPPORTED_FORMATS`:
  - `VIDEO`: Supported video file formats ([".mp4", ".avi", ".mov"])
  - `AUDIO`: Supported audio file formats ([".wav", ".mp3"])

### Logging Configuration

- `LOGGING`:
  - `ERROR_LOG`: Path for error logs
  - `COMBINED_LOG`: Path for combined logs
  - `PROCESS_LOGS`: Individual log files for different processes
  - `LEVEL`: Logging level (default: "info")

### Progress Bar Settings

- `PROGRESS_BAR`: Configuration for the progress display during processing

Make sure to update these parameters in the `config.js` file according to your specific requirements before running the pipeline.
