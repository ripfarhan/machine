/* Glitch Reel Machine — audio analysis: FFT, band energies, onsets, hype, drops, beat grid */
'use strict';
const AFPS = 100;

function FFT(n){
  const rev = new Uint32Array(n); let bits = 0; while ((1 << bits) < n) bits++;
  for (let i = 0; i < n; i++){ let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
  const cos = new Float32Array(n / 2), sin = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++){ cos[i] = Math.cos(-2 * Math.PI * i / n); sin[i] = Math.sin(-2 * Math.PI * i / n); }
  return function(re, im){
    for (let i = 0; i < n; i++){ const j = rev[i]; if (j > i){ let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let size = 2; size <= n; size <<= 1){ const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) for (let j = 0, k = 0; j < half; j++, k += step){
        const tr = re[i + j + half] * cos[k] - im[i + j + half] * sin[k], ti = re[i + j + half] * sin[k] + im[i + j + half] * cos[k];
        re[i + j + half] = re[i + j] - tr; im[i + j + half] = im[i + j] - ti; re[i + j] += tr; im[i + j] += ti; } }
  };
}
const pct = (arr, p) => { const a = Array.from(arr).filter(x => isFinite(x)).sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(p * (a.length - 1)))] : 1; };
const normP = (arr, p = .97) => { const d = pct(arr, p) || 1; const o = new Float32Array(arr.length); for (let i = 0; i < arr.length; i++) o[i] = clamp(arr[i] / d, 0, 1); return o; };
const smoothAR = (arr, rel, att = 0) => { const o = new Float32Array(arr.length); let v = 0; for (let i = 0; i < arr.length; i++){ v = arr[i] > v ? lerp(v, arr[i], 1 - att) : v * rel; o[i] = v; } return o; };
const movAvg = (arr, w) => { const o = new Float32Array(arr.length), n = arr.length; let s = 0; const q = [];
  for (let i = 0; i < n + w; i++){ if (i < n){ s += arr[i]; q.push(arr[i]); } if (q.length > 2 * w + 1){ s -= q.shift(); } if (i >= w) o[i - w] = s / q.length; } return o; };
async function analyzeBuffer(buffer, onProgress){
  const sr0 = buffer.sampleRate, ch = buffer.numberOfChannels, dec = sr0 > 30000 ? 2 : 1, sr = sr0 / dec;
  const L = buffer.getChannelData(0), R = ch > 1 ? buffer.getChannelData(1) : L, n = Math.floor(L.length / dec), x = new Float32Array(n);
  for (let i = 0; i < n; i++){ let s = 0; for (let d = 0; d < dec; d++) s += L[i * dec + d] + R[i * dec + d]; x[i] = s / (2 * dec); }
  const N = 2048, hop = Math.round(sr / AFPS), frames = Math.max(1, Math.floor((n - N) / hop)), fft = FFT(N);
  const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = .5 - .5 * Math.cos(2 * Math.PI * i / N);
  const hz = i => i * sr / N, edges = [20, 60, 200, 800, 3000, 9000, sr / 2];
  const bins = edges.map(e => Math.min(N / 2, Math.round(e / (sr / N))));
  const bandE = Array.from({length: 6}, () => new Float32Array(frames)), bandF = Array.from({length: 6}, () => new Float32Array(frames));
  const rms = new Float32Array(frames), cent = new Float32Array(frames);
  const re = new Float32Array(N), im = new Float32Array(N), mag = new Float32Array(N / 2), prev = new Float32Array(N / 2);
  for (let f = 0; f < frames; f++){
    const o = f * hop; let e = 0;
    for (let i = 0; i < N; i++){ const v = x[o + i]; re[i] = v * win[i]; im[i] = 0; e += v * v; }
    rms[f] = Math.sqrt(e / N); fft(re, im);
    let cs = 0, ms = 0;
    for (let i = 1; i < N / 2; i++){ mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]); cs += mag[i] * hz(i); ms += mag[i]; }
    cent[f] = ms > 0 ? cs / ms : 0;
    for (let b = 0; b < 6; b++){ let s = 0, fl = 0; for (let i = bins[b]; i < bins[b + 1]; i++){ s += mag[i] * mag[i]; fl += Math.max(0, mag[i] - prev[i]); }
      bandE[b][f] = Math.log1p(s * 4); bandF[b][f] = fl; }
    prev.set(mag);
    if ((f & 255) === 0 && onProgress){ onProgress(f / frames); await new Promise(r => setTimeout(r, 0)); }
  }
  const S = {};
  const nm = ['sub', 'bass', 'lomid', 'mid', 'high', 'air'];
  nm.forEach((k, b) => S['e_' + k] = smoothAR(normP(bandE[b], .98), .88, .2));
  S.sub = S.e_sub; S.bass = S.e_bass; S.mid = new Float32Array(frames).map((_, i) => Math.max(S.e_lomid[i], S.e_mid[i])); S.high = new Float32Array(frames).map((_, i) => Math.max(S.e_high[i], S.e_air[i]));
  const onsetOf = (idx, rel) => { const o = new Float32Array(frames); for (let i = 0; i < frames; i++){ let s = 0; for (const b of idx) s += bandF[b][i]; o[i] = s; } return smoothAR(normP(o, .985), rel); };
  S.kick = onsetOf([0, 1], .78); S.snare = onsetOf([2, 3], .8); S.hat = onsetOf([4, 5], .72);
  const all = new Float32Array(frames); for (let i = 0; i < frames; i++) all[i] = bandF[0][i] + bandF[1][i] + .7 * (bandF[2][i] + bandF[3][i]) + .4 * (bandF[4][i] + bandF[5][i]);
  const onset = normP(all, .985); S.onset = onset; S.punch = smoothAR(onset, .9);
  S.loud = normP(movAvg(rms, 15), .98);
  const slow = movAvg(normP(rms, .99), 150), dens = movAvg(S.high, 150), hy = new Float32Array(frames);
  for (let i = 0; i < frames; i++) hy[i] = slow[i] * .8 + dens[i] * .35;
  const lo = pct(hy, .03), hi = pct(hy, .985) || 1; S.hype = hy.map(v => clamp((v - lo) / Math.max(1e-6, hi - lo), 0, 1));
  const build = new Float32Array(frames); for (let i = 0; i < frames; i++){ const a = S.hype[Math.max(0, i - 250)], b = S.hype[Math.min(frames - 1, i + 50)]; build[i] = clamp((b - a) * 2.2, 0, 1); } S.build = movAvg(build, 30);
  // drops: hype jumps after a dip, with a kick present
  const drops = []; for (let i = 120; i < frames - 60; i++){ const before = S.hype[i - 100], after = S.hype[Math.min(frames - 1, i + 40)];
    if (after - before > .28 && before < .62 && S.kick[i] > .4 && (!drops.length || i - drops[drops.length - 1] > 8 * AFPS)) drops.push(i); }
  S.dropTimes = drops.map(i => i / AFPS);
  S.drop = new Float32Array(frames); drops.forEach(d => { for (let i = d; i < Math.min(frames, d + 400); i++) S.drop[i] = Math.max(S.drop[i], Math.exp(-(i - d) / 180)); });
  S.bright = movAvg(normP(cent, .98), 4);
  // tempo + phase + downbeat
  let best = 0, bl = 50; const mean = onset.reduce((s, v) => s + v, 0) / frames;
  for (let lag = Math.floor(AFPS * 60 / 185); lag <= Math.ceil(AFPS * 60 / 68); lag++){ let s = 0; for (let i = lag; i < frames; i++) s += (onset[i] - mean) * (onset[i - lag] - mean);
    const bpm = 60 * AFPS / lag, w = Math.exp(-Math.pow(Math.log2(bpm / 118), 2) * 1.4); if (s * w > best){ best = s * w; bl = lag; } }
  S.bpm = 60 * AFPS / bl; S.frames = frames; S.duration = frames / AFPS;
  S.peakAt = (() => { let m = 0, at = 0; for (let i = 0; i < frames; i++) if (S.hype[i] > m){ m = S.hype[i]; at = i; } return at / AFPS; })();
  return S;
}
function beatGrid(S, from, to){
  const per = 60 / S.bpm, on = S.onset; let best = -1, bo = 0;
  for (let k = 0; k < 48; k++){ const off = per * k / 48; let s = 0; for (let t = from + off; t < to; t += per){ const i = Math.round(t * AFPS); if (i < on.length) s += on[i] + .5 * S.kick[i]; } if (s > best){ best = s; bo = off; } }
  const beats = []; for (let t = from + bo; t < to; t += per) beats.push(t);
  let bestD = -1, dOff = 0; for (let o = 0; o < 4; o++){ let s = 0; for (let i = o; i < beats.length; i += 4){ const fi = Math.round(beats[i] * AFPS); if (fi < S.bass.length) s += S.bass[fi] + S.kick[fi]; } if (s > bestD){ bestD = s; dOff = o; } }
  // beat / bar phase curves (relative to window start)
  const n = Math.round((to - from) * AFPS), beat = new Float32Array(n), bar = new Float32Array(n);
  for (let i = 0; i < n; i++){ const t = from + i / AFPS, ph = ((t - from - bo) / per); beat[i] = ph < 0 ? 0 : ph - Math.floor(ph); const bp = (ph - dOff) / 4; bar[i] = ph < 0 ? 0 : bp - Math.floor(bp); }
  return {beats, downbeatOffset: dOff, beat, bar, per};
}

