# TikTok Knowledge Base

A powerful Node.js application that processes video content through multiple stages to extract and analyze information using AI. The pipeline combines video transcription, screenshot analysis, and AI-powered content understanding.

View Article: [https://genaisecretsauce.com/genai-secret-sauce-for-a-tiktok-knowledge-base/](https://genaisecretsauce.com/genai-secret-sauce-for-a-tiktok-knowledge-base/)

## Overview

This application processes videos through the following pipeline:

1. **Video Transcription**

   - Converts video audio to text using Whisper AI
   - Supports multiple video formats (.mp4, .avi, .mov)
   - Processes multiple videos concurrently
   - Saves transcripts to CSV files

2. **Transcript Analysis**

   - Analyzes transcripts using AI (OpenAI GPT models)
   - Generates summaries, tags, and custom analyses
   - Identifies videos that need visual analysis
   - Outputs results to structured CSV files

3. **Screenshot Generation** (if needed)

   - Automatically extracts key frames from videos
   - Uses scene detection to capture important moments
   - Scales and optimizes screenshots for analysis
   - Organizes screenshots by video in dedicated folders

4. **Visual Content Analysis**

   - Analyzes screenshots using AI vision models
   - Extracts text, captions, and product information
   - Generates visual content summaries
   - Identifies and catalogs products and URLs

5. **Combined Analysis**
   - Merges transcript and visual analysis data
   - Creates comprehensive content understanding
   - Generates final combined CSV report
   - Maintains structured data organization

## Key Features

- **Concurrent Processing**: Efficiently handles multiple videos simultaneously
- **AI-Powered Analysis**: Utilizes OpenAI's GPT and Vision models
- **Flexible Configuration**: Highly configurable through `config.js`
- **Error Handling**: Robust error recovery and logging
- **Progress Tracking**: Real-time progress bars and status updates
- **Structured Output**: Organized CSV files for easy data analysis
- **Resource Management**: Rate limiting and concurrent processing controls

## Use Cases

- Content cataloging and analysis
- Product mention detection
- Automated video summarization
- Content moderation and filtering
- Knowledge base creation
- Video SEO optimization
- Content recommendation systems

## Output Files

The pipeline generates several CSV files:

- `transcriptions.csv`: Raw video transcriptions
- `transcription_processed.csv`: Analyzed transcript data
- `screenshots_processed.csv`: Visual analysis results
- `combined_analysis.csv`: Complete video analysis

## Technical Details

- Built with Node.js
- Uses FFmpeg for video processing
- Integrates with OpenAI's API
- Supports concurrent processing
- Implements retry mechanisms
- Includes comprehensive logging
- Provides progress visualization

This pipeline is ideal for content creators, marketers, and developers who need to process and analyze video content at scale while extracting meaningful insights and structured data.

## Setup

### Step 1: **Get the Code**

1. **Clone the Repository**  
   Start by cloning the repository to your local machine. Open your terminal and execute:

   ```bash
   git clone git@github.com:jazmy/tiktokknowledgebase.git
   cd tiktokknowledgebase
   ```

   This creates a local copy of the project and navigates into the directory.

2. **Install Node.js**  
   If Node.js is not installed, use [Homebrew](https://brew.sh) to install it:

   ```bash
   brew install node
   ```

3. **Install Project Dependencies**  
   Run the following command to install all required packages listed in `package.json`:

   ```bash
   npm install
   ```

4. **Install Whisper Model**  
   Whisper processes audio for transcription. Download the default `base.en` model:

   ```bash
   npx whisper-node download
   ```

   Press **Enter** to confirm downloading the model.


### Step 2: **Configure Environment and Settings**

1. **Set Up Environment Variables**  
   The project requires an OpenAI API key for analysis. Rename the `.env-example` file to `.env`:

   ```bash
   mv .env-example .env
   ```

   Open the `.env` file in a text editor and paste your OpenAI API key:

   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

2. **Review and Update Configuration Settings**  
   Open the `config.js` file in a text editor to review and update parameters as needed. Documentation is provided within the file for guidance.


### Step 3: **Prepare Video Files**

1. **Download TikTok Videos**  
   Use tools like [4K Tokkit](https://www.4kdownload.com/products/product-tokkit) to download TikTok videos by hashtags or users. Save the videos in a folder named `videos` inside the project directory:

   ```bash
   cd /Desktop/tiktokknowledgebase
   mkdir videos
   ```

2. **Organize Files**  
   Ensure the video files are properly named and placed in the `videos` folder to avoid processing errors.


### Step 4: **Run the Video Processing Pipeline**

1. **Process Videos**  
   Execute the following command in the terminal:

   ```bash
   node processAllVideos.js
   ```
   This will:

   - Extract audio from each video.
   - Transcribe the audio into text.
   - Generate a CSV file with transcripts, summaries, tags, and product mentions.

2. **View Output**  
   The final output is saved in the `csv` folder as `combined_analysis.csv`. Open it with Numbers, Excel, or any CSV viewer.

### Step 5: **Analyze Your Knowledge Base**

1. **Explore CSV Data**  
   Fields in the CSV include:

   - **Transcript:** Full transcription of the video.
   - **Summary:** Concise summary of the content.
   - **Tags:** Key topics and themes.
   - **Products:** Mentioned products (if any).

2. **Leverage ChatGPT**  
   Copy the **Summary** column and paste it into ChatGPT. Ask questions like:

   - *What are the recurring themes in these videos?*
   - *Can you categorize these summaries by topic?*


### Additional Notes
- **Debugging:** Logs are generated during processing for troubleshooting.
- **Code Editing:** Use an IDE like [Cursor](https://www.cursor.sh) for a better editing experience.
- **API Costs:** Processing hundreds of videos may incur minor costs for OpenAI API calls.


## Configuration Parameters

The configuration parameters are defined in the `config.js` file. Below is a detailed description of each section:

### Processing Options

- `PROCESSING_OPTIONS`:
  - `CREATE_SCREENSHOTS`: Enable/disable screenshot generation (default: false)
    NOTE: Processing screenshots can get expensive. For 100 tiktok videos, you'll probably have ~500 screenshots. Which will end up being about $3 in image processing and $1 in summarizing and tagging videos. Price adds up if you're dealing with hundreds or thousands of videos.
  - `MODEL_PROVIDER`: AI model provider to use (default: "openai")

### API Settings

- `API_SETTINGS`:
  - `MAX_RETRIES`: Number of retry attempts for failed API calls (default: 3)
  - `RETRY_DELAY`: Delay in milliseconds between retry attempts (default: 2000ms)
  - `RATE_LIMIT_DELAY`: Delay for rate limiting in milliseconds (default: 5000ms)

### AI Models

- `MODELS`: Specifies which AI models to use for different processing tasks:
  - `SUMMARY`: Model for generating content summaries (default: "gpt-4o-mini")
  - `TAGS`: Model for generating content tags (default: "gpt-4o-mini")
  - `CUSTOM`: Model for custom analysis tasks (default: "gpt-4o-mini")
  - `VISION`: Model for image analysis (default: "gpt-4o-mini")

### Directory Structure

- `FOLDERS`: Defines the working directories:
  - `VIDEOS`: Directory for source video files
  - `SCREENSHOTS`: Directory for extracted video screenshots
  - `AUDIO`: Directory for extracted audio files
  - `CSV`: Directory for CSV output files

### CSV Configuration

- `CSV`:
  - `INPUT`:
    - `SCREENSHOTS`: Path to processed transcription CSV
    - `TRANSCRIPTS`: Path to raw transcriptions CSV
  - `OUTPUT`:
    - `SCREENSHOTS`: Path for processed screenshots CSV
    - `TRANSCRIPTS`: Path for transcriptions CSV
    - `GENAI`: Path for processed transcription CSV
    - `COMBINED`: Path for combined analysis CSV
  - `SETTINGS`:
    - `ALWAYS_QUOTE`: Whether to quote all CSV fields (default: true)
    - `DELIMITER`: CSV field separator (default: ",")

### Screenshot Processing

- `SCREENSHOT_PROCESSING`:
  - `SCENE_THRESHOLD`: Threshold for detecting scene changes (default: 0.3)
  - `VISION_PROMPT`: Custom prompt for extracting text from images
  - `SUMMARY_PROMPT`: Custom prompt for summarizing screenshot content
  - `MAX_TOKENS`: Maximum tokens for AI responses (default: 2000)
  - `CONCURRENT_PROCESSING`:
    - `VIDEOS`: Number of videos to process simultaneously (default: 10)
    - `SCREENSHOTS`: Number of screenshots to process simultaneously (default: 10)
  - `COLUMNS`: Defines input/output column configurations for CSV files

### Transcript Processing

- `TRANSCRIPT_PROCESSING`:
  - `MIN_LENGTH`: Minimum transcript length to process (default: 10)
  - `MAX_TOKENS`:
    - `SUMMARY`: Token limit for summaries (default: 150)
    - `TAGS`: Token limit for tags (default: 50)
    - `CUSTOM`: Token limit for custom fields (default: 250)
  - `TEMPERATURE`: AI temperature settings for different tasks (all default: 0.7)
  - `COLUMNS`: Defines input/output column configurations
  - `PROMPTS`: Custom prompts for different analysis tasks

### Whisper Settings

- `WHISPER_SETTINGS`:
  - `MODEL_NAME`: Whisper model to use (default: "base.en")
  - `OPTIONS`: Detailed transcription options
  - `AUDIO`: Audio processing settings
    - `FREQUENCY`: Audio frequency (default: 16000)
    - `CHANNELS`: Number of audio channels (default: 1)
  - `RETRY`: Retry settings for failed transcriptions
  - `CONCURRENT_PROCESSING`: Number of concurrent transcription processes (default: 10)

### Supported Formats

- `SUPPORTED_FORMATS`:
  - `VIDEO`: Supported video formats ([".mp4", ".avi", ".mov"])
  - `AUDIO`: Supported audio formats ([".wav", ".mp3"])

### Logging Configuration

- `LOGGING`:
  - `ERROR_LOG`: Path for error logs
  - `COMBINED_LOG`: Path for combined logs
  - `PROCESS_LOGS`: Individual log files for different processes
  - `LEVEL`: Logging level (default: "info")

### Progress Bar Settings

- `PROGRESS_BAR`:
  - `FORMAT`: Custom format for progress display
  - `CLEAR_ON_COMPLETE`: Whether to clear progress bar on completion (default: false)
  - `HIDE_CURSOR`: Whether to hide cursor during progress (default: true)

### API Limits

- `API_LIMITS`:
  - `CONCURRENT_OPENAI_CALLS`: Maximum concurrent OpenAI API calls (default: 5)

Make sure to update these parameters in the `config.js` file according to your specific requirements before running the pipeline.
