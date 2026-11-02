// Node loader for BARS: the Maut ki Awaaz engine modules plus the scene modules
const fs = require('fs'), path = require('path');
module.exports = function load(){ const A = {}, root = path.join(__dirname, '..', '..', 'js');
  for (const f of fs.readdirSync(path.join(root, 'engine')).filter(f => f.endsWith('.js')).sort()) require(path.join(root, 'engine', f))(A);
  for (const f of ['10-voices.js', '20-scenes.js', '30-engine.js']) require(path.join(root, 'beats', f))(A);
  return A; };
