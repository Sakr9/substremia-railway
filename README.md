# Stremio Subtitles Addon

A Stremio addon for managing subtitles with an integrated web interface.

## Features

- Upload and manage subtitles for movies and TV series
- Intuitive web interface
- Support for .srt files
- PostgreSQL database for metadata storage
- Caching system to improve performance
- Full integration with Stremio
- One-click deploy to Railway with managed PostgreSQL database

## Deploy to Railway

The easiest way to deploy this addon is using Railway:

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/substremia)

1. Click the "Deploy on Railway" button above
2. Railway will automatically:
   - Create a new PostgreSQL database
   - Set up the required environment variables
   - Deploy the application
3. Once deployed, you'll need to:
   - Add your TMDB API key in the Railway environment variables
   - Copy your deployment URL to use in Stremio

## Local Development Setup

1. **Clone the Repository:**
    ```bash
    git clone <your-repository-url>
    cd <repository-directory>
    ```

2. **Install Dependencies:**
    ```bash
    npm install
    ```

3. **Set Up PostgreSQL:**
    - Install PostgreSQL on your system if not already installed
    - Create a new database for the addon:
    ```sql
    CREATE DATABASE substremia;
    ```
    - The table structure will be created automatically when you first run the application

4. **Configure Environment Variables:**
    Copy the `.env.example` file to a new file named `.env`:
    ```bash
    cp .env.example .env
    ```
    Edit the `.env` file with your configurations:

    * **Database URL:**
      * Format: `postgresql://user:password@localhost:5432/substremia`
      * Replace user, password with your PostgreSQL credentials
    
    * **TMDB API Key:**
      * Register at https://www.themoviedb.org/
      * Go to your account settings > API
      * Request an API key (v3 auth)
      * Copy your API key to `TMDB_API_KEY` in the `.env` file

    * **Other Settings (Optional):**
      * `PORT`: Server port (default: 5000)
      * `CACHE_TTL`: Cache duration in seconds (default: 3600)
      * `NODE_ENV`: Set to 'development' locally

5. **Run the Application:**
    ```bash
    npm run dev
    ```
    The addon will be accessible at `http://localhost:5000` (or your configured port)

## Manual Deployment on Railway

If you prefer to deploy manually on Railway:

1. Fork this repository
2. Create a new project on Railway
3. Add PostgreSQL from the Railway plugins
4. Configure environment variables in Railway:
   - `DATABASE_URL` (automatically set by Railway when you add PostgreSQL)
   - `TMDB_API_KEY` (your TMDB API key)
   - `NODE_ENV=production`
5. Deploy your forked repository

## Install in Stremio

1. Get your deployment URL (e.g., `https://<your-app-name>.railway.app`)
2. In Stremio:
   - Go to the Addons section
   - Paste your deployment URL + `/addon/manifest.json`
   - Example: `https://<your-app-name>.railway.app/addon/manifest.json`
   - Click "Install"

## API Endpoints

- `GET /api/subtitles/:type/:id/:lang` - Get subtitles
- `POST /api/upload` - Upload new subtitles
- `GET /api/list/:type/:id` - List available languages for an item
- `GET /api/listall` - List all indexed subtitles
- `DELETE /api/subtitles/:type/:id/:lang` - Remove subtitles

## Database Structure

The addon uses a PostgreSQL database with the following main table:

```sql
CREATE TABLE subtitles (
    id SERIAL PRIMARY KEY,
    doc_id VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('movie', 'series')),
    imdb_id VARCHAR(20) NOT NULL,
    season INTEGER,
    episode INTEGER,
    language VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CHECK ((type = 'movie' AND season IS NULL AND episode IS NULL) OR 
           (type = 'series' AND season IS NOT NULL AND episode IS NOT NULL))
);
```

Language codes follow the ISO 639-1 standard (e.g., `en` for English, `it` for Italian, `es` for Spanish).
