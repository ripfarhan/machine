/* Maut ki Awaaz — engine module: utilities.
   Every engine file is one function that adds to a shared namespace A. The host builds the AudioWorklet source from
   these functions' own text (Function.prototype.toString) and loads it as a data: URL, which works from file://.
   The same functions load in a Worker (fast export) and in Node (automated evaluation). */
'use strict';
function AWZ_UTIL(A){
  const TAU = Math.PI * 2; A.TAU = TAU;
  A.clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  A.lerp = (a, b, k) => a + (b - a) * k;
  A.mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  A.dbToGain = db => Math.pow(10, db / 20);
  A.gainToDb = g => 20 * Math.log10(Math.max(1e-9, g));
  // fast, seedable PRNG (mulberry32) and a stable hash for sub-seeds
  A.rng = function(seed){ let a = (seed >>> 0) || 1; const f = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    f.range = (lo, hi) => lo + f() * (hi - lo); f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1)); f.pick = arr => arr[Math.floor(f() * arr.length)];
    f.chance = p => f() < p; f.gauss = () => { let u = 0, v = 0; while (u === 0) u = f(); while (v === 0) v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
    f.weighted = o => { let s = 0; for (const k in o) s += Math.max(0, o[k]); let x = f() * s; for (const k in o){ x -= Math.max(0, o[k]); if (x <= 0) return k; } return Object.keys(o)[0]; };
    return f; };
  A.hash = function(){ let h = 2166136261 >>> 0; for (let i = 0; i < arguments.length; i++){ const s = String(arguments[i]); for (let j = 0; j < s.length; j++){ h ^= s.charCodeAt(j); h = Math.imul(h, 16777619) >>> 0; } h ^= 0x9E3779B9; h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0; } return h >>> 0; };
  A.euclid = (k, n, rot) => { const o = []; for (let i = 0; i < n; i++) o.push(Math.floor((i + 1) * k / n) - Math.floor(i * k / n) ? 1 : 0); const r = ((rot | 0) % n + n) % n; return o.map((_, i) => o[(i - r + n) % n]); };
  // sine table, phase in cycles
  const SN = 8192, SIN = new Float32Array(SN + 1); for (let i = 0; i <= SN; i++) SIN[i] = Math.sin(i / SN * TAU);
  A.sin1 = ph => { ph -= Math.floor(ph); const x = ph * SN, i = x | 0; return SIN[i] + (SIN[i + 1] - SIN[i]) * (x - i); };
  // tanh approximation (Padé 7/6), accurate to ~1e-4 in [-3,3], clamped outside
  A.tanh = x => { if (x < -3) return -1; if (x > 3) return 1; const x2 = x * x; return x * (135135 + x2 * (17325 + x2 * (378 + x2))) / (135135 + x2 * (62370 + x2 * (3150 + x2 * 28))); };
  // one-pole smoothing coefficient for a time constant in seconds at a given rate
  A.coef = (sec, rate) => sec <= 0 ? 1 : 1 - Math.exp(-1 / (sec * rate));

  // time-ordered event queue (binary heap on .t, sample time)
  A.EventQueue = class { constructor(){ this.h = []; }
    push(e){ const h = this.h; h.push(e); let i = h.length - 1; while (i > 0){ const p = (i - 1) >> 1; if (h[p].t <= h[i].t) break; const tmp = h[p]; h[p] = h[i]; h[i] = tmp; i = p; } }
    peek(){ return this.h[0]; }
    pop(){ const h = this.h, top = h[0], last = h.pop(); if (h.length){ h[0] = last; let i = 0; for (;;){ const l = 2 * i + 1, r = l + 1; let m = i; if (l < h.length && h[l].t < h[m].t) m = l; if (r < h.length && h[r].t < h[m].t) m = r; if (m === i) break; const tmp = h[m]; h[m] = h[i]; h[i] = tmp; i = m; } } return top; }
    get size(){ return this.h.length; }
    clear(){ this.h.length = 0; }
    filter(fn){ this.h = this.h.filter(fn); const o = this.h; this.h = []; for (const e of o) this.push(e); } };

  // outbox: what the engine tells the UI. Notes are posted when SCHEDULED (ahead of time), with their audible time,
  // so the UI can draw the future. Flat numeric records keep structured-clone cost low.
  A.Outbox = class { constructor(cap){ this.cap = cap || 4096; this.notes = new Float64Array(this.cap * 6); this.n = 0; this.msgs = []; }
    note(t, track, pitch, vel, dur){ if (this.n >= this.cap) return; const o = this.n++ * 6, N = this.notes; N[o] = t; N[o + 1] = track; N[o + 2] = pitch; N[o + 3] = vel; N[o + 4] = dur; N[o + 5] = 0; }
    msg(m){ this.msgs.push(m); }
    drain(){ const out = {notes: this.notes.slice(0, this.n * 6), msgs: this.msgs}; this.n = 0; this.msgs = []; return out; } };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_UTIL;
