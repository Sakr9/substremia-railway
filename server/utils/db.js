const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
}

// Configurazione del pool di connessione
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false,
    // Configurazione aggiuntiva per gestire i tentativi di riconnessione
    max: 20, // massimo numero di clients nel pool
    idleTimeoutMillis: 30000, // quanto tempo un client può rimanere inattivo prima di essere chiuso
    connectionTimeoutMillis: 2000, // quanto tempo aspettare prima di lanciare un timeout error
    retryDelay: 3000 // quanto tempo aspettare tra i tentativi di riconnessione
});

// Gestione eventi del pool
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
});

pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
});

// Query per creare la tabella subtitles se non esiste
const createTableQuery = `
CREATE TABLE IF NOT EXISTS subtitles (
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
`;

// Funzione per inizializzare il database con retry
async function initializeDatabase(retries = 5) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const client = await pool.connect();
            try {
                await client.query(createTableQuery);
                console.log('Database initialized successfully');
                return;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error(`Attempt ${attempt}/${retries} failed:`, error.message);
            if (attempt === retries) {
                throw new Error(`Failed to initialize database after ${retries} attempts`);
            }
            // Attendi prima di riprovare
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}

// Funzione per ottenere una connessione dal pool
async function getClient() {
    const client = await pool.connect();
    return client;
}

// Funzione per inserire o aggiornare un sottotitolo
async function upsertSubtitle(docId, data) {
    const query = `
        INSERT INTO subtitles (doc_id, type, imdb_id, season, episode, language, content)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (doc_id) 
        DO UPDATE SET
            content = EXCLUDED.content,
            uploaded_at = CURRENT_TIMESTAMP
        RETURNING *;
    `;

    const values = [
        docId,
        data.type,
        data.imdbId,
        data.season || null,
        data.episode || null,
        data.language,
        data.content
    ];

    const client = await getClient();
    try {
        const result = await client.query(query, values);
        return result.rows[0];
    } finally {
        client.release();
    }
}

// Funzione per ottenere un sottotitolo per doc_id
async function getSubtitle(docId) {
    const query = 'SELECT * FROM subtitles WHERE doc_id = $1';
    const client = await getClient();
    try {
        const result = await client.query(query, [docId]);
        return result.rows[0];
    } finally {
        client.release();
    }
}

// Funzione per eliminare un sottotitolo
async function deleteSubtitle(docId) {
    const query = 'DELETE FROM subtitles WHERE doc_id = $1 RETURNING *';
    const client = await getClient();
    try {
        const result = await client.query(query, [docId]);
        return result.rows[0];
    } finally {
        client.release();
    }
}

// Funzione per listare tutti i sottotitoli
async function listAllSubtitles() {
    const query = 'SELECT * FROM subtitles ORDER BY uploaded_at DESC';
    const client = await getClient();
    try {
        const result = await client.query(query);
        return result.rows;
    } finally {
        client.release();
    }
}

// Funzione per listare i sottotitoli per un specifico tipo e ID
async function listSubtitlesByPrefix(prefix) {
    const query = 'SELECT * FROM subtitles WHERE doc_id LIKE $1 ORDER BY doc_id';
    const client = await getClient();
    try {
        const result = await client.query(query, [prefix + '%']);
        return result.rows;
    } finally {
        client.release();
    }
}

module.exports = {
    pool,
    initializeDatabase,
    getClient,
    upsertSubtitle,
    getSubtitle,
    deleteSubtitle,
    listAllSubtitles,
    listSubtitlesByPrefix
};
