// Node loader for the BARS engine: the Maut ki Awaaz engine modules plus js/beats/*.js (only 10-… 40-… engine modules)
const fs = require('fs'), path = require('path');
module.exports = function load(){ const A = {}, root = path.join(__dirname, '..', '..', 'js');
  for (const f of fs.readdirSync(path.join(root, 'engine')).filter(f => f.endsWith('.js')).sort()) require(path.join(root, 'engine', f))(A);
  for (const f of ['10-sounds.js', '20-dna.js', '30-parts.js', '40-composer.js']) require(path.join(root, 'beats', f))(A);
  return A; };
