/* Machine Studio — the vocal chain and master bus, built from stock Web Audio nodes so the same
   graph runs live and inside an OfflineAudioContext for export.
   vocal in -> gate/rider automation -> low cut -> de-esser -> EQ -> compressor -> saturation
            -> dry + delay send + reverb send -> fader/pan -> master -> limiter -> out
   beat in  -> latency-matching delay -> fader ---------------^                                   */
(function () {
  'use strict';
  const dbToLin = db => Math.pow(10, db / 20);

  function defaults() {
    return {
      input: { gain: 0 },
      gate: { on: false, thresh: -48, range: 30 },
      rider: { on: false, amt: 0.5 },
      hpf: { on: true, freq: 90 },
      deess: { on: true, freq: 6200, thresh: -30, ratio: 6 },
      eq: { on: true, lowF: 180, lowG: 0, mudF: 320, mudG: -2, presF: 3800, presG: 2, airF: 11000, airG: 3 },
      comp: { on: true, thresh: -22, ratio: 3.5, attack: 6, release: 140, makeup: 4 },
      sat: { on: false, drive: 0.25 },
      delay: { on: true, time: 340, sync: 'off', fb: 0.28, tone: 3600, wide: true, level: -18 },
      reverb: { on: true, type: 'plate', decay: 1.6, pre: 25, tone: 7000, level: -15 },
      vocal: { level: 0, pan: 0 },
      beat: { level: -4 },
      master: { level: 0, limit: true }
    };
  }

  /* DynamicsCompressorNode adds make-up gain on its own (per spec: the 0.6 power of the inverse of the
     curve's gain at 0 dBFS). This reproduces the curve so the chain can cancel it and keep levels honest. */
  function compAutoMakeup(thr, knee, ratio) {
    const lin = dbToLin(thr), todb = v => 20 * Math.log10(v);
    const kneeCurve = (x, k) => x < lin ? x : lin + (1 - Math.exp(-k * (x - lin))) / k;
    const slopeAt = (x, k) => {
      if (x < lin) return 1;
      const x2 = x * 1.001;
      return (todb(kneeCurve(x2, k)) - todb(kneeCurve(x, k))) / (todb(x2) - todb(x));
    };
    let k = 5;
    if (knee > 0) {
      const xk = dbToLin(thr + knee); let lo = 0.1, hi = 10000;
      for (let i = 0; i < 15; i++) { if (slopeAt(xk, k) < 1 / ratio) hi = k; else lo = k; k = Math.sqrt(lo * hi); }
    }
    const kneeDb = thr + knee, kneeLin = dbToLin(kneeDb), yKnee = todb(kneeCurve(kneeLin, k));
    const full = 1 < kneeLin ? kneeCurve(1, k) : dbToLin(yKnee + (0 - kneeDb) / ratio);
    return Math.pow(1 / full, 0.6);
  }

  // Reverb impulse: decaying stereo noise, highs dying faster than lows.
  function makeIR(ctx, type, decay, tone) {
    const sr = ctx.sampleRate, len = Math.max(64, Math.ceil(sr * Math.min(9, decay * 1.25 + 0.15)));
    const buf = ctx.createBuffer(2, len, sr);
    const build = type === 'hall' ? 0.045 : type === 'room' ? 0.004 : 0.008;
    let seed = 1234567;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let lp = 0, hp = 0, hx = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr, env = Math.exp(-6.9 * t / decay) * (1 - Math.exp(-t / build));
        const fc = Math.max(900, tone * Math.exp(-1.6 * t / decay));
        const a = 1 - Math.exp(-2 * Math.PI * fc / sr);
        lp += a * (rnd() - lp);
        hp = lp - hx + 0.985 * hp; hx = lp;                 // keep the low mud out of the tail
        d[i] = hp * env;
      }
      if (type === 'room') {                                 // a few early slaps
        for (let k = 0; k < 9; k++) { const p = Math.floor(sr * (0.004 + 0.006 * k + 0.003 * (rnd() + 1))); if (p < len) d[p] += (rnd() > 0 ? 1 : -1) * 0.5 * Math.exp(-k / 4); }
      }
    }
    return buf;
  }

  function satCurve(drive, on) {
    const n = 2049, c = new Float32Array(n), k = 1 + 7 * drive;
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1) * 2 - 1;
      c[i] = on ? Math.tanh(k * x) / Math.tanh(k) * Math.pow(Math.tanh(k) / k, 0.7) : x;
    }
    return c;
  }
  function clipCurve() {
    const n = 4097, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1) * 2 - 1) * 2, a = Math.abs(x);   // input range -2..2
      c[i] = Math.sign(x) * (a < 0.85 ? a : 0.85 + 0.14 * Math.tanh((a - 0.85) / 0.14));
    }
    return c;
  }

  const SYNC = { '1/4': 1, '1/8': 0.5, '1/8d': 0.75, '1/16': 0.25, '1/4t': 2 / 3 };

  /* create(ctx, lat): lat = { comp, chain } latencies in seconds (see measure()). */
  function create(ctx, lat) {
    lat = lat || { comp: 0.006, chain: 0.012 };
    const G = v => { const g = ctx.createGain(); g.gain.value = v == null ? 1 : v; return g; };
    // note: for lowpass/highpass the Web Audio Q is in dB, so Butterworth (0.707) is -3.01
    const BW = -3.0103;
    const BQ = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; };
    const DC = () => ctx.createDynamicsCompressor();
    const DL = (max, t) => { const d = ctx.createDelay(max); d.delayTime.value = t; return d; };

    const vocalIn = G(), trim = G(), gate = G();
    const hpf = BQ('highpass', 90, BW), hpf2 = BQ('highpass', 90, BW);
    // de-esser: Linkwitz-Riley split, compress only the top band
    const lo1 = BQ('lowpass', 6000, BW), lo2 = BQ('lowpass', 6000, BW), loDelay = DL(0.1, lat.comp);
    const hi1 = BQ('highpass', 6000, BW), hi2 = BQ('highpass', 6000, BW), deComp = DC(), deComp2 = G(), deSum = G();
    const eqLow = BQ('lowshelf', 180), eqMud = BQ('peaking', 320, 1.1), eqPres = BQ('peaking', 3800, 0.9), eqAir = BQ('highshelf', 11000);
    const comp = DC(), compTrim = G();
    const sat = ctx.createWaveShaper(); sat.curve = satCurve(0, false);
    const dry = G(), fader = G(), pan = ctx.createStereoPanner();
    // delay: two cross-fed lines (ping-pong)
    const dSend = G(0), dIn = G(), dL = DL(2.5, 0.34), dR = DL(2.5, 0.34), dToneL = BQ('lowpass', 3600, BW), dToneR = BQ('lowpass', 3600, BW);
    const dFbL = G(0.3), dFbR = G(0.3), dPanL = ctx.createStereoPanner(), dPanR = ctx.createStereoPanner(), dHp = BQ('highpass', 180, BW);
    // reverb
    const rSend = G(0), rPre = DL(0.5, 0.025), conv = ctx.createConvolver(), rOut = G(1.6);
    const beatIn = G(), beatDelay = DL(0.2, lat.chain), beatGain = G();
    const master = G(), limiter = DC(), limTrim = G(), clip = ctx.createWaveShaper(), out = G();
    clip.curve = clipCurve();
    const preClip = G(0.5), postClip = G(1);                // waveshaper input is -1..1, feed it half scale

    vocalIn.connect(trim); trim.connect(gate); gate.connect(hpf); hpf.connect(hpf2);
    hpf2.connect(lo1); lo1.connect(lo2); lo2.connect(loDelay); loDelay.connect(deSum);
    hpf2.connect(hi1); hi1.connect(hi2); hi2.connect(deComp); deComp.connect(deComp2); deComp2.connect(deSum);
    deSum.connect(eqLow); eqLow.connect(eqMud); eqMud.connect(eqPres); eqPres.connect(eqAir);
    eqAir.connect(comp); comp.connect(compTrim); compTrim.connect(sat); sat.connect(dry);
    dry.connect(fader);
    dry.connect(dSend); dSend.connect(dHp); dHp.connect(dIn); dIn.connect(dL);
    dL.connect(dToneL); dToneL.connect(dPanL); dToneL.connect(dFbL); dFbL.connect(dR);
    dR.connect(dToneR); dToneR.connect(dPanR); dToneR.connect(dFbR); dFbR.connect(dL);
    dPanL.connect(fader); dPanR.connect(fader);
    dry.connect(rSend); rSend.connect(rPre); rPre.connect(conv); conv.connect(rOut); rOut.connect(fader);
    fader.connect(pan); pan.connect(master);
    beatIn.connect(beatDelay); beatDelay.connect(beatGain); beatGain.connect(master);
    master.connect(limiter); limiter.connect(limTrim); limTrim.connect(preClip); preClip.connect(clip); clip.connect(postClip); postClip.connect(out);

    let irKey = '';
    const offline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
    const set = (param, v, tc) => {
      if (offline) param.value = v;
      else param.setTargetAtTime(v, ctx.currentTime, tc || 0.02);
    };
    const eqNodes = [hpf, hpf2, eqLow, eqMud, eqPres, eqAir];

    function apply(m, env) {
      env = env || {};
      set(trim.gain, dbToLin(m.input.gain + (env.autoGain || 0)));
      set(hpf.frequency, m.hpf.on ? m.hpf.freq : 10); set(hpf2.frequency, m.hpf.on ? m.hpf.freq : 10);
      for (const n of [lo1, lo2, hi1, hi2]) set(n.frequency, m.deess.freq);
      const dThr = m.deess.on ? m.deess.thresh : 0, dRat = m.deess.on ? m.deess.ratio : 1;
      deComp.threshold.value = dThr; deComp.ratio.value = dRat; deComp.knee.value = 0;
      deComp.attack.value = 0.001; deComp.release.value = 0.06;
      set(deComp2.gain, 1 / compAutoMakeup(dThr, 0, dRat));
      const e = m.eq, on = e.on ? 1 : 0;
      set(eqLow.frequency, e.lowF); set(eqLow.gain, e.lowG * on);
      set(eqMud.frequency, e.mudF); set(eqMud.gain, e.mudG * on);
      set(eqPres.frequency, e.presF); set(eqPres.gain, e.presG * on);
      set(eqAir.frequency, e.airF); set(eqAir.gain, e.airG * on);
      const c = m.comp, knee = c.on ? 8 : 0, cThr = c.on ? c.thresh : 0, cRat = c.on ? c.ratio : 1;
      comp.threshold.value = cThr; comp.ratio.value = cRat; comp.knee.value = knee;
      comp.attack.value = c.attack / 1000; comp.release.value = c.release / 1000;
      set(compTrim.gain, dbToLin(c.on ? c.makeup : 0) / compAutoMakeup(cThr, knee, cRat));
      const sk = (m.sat.on ? 'y' : 'n') + m.sat.drive.toFixed(3);
      if (sat._k !== sk) { sat._k = sk; sat.curve = satCurve(m.sat.drive, m.sat.on); }
      const d = m.delay;
      let dt = d.time / 1000;
      if (d.sync !== 'off' && env.bpm) dt = 60 / env.bpm * SYNC[d.sync];
      dt = Math.min(2.4, Math.max(0.02, dt));
      set(dL.delayTime, dt, 0.05); set(dR.delayTime, dt, 0.05);
      set(dFbL.gain, d.fb); set(dFbR.gain, d.fb);
      set(dToneL.frequency, d.tone); set(dToneR.frequency, d.tone);
      set(dPanL.pan, d.wide ? -0.75 : 0); set(dPanR.pan, d.wide ? 0.75 : 0);
      set(dSend.gain, d.on ? dbToLin(d.level) : 0);
      const r = m.reverb, key = r.type + '|' + r.decay.toFixed(2) + '|' + Math.round(r.tone);
      if (key !== irKey) { irKey = key; conv.buffer = makeIR(ctx, r.type, r.decay, r.tone); }
      set(rPre.delayTime, r.pre / 1000); set(rSend.gain, r.on ? dbToLin(r.level) : 0);
      set(fader.gain, dbToLin(m.vocal.level)); set(pan.pan, m.vocal.pan);
      set(beatGain.gain, dbToLin(m.beat.level));
      set(master.gain, dbToLin(m.master.level));
      const lOn = m.master.limit;
      limiter.threshold.value = lOn ? -3 : 0; limiter.ratio.value = lOn ? 20 : 1; limiter.knee.value = 0;
      limiter.attack.value = 0.002; limiter.release.value = 0.09;
      set(limTrim.gain, 1 / compAutoMakeup(lOn ? -3 : 0, 0, lOn ? 20 : 1));
    }

    // magnitude response (dB) of the EQ section, for drawing
    function eqResponse(freqs) {
      const mag = new Float32Array(freqs.length), ph = new Float32Array(freqs.length), tot = new Float32Array(freqs.length);
      for (const n of eqNodes) { n.getFrequencyResponse(freqs, mag, ph); for (let i = 0; i < tot.length; i++) tot[i] += 20 * Math.log10(Math.max(mag[i], 1e-6)); }
      return tot;
    }
    return { vocalIn, beatIn, out, gate, comp, deComp, limiter, apply, eqResponse };
  }

  /* Measure the look-ahead of the browser's compressor and of the whole vocal chain by pushing an
     impulse through them offline, so the low band, the beat and exports can be lined up to the sample. */
  async function measure(sr) {
    const peakAt = async (build) => {
      const off = new OfflineAudioContext(2, 4096, sr), buf = off.createBuffer(1, 8, sr);
      buf.getChannelData(0)[0] = 1;
      const src = off.createBufferSource(); src.buffer = buf; build(off, src); src.start();
      const r = await off.startRendering(), d = r.getChannelData(0);
      let pk = 0, at = 0; for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > pk) { pk = Math.abs(d[i]); at = i; }
      return at / sr;
    };
    let comp = 0.006, chain = 0.012, total = 0.018;
    try {
      comp = await peakAt((off, src) => { const c = off.createDynamicsCompressor(); c.threshold.value = 0; c.ratio.value = 1; c.knee.value = 0; src.connect(c); c.connect(off.destination); });
      const neutral = defaults();
      for (const k of ['gate', 'rider', 'hpf', 'deess', 'eq', 'comp', 'sat', 'delay', 'reverb']) neutral[k].on = false;
      neutral.master.limit = false; neutral.beat.level = 0;
      // the beat path is given zero compensation here, so its peak shows the limiter alone
      const lim = await peakAt((off, src) => { const ch = create(off, { comp, chain: 0 }); ch.apply(neutral); src.connect(ch.beatIn); ch.out.connect(off.destination); });
      const voc = await peakAt((off, src) => { const ch = create(off, { comp, chain: 0 }); ch.apply(neutral); src.connect(ch.vocalIn); ch.out.connect(off.destination); });
      chain = Math.max(0, voc - lim); total = voc;
    } catch (e) { console.warn('latency probe failed, using defaults', e); }
    return { comp, chain, total };
  }

  // EQ + low-cut magnitude (dB) for a settings object, without touching the live graph
  let eqCtx = null, eqN = null;
  function eqCurve(m, freqs) {
    if (!eqCtx) {
      eqCtx = new OfflineAudioContext(1, 1, 44100);
      eqN = ['highpass', 'highpass', 'lowshelf', 'peaking', 'peaking', 'highshelf'].map(t => { const b = eqCtx.createBiquadFilter(); b.type = t; return b; });
      eqN[0].Q.value = eqN[1].Q.value = -3.0103; eqN[3].Q.value = 1.1; eqN[4].Q.value = 0.9;
    }
    const e = m.eq, on = e.on ? 1 : 0, hp = m.hpf.on ? m.hpf.freq : 10;
    const vals = [[hp, 0], [hp, 0], [e.lowF, e.lowG * on], [e.mudF, e.mudG * on], [e.presF, e.presG * on], [e.airF, e.airG * on]];
    const mag = new Float32Array(freqs.length), ph = new Float32Array(freqs.length), tot = new Float32Array(freqs.length);
    eqN.forEach((n, i) => {
      n.frequency.value = vals[i][0]; n.gain.value = vals[i][1];
      n.getFrequencyResponse(freqs, mag, ph);
      for (let k = 0; k < tot.length; k++) tot[k] += 20 * Math.log10(Math.max(mag[k], 1e-6));
    });
    return tot;
  }

  window.MachineMix = { defaults, create, measure, compAutoMakeup, eqCurve, SYNC };
})();
