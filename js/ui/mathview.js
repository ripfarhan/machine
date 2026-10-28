/* Maut ki Awaaz — MATH view: the live numbers inside the engine, shown as the formulas they are plugged into.
   Toggle with the ∑ button in the hero or the M key. Fed by the engine's 'math' telemetry (~15/s, only while open). */
'use strict';
class AwaazMath {
  constructor(el){ this.el = el; this.m = null; this.last = 0; this.N = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']; this.raw = []; }
  feed(m){ this.m = m; for (const v of m.raw) this.raw.push(v); if (this.raw.length > 64) this.raw.splice(0, this.raw.length - 64); }
  render(force){ const now = performance.now(); if (!this.m || (!force && now - this.last < 90)) return; this.last = now; const m = this.m, c = m.comp; if (!c) return;
    const f = (x, d) => x === undefined || x === null || !isFinite(x) ? '–' : (+x).toFixed(d === undefined ? 2 : d);
    const n = x => `<b>${x}</b>`, k = x => `<i>${x}</i>`, hz = mi => 440 * Math.pow(2, (mi - 69) / 12), nm = mi => this.N[((mi % 12) + 12) % 12] + (Math.floor(mi / 12) - 1);
    const big = x => Math.round(x).toLocaleString('en-US');
    // ---- 1 · time
    const secs = m.t / m.sr, stepN = c.stepN, step = Math.floor(m.t / stepN);
    const T = `<h5>01 · TIME</h5>
      <p>t = ${n(big(m.t))} samples</p>
      <p>t ÷ sr = ${big(m.t)} ÷ ${big(m.sr)} = ${n(f(secs, 2))} s</p>
      <p>step = 60 ÷ ${n(c.bpm)} ÷ 4 × sr = ${n(f(stepN, 1))}</p>
      <p>bar = 16 × step = ${n(big(c.barN))}</p>
      <p>swing = +${n(f(c.swing, 3))} step on odd 16ths</p>
      <p>${k('numbers so far')} = 2 × t = ${n(big(m.t * 2))}</p>`;
    // ---- 2 · energy / form
    const lerp = c.E0 + (c.E1 - c.E0) * c.prog, ins = c.parts.map(p => `<span class="${p.active ? 'on' : 'off'}">${p.slot.toUpperCase()} ${f(p.eff)}${p.active ? '✓' : '·'}</span>`).join(' ');
    const E = `<h5>02 · ENERGY & FORM</h5>
      <p>E = lerp(${f(c.E0)}, ${f(c.E1)}, ${f(c.prog)}) + (${f(c.mE)} − .5)·.7</p>
      <p>&nbsp;&nbsp;= ${f(lerp, 3)} + ${f((c.mE - .5) * .7, 3)} = ${n(f(c.E, 3))}</p>
      <p>density = ${f(c.mDen)}·1.15 + E·.25 − .2 = ${n(f(c.density, 3))}</p>
      <p>${c.section.toUpperCase()} bar ${n(c.bis + 1)}/${c.sbars} · α(rain→grid) = ${n(f(c.alpha))}</p>
      <p>${k('part plays if E ≥ threshold')}</p><p class="wrap">${ins}</p>`;
    // ---- 3 · harmony
    const scale = c.sc.map(s => this.N[(s + c.tonic) % 12]).join(' '), pcs = c.pcs.map(p => this.N[p]).join(' ');
    const notes = c.notes.slice(0, 4).map(mi => `${nm(mi)}=${n(f(hz(mi), 1))}`).join(' ');
    const H = `<h5>03 · HARMONY</h5>
      <p>key ${n(this.N[c.tonic] + ' ' + c.mode)} = {${c.sc.join(',')}}</p>
      <p>${k(scale)}</p>
      <p>loop[${c.ci}] of ${c.loopLen} (${c.family}, cycle ${c.cycle}): ${n(c.chord.replace(/#/g, '♯'))}</p>
      <p>degree ${c.deg} · ${c.type} → {${pcs}}</p>
      <p>f = 440·2^((m−69)/12)</p><p class="wrap">${notes}</p>
      <p>sub ${nm(c.sub)} = ${n(f(hz(c.sub) / 2, 1))} Hz</p>`;
    // ---- 4 · voices (live equations)
    const vs = m.voices.slice().sort((a, b) => b.age - a.age); const seen = {}; const vl = [];
    for (const v of vs){ if (seen[v.slot] >= 1) continue; seen[v.slot] = (seen[v.slot] || 0) + 1; const S = v.slot.toUpperCase();
      if (v.kind === 'kick') vl.push(`<p>${k(S)} f(t) = fE + (fS−fE)·e<sup>−t/τ</sup> = ${f(v.fE, 0)} + ${f(v.fS - v.fE, 0)}·e<sup>−${f(v.t, 3)}/${f(v.tau, 3)}</sup> = ${n(f(v.f, 1))} Hz · amp ${n(f(v.amp))}</p>`);
      else if (v.kind === 'va' || v.kind === 'mono') vl.push(`<p>${k(S)} ${nm(v.note)} ${n(f(v.f, 1))} Hz · cut = ${f(v.base, 0)}·2^(${f(v.amt)}·${f(v.fenv)} + ${f(v.lfoCut)}·${f(v.lfo)}) = ${n(f(v.cut, 0))} Hz · env ${n(f(v.env))}</p>`);
      else if (v.kind === 'bass') vl.push(`<p>${k(S)} sub = sin(2π·${f(v.fsub, 1)}·t) · env ${n(f(v.env))} · harm LP ${n(f(v.cut, 0))} Hz</p>`);
      else if (v.kind === 'modal') vl.push(`<p>${k(S)} ${v.mk}: f<sub>k</sub> = k·${f(v.f, 1)}·√(1+B·k²) × ${n(v.n)} resonators · t ${n(f(v.t, 2))} s</p>`);
      else if (v.kind !== 'tex') vl.push(`<p>${k(S)} e = e<sub>0</sub>·k<sup>n</sup> → ${n(f(v.e, 3))} · t ${f(v.t, 3)} s${v.f ? ' · ' + f(v.f, 0) + ' Hz' : ''}</p>`);
      if (vl.length >= 7) break; }
    const V = `<h5>04 · VOICES NOW (${m.voices.length})</h5>${vl.join('') || '<p>' + k('silence') + '</p>'}`;
    // ---- 5 · rhythm
    const rl = []; const lcm = (a, b) => { const g = (x, y) => y ? g(y, x % y) : x; return a / g(a, b) * b; };
    for (const p of m.pats){ if (!p.active) continue; const S = p.slot.toUpperCase();
      if (p.lanes){ const L = p.lanes.filter(x => x.i !== undefined); if (L.length){ rl.push(`<p>${k(S)} ${L.map(x => `p${x.p}:${x.bits.split('').map((b, j) => j === x.i ? `<b>${b === '1' ? '●' : '○'}</b>` : (b === '1' ? '●' : '·')).join('')}`).join(' ')}</p>`); rl.push(`<p>&nbsp;&nbsp;LCM(${L.map(x => x.p).join(',')}) = ${n(big(L.reduce((a, x) => lcm(a, x.p), 1)))} steps till repeat</p>`); }
        else rl.push(`<p>${k(S)} ${p.lanes.map(x => `len ${x.len}: ${x.bits.replace(/1/g, '●').replace(/0/g, '·')}`).join(' ')}</p>`); }
      else if (p.bits) rl.push(`<p>${k(S)} E(${(p.bits.match(/1/g) || []).length},${p.bits.length}) ${p.bits.replace(/1/g, '●').replace(/0/g, '·')}</p>`);
      else if (p.phase) rl.push(`<p>${k(S)} period<sub>k</sub> = ${p.phase.base}·(1 + k·${f(p.phase.eps, 4)}) steps</p>`);
      if (rl.length >= 7) break; }
    const R = `<h5>05 · RHYTHM</h5>${rl.join('')}`;
    // ---- 6 · master
    const x = m.mix, eq = x.aeqF.map((fr, i) => `${fr >= 1000 ? fr / 1000 + 'k' : fr}:${x.aeqG[i] >= 0 ? '+' : ''}${f(x.aeqG[i], 1)}`).join(' ');
    const Mx = `<h5>06 · MASTER</h5>
      <p>gain = 10^((${x.target} − ${f(x.lref, 1)})/20) = ${n(f(x.autoGain, 2))}×</p>
      <p>LUFS ${n(f(x.lufs, 1))} · peak ${n(f(x.peak, 3))} · glue −${f(x.gr, 1)} dB</p>
      <p>duck g = 10^(−${x.duckDepth}·x/20) = ${n(f(x.duckB, 3))}${x.lastKick >= 0 ? ' · kick ' + f(x.lastKick * 1000, 0) + ' ms ago' : ''}</p>
      <p>auto-EQ dB ${eq}</p>
      <p>hall RT60 ${n(f(x.hallRT, 1))} s · delay fb ${n(f(x.delayFB, 2))} · tilt ${f(x.tilt, 1)} dB</p>
      <p>seed ${n(m.seed)} → this whole song</p>`;
    // ---- 7 · raw samples
    const raw = this.raw.slice(-9).map(v => `<p>${v >= 0 ? '+' : ''}${v.toFixed(5)}</p>`).join('');
    const W = `<h5>07 · OUTPUT</h5>${raw}`;
    this.el.innerHTML = `<div class="mc">${T}</div><div class="mc">${E}</div><div class="mc">${H}</div><div class="mc w2">${V}</div><div class="mc w2">${R}</div><div class="mc">${Mx}</div><div class="mc raw">${W}</div>`; } }
