// node studio/test/dsp.test.js  — checks the tuner end to end on a synthetic singer.
const D = require('./load.js');
const fs = require('fs'), path = require('path');
const sr = 44100;
let fails = 0;
const ok = (name, cond, info) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!cond) fails++; };
const cents = (a, b) => 100 * (a - b);

const spec = D.demoNotes();
let t0 = Date.now();
const { x, truth } = D.synthVocal(sr, spec, 7);
console.log('synth', x.length / sr, 's in', Date.now() - t0, 'ms');
if (process.argv.includes('--wav')) fs.writeFileSync(path.join(process.argv[process.argv.indexOf('--wav') + 1], 'demo_in.wav'), Buffer.from(D.encodeWav([x], sr, 16)));

t0 = Date.now();
const an = D.analyzePitch(x, sr);
const tAn = Date.now() - t0;
console.log('analysis', tAn, 'ms', 'frames', an.frames, 'x realtime', (x.length / sr / (tAn / 1000)).toFixed(0));

// 1. pitch tracker vs truth
{
  const errs = []; let voicedTruth = 0, voicedHit = 0, falseV = 0, unv = 0;
  for (let t = 0; t < an.frames; t++) {
    const s = t * an.hop, tr = s < truth.length ? truth[s] : 0;
    // skip frames within 25 ms of a note edge
    const s0 = Math.max(0, s - 1100), s1 = Math.min(truth.length - 1, s + 1100);
    const interior = tr && truth[s0] && truth[s1];
    if (interior) { voicedTruth++; if (an.midi[t]) { voicedHit++; errs.push(Math.abs(cents(an.midi[t], tr))); } }
    if (!tr && !truth[s0] && !truth[s1]) { unv++; if (an.midi[t]) falseV++; }
  }
  errs.sort((a, b) => a - b);
  const med = errs[errs.length >> 1], p95 = errs[Math.floor(errs.length * 0.95)];
  ok('tracker recall', voicedHit / voicedTruth > 0.98, (100 * voicedHit / voicedTruth).toFixed(1) + '%');
  ok('tracker false voiced', falseV / unv < 0.02, (100 * falseV / unv).toFixed(2) + '%');
  ok('tracker median error', med < 3, med.toFixed(2) + ' cents');
  ok('tracker p95 error', p95 < 15, p95.toFixed(2) + ' cents');
}

// 2. notes + key
const notes = D.segmentNotes(an.midi, D.scaleMask(9, 'minor'), 0);
const chromNotes = D.segmentNotes(an.midi);
{
  console.log('notes found', notes.length, 'expected', spec.length);
  console.log(notes.map(n => D.noteName(n.center) + (cents(n.center, Math.round(n.center)) >= 0 ? '+' : '') + cents(n.center, Math.round(n.center)).toFixed(0)).join(' '));
  ok('note count', notes.length === spec.length, notes.length + ' vs ' + spec.length);
  const keys = D.keysFromChroma(D.chromaFromNotes(chromNotes));
  console.log('key guess', keys.slice(0, 3).map(k => D.NOTE_NAMES[k.key] + ' ' + k.scale + ' ' + k.score.toFixed(2)).join(', '));
  ok('key = A minor or C major', (keys[0].key === 9 && keys[0].scale === 'minor') || (keys[0].key === 0 && keys[0].scale === 'major'));
}

// 3. resynthesis
const prep = D.prepare(x, an);
console.log('islands', prep.islands.length, 'marks', prep.islands.reduce((a, i) => a + i.marks.length, 0));
const P = D.defaultTune(); P.key = 9; P.scale = 'minor';
function render(Pp, nts) {
  const corr = D.computeCorrection(an, nts || notes, Pp);
  const out = new Float32Array(x);
  const t = Date.now();
  for (const p of D.renderVoice(prep, corr, {})) out.set(p.data, p.start);
  return { out, corr, ms: Date.now() - t };
}
{
  const r = render(Object.assign({}, P, { amount: 0, humanize: 0 }));
  let md = 0; for (let i = 0; i < x.length; i++) md = Math.max(md, Math.abs(r.out[i] - x[i]));
  ok('amount 0 is bit-transparent', md < 1e-6, 'max diff ' + md.toExponential(2));
}
{
  // force resynthesis with a shift of zero cents: exercises the grain path, must still equal the input
  const corr = D.computeCorrection(an, notes, Object.assign({}, P, { amount: 0 }));
  let md = 0;
  for (const isl of prep.islands) {
    const y = D.renderIsland(prep, isl, corr.st, corr.fo, corr.gain);
    for (let k = 0; k < y.length; k++) md = Math.max(md, Math.abs(y[k] - x[isl.A + k]));
  }
  ok('grain path reconstructs input at ratio 1', md < 1e-4, 'max diff ' + md.toExponential(2));
}
function measure(out, corr, label, tol) {
  const an2 = D.analyzePitch(out, sr);
  const errs = []; let lost = 0, tot = 0;
  for (const n of notes) {
    const a = n.s + Math.min(6, (n.e - n.s) >> 2), b = n.e - Math.min(6, (n.e - n.s) >> 2);
    for (let t = a; t < b; t++) { tot++; if (!an2.midi[t]) { lost++; continue; } errs.push(Math.abs(cents(an2.midi[t], corr.out[t]))); }
  }
  errs.sort((a, b) => a - b);
  const med = errs[errs.length >> 1], p95 = errs[Math.floor(errs.length * 0.95)];
  let clar = 0, cn = 0; for (let t = 0; t < an2.frames; t++) if (an2.midi[t]) { clar += an2.conf[t]; cn++; }
  const oct = errs.filter(e => e > 600).length / errs.length;
  ok(label + ': output follows the curve', med < tol && p95 < tol * 5 && oct < 0.01, 'median ' + med.toFixed(2) + 'c  p95 ' + p95.toFixed(2) + 'c  lost ' + (100 * lost / tot).toFixed(1) + '%  octave slips ' + (100 * oct).toFixed(1) + '%');
  return { clar: clar / cn };
}
let clarIn = 0, cn = 0; for (let t = 0; t < an.frames; t++) if (an.midi[t]) { clarIn += an.conf[t]; cn++; } clarIn /= cn;
{
  const hard = Object.assign({}, P, { retune: 0, humanize: 0, vibrato: 0 });
  const r = render(hard);
  console.log('hard tune render', r.ms, 'ms');
  const m = measure(r.out, r.corr, 'hard tune', 3);
  // every note must land on a scale note
  const mask = D.tuneMask(hard); let offScale = 0;
  r.corr.targets.forEach(tg => { if (!mask[((Math.round(tg) % 12) + 12) % 12] || Math.abs(tg - Math.round(tg)) > 1e-6) offScale++; });
  ok('targets are in A minor', offScale === 0);
  const want = spec.map(s => s.midi), got = Array.from(r.corr.targets).map(Math.round);
  ok('targets match the intended melody', JSON.stringify(want) === JSON.stringify(got), got.map(D.noteName).join(' '));
  ok('hard tune keeps the voice periodic', m.clar > clarIn - 0.03, 'clarity ' + m.clar.toFixed(3) + ' vs input ' + clarIn.toFixed(3));
  if (process.argv.includes('--wav')) fs.writeFileSync(path.join(process.argv[process.argv.indexOf('--wav') + 1], 'demo_hard.wav'), Buffer.from(D.encodeWav([r.out], sr, 16)));
}
{
  const r = render(P);
  measure(r.out, r.corr, 'natural tune', 4);
  // natural settings must centre each note: mean of the output curve close to the target
  let worst = 0;
  notes.forEach((n, i) => { let a = 0, c = 0; for (let t = n.s + 8; t < n.e - 4; t++) if (r.corr.out[t]) { a += r.corr.out[t]; c++; } if (c > 10) worst = Math.max(worst, Math.abs(cents(a / c, r.corr.targets[i]))); });
  ok('natural tune centres every note', worst < 15, 'worst note mean off by ' + worst.toFixed(1) + 'c');
  if (process.argv.includes('--wav')) fs.writeFileSync(path.join(process.argv[process.argv.indexOf('--wav') + 1], 'demo_natural.wav'), Buffer.from(D.encodeWav([r.out], sr, 16)));
}
{
  // big shifts (harmony range) and formant moves
  for (const semis of [-5, 4, 7]) {
    const corr = D.computeCorrection(an, notes, Object.assign({}, P, { retune: 0, humanize: 0, vibrato: 0 }));
    const h = D.harmonyCurves(an, notes, P, corr, { mode: 'semi', amount: semis, cents: 0, formant: 0 });
    const out = new Float32Array(x);
    for (const p of D.renderVoice(prep, h, {})) out.set(p.data, p.start);
    const m = measure(out, h, 'shift ' + semis + ' st', 4);
    let e0 = 0, e1 = 0; for (let i = 0; i < x.length; i++) { e0 += x[i] * x[i]; e1 += out[i] * out[i]; }
    console.log('   level change', (10 * Math.log10(e1 / e0)).toFixed(2), 'dB  clarity', m.clar.toFixed(3));
  }
  const corr = D.computeCorrection(an, notes, Object.assign({}, P, { formant: 3 }));
  const out = new Float32Array(x);
  for (const p of D.renderVoice(prep, corr, {})) out.set(p.data, p.start);
  measure(out, corr, 'formant +3', 4);
}
{
  // diatonic third above: every harmony target must be a scale note
  const corr = D.computeCorrection(an, notes, P);
  const mask = D.tuneMask(P); let bad = 0;
  corr.targets.forEach(tg => { const h = D.shiftDegrees(tg, 2, mask); if (!mask[((Math.round(h) % 12) + 12) % 12] || h - tg < 3 || h - tg > 4) bad++; });
  ok('third-above harmony stays in key', bad === 0);
}
{
  // cache: second render with one note moved only recomputes that island
  const cache = {}; const c1 = D.computeCorrection(an, notes, P);
  D.renderVoice(prep, c1, cache);
  const n2 = notes.map(n => Object.assign({}, n)); n2[2].manual = 67;
  const p2 = D.renderVoice(prep, D.computeCorrection(an, n2, P), cache);
  ok('edit re-renders one island only', p2.length === 1, p2.length + ' patches');
}
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
