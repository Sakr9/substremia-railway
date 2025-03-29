require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { admin, db } = require('./utils/firebase');
const path = require('path');
const { getRouter } = require('stremio-addon-sdk');
const { subtitlesHandler } = require('../addon/subtitles.handler');
const addonInterface = require('../addon/index');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

const addonRouter = getRouter(addonInterface);
app.use('/addon', addonRouter);

const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/ping', (req, res) => {
  res.send('pong');
});

const server = app.listen(PORT);

process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0);
  });
});

module.exports = app;
