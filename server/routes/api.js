const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const db = require('../utils/db');
const cacheManager = require('../utils/cache');
const axios = require('axios');

const os = require('os');
const router = express.Router();

const tempDir = process.env.VERCEL ? os.tmpdir() : path.join(__dirname, '..', 'temp_uploads/');
const upload = multer({ dest: tempDir });

if (!process.env.VERCEL) {
    (async () => {
        await fs.mkdir(tempDir, { recursive: true });
    })().catch(console.error);
}

const getDocId = (type, imdbId, season, episode, lang) => {
    if (type === 'movie') {
        return `movie_${imdbId}_${lang}`;
    } else if (type === 'series') {
        return `series_${imdbId}_s${String(season).padStart(2, '0')}e${String(episode).padStart(2, '0')}_${lang}`;
    }
    return null;
};

router.get('/list/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    let imdbId = id;
    let season, episode;
    let queryPrefix;

    try {
        if (type === 'movie') {
            if (!/^tt\d+$/.test(id)) {
                return res.status(400).json({ error: 'Invalid movie ID format' });
            }
            queryPrefix = `movie_${imdbId}_`;
        } else if (type === 'series') {
            const parts = id.match(/^(tt\d+):(\d+):(\d+)$/);
            if (!parts) {
                return res.status(400).json({ error: 'Invalid series ID format' });
            }
            imdbId = parts[1];
            season = parseInt(parts[2], 10);
            episode = parseInt(parts[3], 10);
            queryPrefix = `series_${imdbId}_s${String(season).padStart(2, '0')}e${String(episode).padStart(2, '0')}_`;
        } else {
            return res.status(400).json({ error: 'Invalid type specified' });
        }

        const subtitles = await db.listSubtitlesByPrefix(queryPrefix);
        const languages = subtitles.map(row => row.language);

        res.json({ languages });

    } catch (err) {
        console.error(`Error listing subtitles for ${type} ${id}:`, err);
        res.status(500).json({ error: 'Failed to list subtitles from database' });
    }
});

router.get('/subtitles/:type/:id/:lang', async (req, res) => {
    const { type, id, lang } = req.params;
    let imdbId = id;
    let season, episode;
    let docId;

    try {
        if (type === 'movie') {
            if (!/^tt\d+$/.test(id)) {
                return res.status(400).send('Invalid movie ID format');
            }
            docId = getDocId(type, imdbId, null, null, lang);
        } else if (type === 'series') {
            const parts = id.match(/^(tt\d+):(\d+):(\d+)$/);
            if (!parts) {
                return res.status(400).send('Invalid series ID format');
            }
            imdbId = parts[1];
            season = parseInt(parts[2], 10);
            episode = parseInt(parts[3], 10);
            docId = getDocId(type, imdbId, season, episode, lang);
        } else {
            return res.status(400).send('Invalid type specified');
        }

        if (!docId) {
            return res.status(400).send('Could not determine document ID');
        }

        const cacheKey = `subtitle:${docId}`;
        const cachedContent = cacheManager.get(cacheKey);

        if (cachedContent) {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.send(cachedContent);
            return;
        }

        const subtitle = await db.getSubtitle(docId);

        if (!subtitle) {
            return res.status(404).send('Subtitle not found in database');
        }

        if (!subtitle.content) {
            return res.status(500).send('Subtitle data is invalid in database');
        }

        cacheManager.set(cacheKey, subtitle.content);

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(subtitle.content);

    } catch (err) {
        console.error(`Error serving subtitle ${type} ${id} (${lang}):`, err);
        res.status(500).send('Failed to serve subtitle file from database');
    }
});

router.post('/upload', upload.single('subtitleFile'), async (req, res) => {
    const { contentType, imdbId, season, episode, language } = req.body;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: 'No subtitle file uploaded.' });
    }

    let docId;
    try {
        if (contentType === 'movie') {
            docId = getDocId(contentType, imdbId, null, null, language);
        } else if (contentType === 'series') {
            if (!season || !episode || isNaN(parseInt(season)) || isNaN(parseInt(episode))) {
                await fs.unlink(file.path);
                return res.status(400).json({ error: 'Missing or invalid season/episode for series.' });
            }
            docId = getDocId(contentType, imdbId, parseInt(season), parseInt(episode), language);
        } else {
            await fs.unlink(file.path);
            return res.status(400).json({ error: 'Invalid content type.' });
        }

        if (!docId) {
            await fs.unlink(file.path);
            return res.status(400).json({ error: 'Could not determine document ID.' });
        }

        const content = await fs.readFile(file.path, 'utf-8');

        await db.upsertSubtitle(docId, {
            type: contentType,
            imdbId: imdbId,
            season: contentType === 'series' ? parseInt(season) : null,
            episode: contentType === 'series' ? parseInt(episode) : null,
            language: language,
            content: content
        });

        const cacheKey = `subtitle:${docId}`;
        cacheManager.set(cacheKey, content);

        await fs.unlink(file.path);

        res.json({ message: 'Subtitle uploaded to database successfully!' });

    } catch (err) {
        console.error('Error uploading subtitle to database:', err);
        try { await fs.unlink(file.path); } catch (cleanupErr) { console.error('Error cleaning up temp file:', cleanupErr); }
        res.status(500).json({ error: 'Failed to save subtitle file to database.' });
    }
});

const getTmdbDetails = async (imdbId, type) => {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return { title: null, posterPath: null };

    const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${apiKey}&language=en-US&external_source=imdb_id`;

    try {
        const response = await axios.get(url);
        const results = type === 'movie' ? response.data.movie_results : response.data.tv_results;
        if (results && results.length > 0) {
            const item = results[0];
            return {
                title: item.title || item.name,
                posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : null
            };
        }
    } catch (error) {
        console.error(`Error fetching TMDB details for ${imdbId}:`, error.message);
    }
    return { title: null, posterPath: null };
};

const getImdbIdFromTmdb = async (tmdbId, type) => {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return null;
    const mediaType = type === 'movie' ? 'movie' : 'tv';
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${apiKey}`;
    try {
        const response = await axios.get(url);
        return response.data.imdb_id || null;
    } catch (error) {
        console.error(`Error fetching IMDb ID for TMDB ${mediaType} ${tmdbId}:`, error.message);
        return null;
    }
};

router.get('/listall', async (req, res) => {
    const result = { movies: {}, series: {} };

    try {
        const subtitles = await db.listAllSubtitles();

        subtitles.forEach(data => {
            const imdbId = data.imdb_id;

            if (data.type === 'movie') {
                if (!result.movies[imdbId]) {
                    result.movies[imdbId] = { imdbId: imdbId, languages: [], title: null, posterPath: null };
                }
                if (!result.movies[imdbId].languages.includes(data.language)) {
                    result.movies[imdbId].languages.push(data.language);
                }
            } else if (data.type === 'series') {
                if (!result.series[imdbId]) {
                    result.series[imdbId] = { imdbId: imdbId, episodes: {}, title: null, posterPath: null };
                }
                const episodeKey = `s${data.season}e${data.episode}`;
                if (!result.series[imdbId].episodes[episodeKey]) {
                    result.series[imdbId].episodes[episodeKey] = {
                        season: data.season,
                        episode: data.episode,
                        languages: []
                    };
                }
                if (!result.series[imdbId].episodes[episodeKey].languages.includes(data.language)) {
                    result.series[imdbId].episodes[episodeKey].languages.push(data.language);
                }
            }
        });

        const movieIds = Object.keys(result.movies);
        const seriesIds = Object.keys(result.series);
        const allIds = [...new Set([...movieIds, ...seriesIds])];

        const tmdbPromises = allIds.map(id => {
            const type = movieIds.includes(id) ? 'movie' : 'series';
            return getTmdbDetails(id, type).then(details => ({ id, type, ...details }));
        });

        const tmdbResults = await Promise.all(tmdbPromises);
        const tmdbMap = tmdbResults.reduce((acc, item) => {
            acc[item.id] = { title: item.title, posterPath: item.posterPath };
            return acc;
        }, {});

        const moviesArray = Object.values(result.movies).map(movie => ({
            ...movie,
            title: tmdbMap[movie.imdbId]?.title || movie.imdbId,
            posterPath: tmdbMap[movie.imdbId]?.posterPath
        }));

        const seriesArray = Object.values(result.series).map(series => ({
            ...series,
            title: tmdbMap[series.imdbId]?.title || series.imdbId,
            posterPath: tmdbMap[series.imdbId]?.posterPath,
            episodes: Object.values(series.episodes)
        }));

        res.json({ movies: moviesArray, series: seriesArray });

    } catch (err) {
        console.error('Error listing all subtitles from database:', err);
        res.status(500).json({ error: 'Failed to list all subtitles from database' });
    }
});

router.get('/search', async (req, res) => {
    const query = req.query.query;
    const apiKey = process.env.TMDB_API_KEY;

    if (!query || !apiKey) {
        return res.status(400).json({ error: 'Missing query or API key' });
    }

    const url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;

    try {
        const response = await axios.get(url);
        const results = response.data.results || [];

        const filteredResults = results
            .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
            .map(item => ({
                tmdbId: item.id,
                type: item.media_type === 'tv' ? 'series' : 'movie',
                title: item.title || item.name,
                posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : null,
                year: (item.release_date || item.first_air_date || '').substring(0, 4) || 'N/A'
            }));

        const resultsWithImdb = await Promise.all(filteredResults.map(async (item) => {
            const imdbId = await getImdbIdFromTmdb(item.tmdbId, item.type);
            return { ...item, imdbId };
        }));

        const finalResults = resultsWithImdb.filter(item => item.imdbId);

        res.json(finalResults);

    } catch (error) {
        console.error('Error searching TMDB:', error.message);
        res.status(500).json({ error: 'Failed to search TMDB' });
    }
});

router.delete('/subtitles/:type/:id/:lang', async (req, res) => {
    const { type, id, lang } = req.params;
    let imdbId = id;
    let season, episode;
    let docId;

    try {
        if (type === 'movie') {
            if (!/^tt\d+$/.test(id)) {
                return res.status(400).json({ error: 'Invalid movie ID format' });
            }
            docId = getDocId(type, imdbId, null, null, lang);
        } else if (type === 'series') {
            const parts = id.match(/^(tt\d+):(\d+):(\d+)$/);
            if (!parts) {
                return res.status(400).json({ error: 'Invalid series ID format for deletion (expecting tt...:s:e)' });
            }
            imdbId = parts[1];
            season = parseInt(parts[2], 10);
            episode = parseInt(parts[3], 10);
            docId = getDocId(type, imdbId, season, episode, lang);
        } else {
            return res.status(400).json({ error: 'Invalid type specified' });
        }

        if (!docId) {
            return res.status(400).json({ error: 'Could not determine document ID' });
        }

        const result = await db.deleteSubtitle(docId);

        if (!result) {
            return res.status(404).json({ error: 'Subtitle not found in database, cannot delete.' });
        }

        const cacheKey = `subtitle:${docId}`;
        cacheManager.delete(cacheKey);

        res.json({ message: 'Subtitle deleted successfully from database!' });

    } catch (err) {
        console.error(`Error deleting subtitle ${type} ${id} (${lang}) from database:`, err);
        res.status(500).json({ error: 'Failed to delete subtitle file from database.' });
    }
});

module.exports = router;
