const axios = require('axios');

const SERVER_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5000';

async function subtitlesHandler(args) {
  const { type, id } = args;
  let imdbId = id;
  let season, episode;

  if (type === 'series') {
    let parts = id.match(/^(tt\d+):(\d+):(\d+)$/);
    if (!parts) {
      const filename = args.extra?.filename || '';
      const episodeMatch = filename.match(/Episode\s*(\d+)/i);
      const seasonNumber = 1;
      const episodeNumber = episodeMatch ? parseInt(episodeMatch[1]) : 1;

      imdbId = id;
      season = seasonNumber;
      episode = episodeNumber;

    } else {
      imdbId = parts[1];
      season = parseInt(parts[2], 10);
      episode = parseInt(parts[3], 10);
    }
  } else if (type !== 'movie') {
    console.error('Unsupported type:', type);
    return Promise.resolve({ subtitles: [] });
  }

  try {
    const apiId = type === 'series' ? `${imdbId}:${season}:${episode}` : imdbId;
    const listApiUrl = `${SERVER_URL}/api/list/${type}/${apiId}`;

    const response = await axios.get(listApiUrl, {
      timeout: 5000,
      validateStatus: false
    });

    if (response.status !== 200 || !response.data || !Array.isArray(response.data.languages)) {
      return Promise.resolve({ subtitles: [] });
    }

    const availableLanguages = response.data.languages;

    if (availableLanguages.length === 0) {
      return Promise.resolve({ subtitles: [] });
    }

    const subtitles = availableLanguages.map(lang => {
      const subtitleUrl = `${SERVER_URL}/api/subtitles/${type}/${apiId}/${lang}`;
      return {
        id: `${id}_${lang}`,
        url: subtitleUrl,
        lang: lang
      };
    });

    return Promise.resolve({ subtitles });

  } catch (error) {
    const apiIdForError = type === 'series' ? `${imdbId}:${season}:${episode}` : imdbId;
    if (axios.isAxiosError(error)) {
        console.error('Axios Error:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            serverUrl: SERVER_URL,
            requestUrl: `${SERVER_URL}/api/list/${type}/${apiIdForError}`
        });
    } else {
        console.error('Unexpected error in subtitlesHandler:', error);
    }
    return Promise.resolve({ subtitles: [] });
  }
}

module.exports = {
  subtitlesHandler
};
