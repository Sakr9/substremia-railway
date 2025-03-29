const NodeCache = require('node-cache');
require('dotenv').config();

class CacheManager {
    constructor() {
        this.cache = new NodeCache({
            stdTTL: parseInt(process.env.CACHE_TTL) || 3600,
            checkperiod: 120
        });
    }

    get(key) {
        return this.cache.get(key);
    }

    set(key, content) {
        return this.cache.set(key, content);
    }

    delete(key) {
        return this.cache.del(key);
    }

    clear() {
        return this.cache.flushAll();
    }

    getStats() {
        return this.cache.getStats();
    }

    generateKey(type, imdbId, season = null, episode = null, lang) {
        if (type === 'movie') {
            return `subtitle:${type}:${imdbId}:${lang}`;
        } else if (type === 'series') {
            return `subtitle:${type}:${imdbId}:${season}:${episode}:${lang}`;
        }
        return null;
    }
}

const cacheManager = new CacheManager();

module.exports = cacheManager;
