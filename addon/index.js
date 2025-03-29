const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const manifest = require('./manifest.json');
const { subtitlesHandler } = require('./subtitles.handler');

const builder = new addonBuilder(manifest);

builder.defineSubtitlesHandler(subtitlesHandler);

const addonInterface = builder.getInterface();

module.exports = addonInterface;

if (require.main === module) {
}
