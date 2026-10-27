/* Maut ki Awaaz — taste model (research/04 §7): Thompson sampling over worlds (Beta posteriors), learned continuous genes
   (tempo/colour/macros per world, from what was liked or listened to the end), novelty/habituation so it never collapses
   onto one world, and a minimum genome distance to the last pieces. Everything it decides is explained in words. */
'use strict';
class AwaazTaste {
  constructor(A){ this.A = A; this.key = 'awaaz.taste.v1'; this.s = this.load(); this.rand = A.rng((Date.now() ^ (Math.random() * 1e9)) >>> 0); }
  blank(){ const w = {}; for (const k of this.A.WORLD_LIST) w[k] = {a: 1, b: 1, plays: 0, likes: 0, skips: 0, ends: 0, sec: 0}; return {v: 1, worlds: w, genes: {}, recent: [], total: 0}; }
  load(){ let s = null; try { s = JSON.parse(localStorage.getItem(this.key) || 'null'); } catch (e){} const b = this.blank(); if (!s || s.v !== 1) return b; for (const k in b.worlds) if (!s.worlds[k]) s.worlds[k] = b.worlds[k]; return s; }
  save(){ try { localStorage.setItem(this.key, JSON.stringify(this.s)); } catch (e){} }
  reset(){ this.s = this.blank(); this.save(); }
  // Beta sample via two gamma draws (Marsaglia–Tsang)
  gamma(k){ const r = this.rand; if (k < 1) return this.gamma(k + 1) * Math.pow(r(), 1 / k); const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d); for (;;){ let x, v; do { x = r.gauss(); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = r(); if (u < 1 - .0331 * x * x * x * x || Math.log(u) < .5 * x * x + d * (1 - v + Math.log(v))) return d * v; } }
  beta(a, b){ const x = this.gamma(a), y = this.gamma(b); return x / (x + y); }
  // ---------------------------------------------------------------- signals
  started(g){ const w = this.s.worlds[g.world]; w.plays++; this.s.total++; this.s.recent.unshift({world: g.world, seed: g.seed, bpm: g.bpm, mode: g.mode, family: g.family, colour: g.colour, tonic: g.tonic, patches: g.patches}); this.s.recent = this.s.recent.slice(0, 8); this.save(); }
  listened(g, sec){ this.s.worlds[g.world].sec += sec; }
  like(g, macros){ const w = this.s.worlds[g.world]; w.a += 2; w.likes++; this.learn(g, macros, 1); this.save(); return `♥ noted — more ${this.A.WORLDS[g.world].name}, and I'll remember these knob settings`; }
  skip(g, sec, total){ const w = this.s.worlds[g.world]; const early = sec < Math.min(45, total * .2); w.b += early ? 1.5 : .6; w.skips++; this.save();
    return early ? `✕ skipped early — ${this.A.WORLDS[g.world].name} gets less likely` : `✕ skipped — noted, a bit less ${this.A.WORLDS[g.world].name}`; }
  ended(g, macros){ const w = this.s.worlds[g.world]; w.a += .7; w.ends++; this.learn(g, macros, .5); this.save(); }
  learn(g, macros, wt){ const G = this.s.genes[g.world] || (this.s.genes[g.world] = {n: 0, bpm: 0, colour: 0, macros: {}}); const k = wt / (G.n + wt); G.n += wt;
    G.bpm += (g.bpm - G.bpm) * k; G.colour += (g.colour - G.colour) * k; for (const m in macros){ if (m === 'mood') continue; const v = G.macros[m] === undefined ? macros[m] : G.macros[m]; G.macros[m] = v + (macros[m] - v) * k; } }
  // ---------------------------------------------------------------- decisions
  score(world, cur){ const w = this.s.worlds[world]; let th = this.beta(w.a, w.b); const rec = this.s.recent.findIndex(r => r.world === world); const nov = rec < 0 ? .12 : rec === 0 ? -.6 : rec === 1 ? -.25 : rec === 2 ? -.1 : 0;
    const expo = .08 / Math.sqrt(1 + w.plays); return {th, total: th + nov + expo + (world === cur ? -1 : 0), nov}; }
  genomeFor(world, mode){ const A = this.A, W = A.WORLDS[world], G = this.s.genes[world]; let best = null, bd = -1;
    for (let i = 0; i < 6; i++){ const g = A.makeGenome(world, (this.rand() * 4294967295) >>> 0); if (G && G.n >= 1 && mode !== 'surprise'){ const pull = Math.min(.6, G.n * .15);
        g.bpm = Math.round(Math.min(W.tempo[1], Math.max(W.tempo[0], g.bpm + (G.bpm - g.bpm) * pull))); g.colour += (G.colour - g.colour) * pull;
        g.macros = Object.assign({}, g.macros); for (const m in G.macros) g.macros[m] = (g.macros[m] === undefined ? .5 : g.macros[m]) + (G.macros[m] - (g.macros[m] === undefined ? .5 : g.macros[m])) * pull; }
      const d = Math.min.apply(null, this.s.recent.slice(0, 5).map(r => A.genomeDistance(g, r)).concat([99])); if (d > bd){ bd = d; best = g; } if (d > 2.5) break; }
    return best; }
  next(curWorld, mode){ const A = this.A; let world, why;
    if (mode === 'surprise'){ const ws = A.WORLD_LIST.filter(w => w !== curWorld).sort((a, b) => this.s.worlds[a].plays - this.s.worlds[b].plays); world = ws[Math.floor(this.rand() * Math.min(3, ws.length))]; why = 'surprise — something you have heard least'; }
    else if (mode === 'similar' && curWorld){ world = curWorld; why = 'more like this — same world, new seed, your settings'; }
    else if (!curWorld && this.s.total === 0){ const first = ['EMERGENCE', 'FELT', 'REPETITION', 'CRESCENDO']; world = first[Math.floor(this.rand() * first.length)]; why = 'first time — starting with one of the strongest worlds'; }
    else { const sc = A.WORLD_LIST.map(w => [w, this.score(w, curWorld)]).sort((a, b) => b[1].total - a[1].total); world = sc[0][0]; const s = sc[0][1], st = this.s.worlds[world];
      why = st.likes ? `you liked ${A.WORLDS[world].name} ${st.likes}× (taste ${(s.th * 100 | 0)}%)` : s.nov > 0 ? `exploring — not heard ${A.WORLDS[world].name} recently` : `taste ${(s.th * 100 | 0)}%`; }
    const g = this.genomeFor(world, mode); if (mode === 'similar' && this.s.recent[0]){ const r = this.s.recent[0]; if (this.rand() < .6) g.mode = r.mode; if (this.rand() < .5) g.family = r.family; g.patches = Object.assign({}, g.patches); if (this.rand() < .5) Object.assign(g.patches, r.patches); }
    return {genome: g, why}; }
  // what it has learned, in words
  explain(){ const A = this.A, out = []; const ws = A.WORLD_LIST.map(w => [w, this.s.worlds[w]]).map(([w, s]) => [w, s.a / (s.a + s.b), s]).sort((a, b) => b[1] - a[1]);
    for (const [w, p, s] of ws) out.push({world: w, name: A.WORLDS[w].name, p, plays: s.plays, likes: s.likes, skips: s.skips});
    const notes = []; for (const w in this.s.genes){ const G = this.s.genes[w]; if (G.n < 1) continue; for (const m in G.macros){ const v = G.macros[m]; if (v > .68) notes.push(`${A.WORLDS[w].name}: you like ${m.toUpperCase()} high`); else if (v < .3) notes.push(`${A.WORLDS[w].name}: you like ${m.toUpperCase()} low`); } }
    return {worlds: out, notes: notes.slice(0, 6), total: this.s.total}; } }
