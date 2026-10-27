// Node loader: builds the engine namespace from js/engine/*.js in filename order (same order the browser host uses)
const fs = require('fs'), path = require('path');
module.exports = function load(){ const dir = path.join(__dirname, '..', 'js', 'engine'), A = {};
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()){ const fn = require(path.join(dir, f)); fn(A); } return A; };
