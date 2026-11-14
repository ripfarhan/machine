// Loads the DSP parts in Node the same way the page does.
const path = require('path');
for (const f of ['core', 'pitch', 'tune', 'psola', 'synth']) require(path.join(__dirname, '..', 'js', 'dsp', f + '.js'));
module.exports = require(path.join(__dirname, '..', 'js', 'dsp', 'index.js'));
