/* Maut ki Awaaz — MATH view: the live numbers inside the engine, plugged into their formulas.
   Toggle with ∑ MATH or the M key. Engine telemetry arrives ~15/s; between snapshots the clock, phases, samples and the
   spectrum are computed every frame here, so the numbers never sit still. Digits that changed since the last frame glow. */
'use strict';
class AwaazMath {
  constructor(el){ this.el = el; this.m = null; this.at = 0; this.last = 0; this.prev = []; this.N = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']; }
  feed(m){ this.m = m; this.at = performance.now(); }
  render(F, playing){ const now = performance.now(); if (!this.m || now - this.last < 33) return; this.last = now; const m = this.m, c = m.comp; if (!c) return;
    let idx = 0; const prev = this.prev, cur = [];
    const n = (x, d) => { const s = typeof x === 'string' ? x : (x === undefined || x === null || !isFinite(x) ? '–' : (+x).toFixed(d === undefined ? 2 : d)); const i = idx++; cur[i] = s; return `<b${prev[i] !== undefined && prev[i] !== s ? ' class="c"' : ''}>${s}</b>`; };
    const k = x => `<i>${x}</i>`, hz = mi => 440 * Math.pow(2, (mi - 69) / 12), nm = mi => this.N[((mi % 12) + 12) % 12] + (Math.floor(mi / 12) - 1), big = x => Math.round(x).toLocaleString('en-US'), f = (x, d) => (+x).toFixed(d === undefined ? 2 : d);
    const sr = m.sr, tS = m.t + (playing ? (now - this.at) / 1000 * sr : 0), sec = tS / sr, barF = (tS - (c.k * c.barN - c.barN)) / c.barN;
    const stepInBar = Math.max(0, Math.min(15, Math.floor(((tS / c.stepN) % 16 + 16) % 16)));
    // 01 clock
    const prog = '▮'.repeat(stepInBar + 1) + '▯'.repeat(15 - stepInBar);
    const T = `<h5>01 · CLOCK</h5>
      <p class="xl">${n(big(tS))}</p>
      <p>÷${big(sr)} = ${n(sec, 3)} s</p>
      <p>${n(String(stepInBar + 1).padStart(2, '0'))} ${k(prog)}</p>
      <p>Σ ${n(big(tS * 2))} nums</p>`;
    // 02 energy
    const lerp = c.E0 + (c.E1 - c.E0) * c.prog;
    const E = `<h5>02 · ENERGY</h5>
      <p>${n(c.E0)}→${n(c.E1)} @${n(c.prog)} = ${n(lerp, 3)}</p>
      <p>+(${n(c.mE)}−.5)·.7 = ${n(c.E, 3)}</p>
      <p>D=${n(c.mDen)}·1.15+E/4−.2=${n(c.density, 3)}</p>
      <p>${k(c.section.toUpperCase())} ${n(c.bis + 1, 0)}/${c.sbars} ${'█'.repeat(Math.round(c.E * 8))}${'░'.repeat(8 - Math.round(c.E * 8))}</p>`;
    // 03 harmony: live oscillator phases of the chord tones  φ = frac(f·t)
    const ph = c.notes.slice(0, 3).map(mi => { const fr = hz(mi), p = (fr * sec) % 1; return `<p>${nm(mi)} ${n(fr, 1)} φ${n(p, 3)}</p>`; }).join('');
    const H = `<h5>03 · ${this.N[c.tonic]} ${c.mode.toUpperCase()}</h5>
      <p>${n(c.chord.replace(/#/g, '♯'))} ${k('f=440·2^((m−69)/12)')}</p>${ph}`;
    // 04 voices (spans both rows)
    const vs = m.voices.slice().sort((a, b) => b.age - a.age), seen = {}, vl = [];
    for (const v of vs){ if (seen[v.slot]) continue; seen[v.slot] = 1; const S = k(v.slot.toUpperCase());
      if (v.kind === 'kick') vl.push(`<p>${S} ${n(v.fE, 0)}+${n(v.fS - v.fE, 0)}e<sup>−t/τ</sup>=${n(v.f, 1)}Hz a${n(v.amp, 3)}</p>`);
      else if (v.kind === 'va' || v.kind === 'mono') vl.push(`<p>${S} ${n(v.f, 1)}Hz cut ${n(v.cut, 0)} lfo ${n(v.lfo, 2)} e ${n(v.env, 3)}</p>`);
      else if (v.kind === 'bass') vl.push(`<p>${S} sin(2π·${n(v.fsub, 1)}t)·${n(v.env, 3)}</p>`);
      else if (v.kind === 'modal') vl.push(`<p>${S} k·${n(v.f, 1)}√(1+Bk²) ×${v.n} t${n(v.t, 2)}</p>`);
      else if (v.kind !== 'tex') vl.push(`<p>${S} e₀k<sup>n</sup>=${n(v.e, 4)} t${n(v.t, 3)}</p>`);
      if (vl.length >= 12) break; }
    const V = `<h5>04 · VOICES NOW · ${n(m.voices.length, 0)}</h5>${vl.join('') || '<p>' + k('silence') + '</p>'}`;
    // 05 to the speaker: the actual samples of this frame (analyser)
    const L = F.tl, R = F.tr; let ss = 0, slr = 0, sl = 0, sr2 = 0; for (let i = 0; i < L.length; i += 4){ ss += L[i] * L[i]; slr += L[i] * R[i]; sl += L[i] * L[i]; sr2 += R[i] * R[i]; }
    const rms = 20 * Math.log10(Math.sqrt(ss / (L.length / 4)) + 1e-9), rho = slr / Math.sqrt(sl * sr2 + 1e-12); const raw = []; for (let i = 0; i < 4; i++){ const v = L[i * 197]; raw.push(`<span>${n((v >= 0 ? '+' : '') + v.toFixed(5))}</span>`); }
    const W = `<h5>05 · TO SPEAKER</h5><div class="rawg">${raw.join('')}</div><p>RMS ${n(rms, 1)} ρ ${n(rho, 2)}</p>`;
    // 06 FFT peaks (this frame)
    const fd = F.fd, binHz = sr / (fd.length * 2), pk = []; for (let i = 3; i < fd.length - 1 && i * binHz < 12000; i++) if (fd[i] > fd[i - 1] && fd[i] >= fd[i + 1] && fd[i] > -70) pk.push([fd[i], i]); pk.sort((a, b) => b[0] - a[0]);
    const peaks = pk.slice(0, 3).sort((a, b) => a[1] - b[1]).map(([db, i]) => `<p>${n(i * binHz, 0)} Hz ${n(db, 1)} dB</p>`).join('');
    const X = `<h5>06 · FFT Σx·e<sup>−2πift</sup></h5>${peaks || '<p>' + k('…') + '</p>'}`;
    // 07 rhythm: the live step walks through each pattern
    const rl = [], gs = Math.floor(tS / c.stepN); const lcm = (a, b) => { const g = (x, y) => y ? g(y, x % y) : x; return a / g(a, b) * b; };
    for (const p of m.pats){ if (!p.active) continue; const S = k(p.slot.toUpperCase()); const draw = (bits, i) => bits.split('').map((b, j) => j === i ? `<b class="c">${b === '1' ? '●' : '○'}</b>` : (b === '1' ? '●' : '·')).join('');
      if (p.lanes){ const Ls = p.lanes.filter(x => x.i !== undefined); if (Ls.length) rl.push(`<p>${S} ${Ls.slice(0, 3).map(x => draw(x.bits, gs % x.p)).join(' ')} ${k('LCM')} ${n(big(Ls.reduce((a, x) => lcm(a, x.p), 1)), 0)}</p>`); else rl.push(`<p>${S} ${draw(p.lanes[0].bits, gs % p.lanes[0].bits.length)}</p>`); }
      else if (p.bits) rl.push(`<p>${S} E(${(p.bits.match(/1/g) || []).length},${p.bits.length}) ${draw(p.bits, gs % p.bits.length)}</p>`);
      else if (p.phase) rl.push(`<p>${S} T<sub>k</sub>=${p.phase.base}·(1+k·${n(p.phase.eps, 4)})</p>`);
      if (rl.length >= 4) break; }
    const Rr = `<h5>07 · RHYTHM</h5>${rl.join('') || '<p>' + k('no pattern') + '</p>'}`;
    // 08 master
    const x = m.mix;
    const Mx = `<h5>08 · MASTER</h5>
      <p>LUFS ${n(x.lufs, 2)} pk ${n(x.peak, 3)}</p>
      <p>g=10^(Δ/20)=${n(x.autoGain, 3)}×</p>
      <p>duck 10^(−${x.duckDepth}x/20)=${n(x.duckB, 3)}</p>
      <p>${k('FX')} ${x.gateOn ? n('gate●') : ''} hp ${n(x.hp, 0)} ${x.fsh ? 'shift ' + n(x.fsh, 1) + 'Hz ' : ''}${x.bus === 1 ? n('TAPE STOP') : x.bus === 2 ? n('STUTTER') : ''} ${(x.sends || []).join(' ')}</p>`;
    this.prev = cur;
    this.el.innerHTML = `<div class="mc">${T}</div><div class="mc">${E}</div><div class="mc">${H}</div><div class="mc">${Mx}</div><div class="mc vv">${V}</div><div class="mc">${W}</div><div class="mc">${X}</div><div class="mc w2">${Rr}</div>`; } }
