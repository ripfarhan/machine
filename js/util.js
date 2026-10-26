/* Glitch Reel Machine — shared helpers */
'use strict';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash1 = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const fmt = t => { t = Math.max(0, t); const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };
const fmt0 = t => fmt(t).replace(/\.\d$/, '');
const pick = (r, arr) => arr[(r() * arr.length) | 0];
const rr = (r, a, b) => a + r() * (b - a);
const pickW = (r, obj) => { let tot = 0; for (const k in obj) tot += obj[k]; let x = r() * tot; for (const k in obj){ x -= obj[k]; if (x <= 0) return k; } return Object.keys(obj)[0]; };
