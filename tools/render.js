// Offline render of a piece: node tools/render.js WORLD seed seconds out.wav [macro=v ...] [--from=sec]
const fs = require('fs'), A = require('./load.js')();
const sr = 44100;
function render(world, seed, secs, macros, from, solo){ const e = new A.Engine(sr), g = A.makeGenome(world, seed); e.auto = false; e.load(g); if (macros) for (const k in macros) e.setMacro(k, macros[k]); if (solo) e.tracks[solo].solo = true;
  const N = Math.round(secs * sr), L = new Float32Array(N), R = new Float32Array(N), bl = new Float32Array(128), br = new Float32Array(128); const infos = []; let t0 = Date.now();
  const skip = Math.round((from || 0) * sr); for (let i = 0; i < skip; i += 128){ e.process(bl, br, 128); e.out.drain(); }
  for (let i = 0; i < N; i += 128){ const n = Math.min(128, N - i); e.process(bl, br, 128); L.set(bl.subarray(0, n), i); R.set(br.subarray(0, n), i); const d = e.out.drain(); for (const m of d.msgs) if (m.type === 'bar' || m.type === 'piece') infos.push(m); }
  const cpu = (Date.now() - t0) / 1000 / (secs + (from || 0)); return {L, R, g, infos, cpu, e}; }
function wav(path, L, R){ const N = L.length, b = Buffer.alloc(44 + N * 4); b.write('RIFF', 0); b.writeUInt32LE(36 + N * 4, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++){ b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4); b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4); } fs.writeFileSync(path, b); }
module.exports = {render, wav, A, sr};
if (require.main === module){ const [world, seed, secs, out] = process.argv.slice(2); const macros = {}; let from = 0;
  let solo = null; for (const a of process.argv.slice(6)){ if (a.startsWith('--from=')) from = +a.slice(7); else if (a.startsWith('--solo=')) solo = a.slice(7); else { const [k, v] = a.split('='); macros[k] = +v; } }
  const r = render(world, +seed, +secs, macros, from, solo); let nan = 0, pk = 0; for (let i = 0; i < r.L.length; i++){ if (!isFinite(r.L[i]) || !isFinite(r.R[i])) nan++; pk = Math.max(pk, Math.abs(r.L[i]), Math.abs(r.R[i])); }
  wav(out, r.L, r.R); const p = r.infos.find(m => m.type === 'piece');
  console.log(JSON.stringify({world, seed: +seed, bpm: r.g.bpm, key: A.NOTE[r.g.tonic] + ' ' + r.g.mode, family: r.g.family, form: r.g.form, loop: p && p.loop.map(c => c.name).join(' '), cpu: +r.cpu.toFixed(3), nan, peak: +pk.toFixed(3), lufs: +r.e.mixer.loud.lufs.toFixed(1), patches: r.g.patches}));
  const bars = r.infos.filter(m => m.type === 'bar'); let last = ''; for (const b of bars){ const s = b.section + ' E' + b.E.toFixed(2) + ' ' + b.active.join(','); if (b.moves && b.moves.length) console.log(`   bar ${b.bar} ${b.section}(${b.bis}) MOVES: ${b.moves.join(' | ')}`); if (b.changed.length || b.bis === 0) console.log(`bar ${b.bar} ${(b.t0 / sr).toFixed(1)}s ${b.section}(${b.bis}) E=${b.E.toFixed(2)} a=${b.alpha.toFixed(2)} ${b.chord} [${b.changed.join(' ')}]`); } }
