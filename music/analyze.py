#!/usr/bin/env python3
"""Maut ki machine — music reverse-engineering pipeline.

Pure numpy/scipy, no librosa, so every number here is explainable and the same
math can be ported into the browser engine. Run:

    python3 analyze.py <wav dir> <out dir>

For each <name>.wav (mono, 22050 Hz) with an optional <name>_st.wav (stereo),
writes <out>/<name>.json and a cross-track <out>/profile.json.
"""
import sys, json, glob, os, math
import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import median_filter, maximum_filter1d, uniform_filter1d

SR = 22050
N_FFT = 2048
HOP = 512
FPS = SR / HOP                      # ≈43.07 frames per second
PC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']


# ---------------------------------------------------------------- basics
def load(path):
    sr, y = wavfile.read(path)
    if y.dtype == np.int16: y = y / 32768.0
    elif y.dtype == np.int32: y = y / 2147483648.0
    elif y.dtype == np.uint8: y = (y - 128) / 128.0
    y = y.astype(np.float32)
    assert sr == SR, (path, sr)
    return y


def stft_mag(y):
    f, t, Z = signal.stft(y, fs=SR, nperseg=N_FFT, noverlap=N_FFT - HOP, window='hann', boundary=None, padded=False)
    return f, np.abs(Z).astype(np.float32)


def mel_bank(n_mels=64, fmin=30, fmax=10000):
    def hz2mel(h): return 2595 * np.log10(1 + h / 700)
    def mel2hz(m): return 700 * (10 ** (m / 2595) - 1)
    mels = np.linspace(hz2mel(fmin), hz2mel(fmax), n_mels + 2)
    hz = mel2hz(mels)
    bins = np.floor((N_FFT + 1) * hz / SR).astype(int)
    W = np.zeros((n_mels, N_FFT // 2 + 1), dtype=np.float32)
    for m in range(1, n_mels + 1):
        l, c, r = bins[m - 1], bins[m], bins[m + 1]
        if c == l: c += 1
        if r == c: r += 1
        W[m - 1, l:c] = (np.arange(l, c) - l) / (c - l)
        W[m - 1, c:r] = (r - np.arange(c, r)) / (r - c)
    return W, hz[1:-1]


def band_idx(f, lo, hi):
    return np.where((f >= lo) & (f < hi))[0]


def flux(X):
    """Half-wave rectified spectral flux on a (bands × frames) log-magnitude matrix."""
    d = np.diff(X, axis=1, prepend=X[:, :1])
    return np.maximum(d, 0).sum(axis=0)


def norm(x):
    x = x - np.median(x)
    s = x.std() + 1e-9
    return np.maximum(x / s, 0)


def pick_peaks(x, pre=3, post=3, delta=0.5, wait=4):
    """Local maxima above a moving threshold with a minimum spacing (in frames)."""
    out = []
    thr = uniform_filter1d(x, size=pre + post + 1) + delta
    last = -wait
    for i in range(1, len(x) - 1):
        if x[i] >= x[i - 1] and x[i] >= x[i + 1] and x[i] > thr[i] and i - last >= wait:
            out.append(i); last = i
    return np.array(out, dtype=int)


# ---------------------------------------------------------------- tempo and beats
def tempo_candidates(onset, fps):
    """Autocorrelation of the onset envelope, weighted by a log-normal prior around 120 BPM."""
    x = onset - onset.mean()
    n = len(x)
    ac = np.correlate(x, x, mode='full')[n - 1:]
    ac /= (ac[0] + 1e-9)
    lags = np.arange(len(ac))
    bpm = np.zeros_like(ac)
    bpm[1:] = 60 * fps / lags[1:]
    prior = np.exp(-0.5 * ((np.log2(np.maximum(bpm, 1) / 120)) / 1.0) ** 2)
    score = ac * prior
    lo, hi = int(60 * fps / 200), int(60 * fps / 60)
    score[:lo] = 0; score[hi:] = 0
    order = np.argsort(score)[::-1]
    cands = []
    for i in order[:40]:
        b = 60 * fps / i
        if all(abs(b - c) > 2 for c, _ in cands):
            cands.append((float(b), float(score[i])))
        if len(cands) >= 5: break
    return cands


def beat_track(onset, fps, bpm, tightness=400):
    """Ellis (2007) dynamic-programming beat tracker."""
    period = 60 * fps / bpm
    n = len(onset)
    score = np.zeros(n); back = -np.ones(n, dtype=int)
    rng = np.arange(-int(2 * period), -int(period / 2))
    txwt = -tightness * (np.log(-rng / period) ** 2)
    on = onset / (onset.max() + 1e-9)
    for i in range(n):
        lo = i + rng
        ok = lo >= 0
        if not ok.any():
            score[i] = on[i]; continue
        cand = txwt[ok] + score[lo[ok]]
        j = np.argmax(cand)
        score[i] = on[i] + cand[j]
        back[i] = lo[ok][j]
    # pick the best end point in the last period and trace back
    tail = np.arange(max(0, n - int(period)), n)
    i = tail[np.argmax(score[tail])]
    beats = []
    while i >= 0:
        beats.append(i); i = back[i]
    return np.array(beats[::-1])


def ioi_mode(on_frames, fps, lo=.15, hi=2.5):
    d = np.diff(on_frames) / fps
    d = d[(d > lo) & (d < hi)]
    if len(d) < 8: return None, 0.0
    h, e = np.histogram(d, bins=np.arange(lo, hi, .02))
    i = int(np.argmax(h))
    return float(e[i] + .01), float(h[i] / len(d))


def resolve_tempo(bpm_tracker, cands, kick_ioi, kick_share, hat_ioi, lo=85, hi=150):
    """Half/double/dotted ambiguity: the kick (or hat) spacing says what a beat or an 8th is; pick the candidate that agrees."""
    targets = []
    if kick_ioi: targets += [60 / kick_ioi, 30 / kick_ioi, 15 / kick_ioi, 120 / kick_ioi]
    if hat_ioi: targets += [30 / hat_ioi, 15 / hat_ioi, 60 / hat_ioi]
    targets = [t for t in targets if lo <= t <= hi]
    strength = {round(c, 1): s_ for c, s_ in cands}; strength[round(bpm_tracker, 1)] = max(strength.values()) if strength else 1
    pool = [bpm_tracker] + [c for c, _ in cands] + [bpm_tracker * 2, bpm_tracker / 2, bpm_tracker * 1.5, bpm_tracker / 1.5]
    best = None
    for t in targets:
        for c in pool:
            if lo <= c <= hi and abs(c - t) / t < .04:
                sc = strength.get(round(c, 1), .2) - abs(c - t) / t
                if best is None or sc > best[1]: best = (c, sc, t)
    if best: return float(best[0]), 'ioi'
    return float(bpm_tracker), 'tracker'


def refine_bpm(beats, fps):
    if len(beats) < 4: return None
    d = np.diff(beats) / fps
    d = d[(d > 0.2) & (d < 1.5)]
    return float(60 / np.median(d)) if len(d) else None


# ---------------------------------------------------------------- meter and downbeats
def meter_and_downbeats(kick_env_beats, onset_beats, cands=(3, 4, 5, 7)):
    """Beat-synchronous: how strongly does folding at m beats produce one accented beat? Prior favours 4; weak evidence → 4, flagged."""
    x = norm(kick_env_beats) + 0.35 * norm(onset_beats)
    prior = {3: .8, 4: 1.0, 5: .7, 6: .75, 7: .65}
    res = []
    for m in cands:
        if len(x) < 6 * m: continue
        n = (len(x) // m) * m
        fold = x[:n].reshape(-1, m)
        prof = fold.mean(axis=0)
        # contrast: how far the strongest slot sits above the others, in units of the across-bar noise
        noise = fold.std(axis=0).mean() / math.sqrt(fold.shape[0]) + 1e-9
        contrast = (prof.max() - np.delete(prof, prof.argmax()).mean()) / noise
        res.append((m, contrast * prior[m], int(prof.argmax()), prof.tolist(), float(contrast)))
    res.sort(key=lambda r: -r[1])
    m, sc, phase, prof, raw = res[0]
    four = next((r for r in res if r[0] == 4), res[0])
    # only leave 4/4 when the alternative is clearly stronger
    if m != 4 and (raw < 6 or sc < four[1] * 1.35):
        m, sc, phase, prof, raw = four
    return m, phase, float(raw), [round(v, 3) for v in prof], (raw >= 6)


# ---------------------------------------------------------------- drum patterns
def grid_pattern(onset_frames, beat_frames, meter, phase, sub=4):
    """Quantise onsets to a sub-division grid per bar; return mean hit probability per grid slot, plus timing offsets."""
    steps = meter * sub
    hits = np.zeros(steps); bars = 0
    offsets = []   # fractional position within an 8th for swing
    bf = beat_frames
    for b0 in range(phase, len(bf) - meter, meter):
        t0, t1 = bf[b0], bf[b0 + meter]
        if t1 <= t0: continue
        bars += 1
        on = onset_frames[(onset_frames >= t0) & (onset_frames < t1)]
        for o in on:
            pos = (o - t0) / (t1 - t0) * steps
            k = int(round(pos)) % steps
            hits[k] += 1
            # swing: where do offbeat 8ths fall between the two surrounding 8th positions?
            e = pos / sub * 2           # position in 8ths
            frac = e - math.floor(e)
            if 0.3 < frac < 0.85: offsets.append(frac)
    prob = hits / max(bars, 1)
    swing = float(np.median(offsets)) if len(offsets) > 10 else 0.5
    return prob.tolist(), bars, swing


def cycle_lengths(env_beats, maxlag=16):
    """Autocorrelation of a beat-synchronous envelope; report strong lags that are NOT plain multiples of 4 — the polyrhythm fingerprint."""
    x = norm(env_beats); x = x - x.mean()
    if len(x) < 2 * maxlag + 4: return []
    ac = np.array([np.corrcoef(x[:-l], x[l:])[0, 1] for l in range(1, maxlag + 1)])
    out = []
    for l in range(2, maxlag + 1):
        v = ac[l - 1]
        if v > 0.25 and v >= ac[max(0, l - 2)] and v >= ac[min(maxlag - 1, l)]:
            out.append({'beats': l, 'strength': round(float(v), 3), 'odd': l % 4 != 0})
    return sorted(out, key=lambda d: -d['strength'])[:5]


# ---------------------------------------------------------------- harmony
KS_MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KS_MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def chroma(f, X):
    """12-bin chroma: log-compressed magnitudes, 80–2500 Hz, per-bin whitened, so the sub-heavy low end does not dictate the key."""
    ok = (f > 80) & (f < 2500)
    midi = 69 + 12 * np.log2(f[ok] / 440)
    pc = np.round(midi).astype(int) % 12
    Xo = np.log1p(X[ok] * 80)
    Xo = Xo - median_filter(Xo, size=(1, 65)) * .5          # tame slow spectral trends
    Xo = np.maximum(Xo, 0)
    C = np.zeros((12, X.shape[1]), dtype=np.float32)
    for p in range(12):
        C[p] = Xo[pc == p].sum(axis=0)
    C /= (C.sum(axis=0, keepdims=True) + 1e-9)
    return C


def key_estimate(C):
    prof = C.mean(axis=1)
    best = None
    for tonic in range(12):
        for mode, tmpl in (('major', KS_MAJ), ('minor', KS_MIN)):
            r = np.corrcoef(prof, np.roll(tmpl, tonic))[0, 1]
            if best is None or r > best[2]: best = (tonic, mode, r)
    tonic, mode, r = best
    # how much the winning mode beats the other mode on the same tonic: the honest major/minor confidence
    other = KS_MIN if mode == 'major' else KS_MAJ
    margin = r - float(np.corrcoef(prof, np.roll(other, tonic))[0, 1])
    return {'key': PC[tonic] + (' minor' if mode == 'minor' else ' major'), 'tonic': tonic, 'mode': mode, 'confidence': round(float(r), 3), 'mode_margin': round(margin, 3),
            'pitch_class_weights': [round(float(v), 4) for v in prof]}


def chord_per_bar(C, beat_frames, meter, phase, tonic):
    """Triad template matching per bar, reported as scale degrees relative to the tonic."""
    maj = np.array([1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0], dtype=float)
    mnr = np.array([1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0], dtype=float)
    chords = []
    for b0 in range(phase, len(beat_frames) - meter, meter):
        seg = C[:, beat_frames[b0]:beat_frames[b0 + meter]]
        if seg.shape[1] == 0: continue
        v = seg.mean(axis=1)
        best = None
        for root in range(12):
            for name, t in (('', maj), ('m', mnr)):
                s = float(v @ np.roll(t, root)) / (np.linalg.norm(v) + 1e-9)
                if best is None or s > best[0]: best = (s, root, name)
        s, root, name = best
        deg = (root - tonic) % 12
        chords.append({'degree': deg, 'quality': name or 'M', 'score': round(s, 3)})
    # summarise: most common degrees and bigram transitions
    from collections import Counter
    degs = Counter((c['degree'], c['quality']) for c in chords)
    trans = Counter()
    for a, b in zip(chords, chords[1:]):
        if (a['degree'], a['quality']) != (b['degree'], b['quality']):
            trans[((a['degree'], a['quality']), (b['degree'], b['quality']))] += 1
    return {'bars': len(chords),
            'top_chords': [{'degree': d, 'quality': q, 'share': round(n / max(len(chords), 1), 3)} for (d, q), n in degs.most_common(6)],
            'top_transitions': [{'from': list(a), 'to': list(b), 'count': n} for (a, b), n in trans.most_common(6)],
            'distinct_chords': len(degs),
            'change_rate_per_bar': round(sum(1 for a, b in zip(chords, chords[1:]) if (a['degree'], a['quality']) != (b['degree'], b['quality'])) / max(len(chords) - 1, 1), 3)}


# ---------------------------------------------------------------- structure
def beat_sync(F, beat_frames):
    out = []
    for a, b in zip(beat_frames[:-1], beat_frames[1:]):
        out.append(F[:, a:max(b, a + 1)].mean(axis=1))
    return np.array(out).T


def novelty(Fb, kernel=16):
    """Checkerboard-kernel novelty on a self-similarity matrix of beat-synchronous features."""
    Fn = Fb / (np.linalg.norm(Fb, axis=0, keepdims=True) + 1e-9)
    S = Fn.T @ Fn
    n = S.shape[0]
    k = kernel
    g = np.outer(signal.windows.gaussian(2 * k, k / 2), signal.windows.gaussian(2 * k, k / 2))
    cb = g.copy(); cb[:k, k:] *= -1; cb[k:, :k] *= -1
    nov = np.zeros(n)
    Sp = np.pad(S, k, mode='edge')
    for i in range(n):
        nov[i] = (Sp[i:i + 2 * k, i:i + 2 * k] * cb).sum()
    return np.maximum(nov, 0) / (nov.max() + 1e-9)


def sections(nov, rms_beats, low_beats, dens_beats, meter, min_len_bars=4):
    bnd = pick_peaks(nov, pre=8, post=8, delta=max(0.04, float(nov.std()) * .7), wait=min_len_bars * meter)
    bnd = [0] + [int(b) for b in bnd] + [len(nov)]
    # snap to bar lines
    bnd = sorted(set(int(round(b / meter)) * meter for b in bnd))
    bnd = [b for b in bnd if b <= len(nov)]
    if bnd[-1] != len(nov): bnd.append(len(nov))
    secs = []
    gl = np.percentile(rms_beats, 90) + 1e-9
    for a, b in zip(bnd[:-1], bnd[1:]):
        if b - a < meter: continue
        e = float(rms_beats[a:b].mean() / gl)
        lo = float(low_beats[a:b].mean() / (np.percentile(low_beats, 90) + 1e-9))
        de = float(dens_beats[a:b].mean() / (np.percentile(dens_beats, 90) + 1e-9))
        secs.append({'start_beat': a, 'end_beat': b, 'bars': (b - a) // meter, 'energy': round(e, 3), 'low': round(lo, 3), 'density': round(de, 3)})
    # label by energy ordering
    for i, s in enumerate(secs):
        if i == 0 and s['energy'] < 0.6: s['label'] = 'intro'
        elif i == len(secs) - 1 and s['energy'] < 0.6: s['label'] = 'outro'
        elif s['energy'] >= 0.85 and s['low'] >= 0.7: s['label'] = 'peak'
        elif s['energy'] >= 0.6: s['label'] = 'groove'
        elif i > 0 and secs[i - 1]['energy'] > s['energy'] + 0.25: s['label'] = 'breakdown'
        elif i + 1 < len(secs) and secs[i + 1]['energy'] > s['energy'] + 0.25: s['label'] = 'build'
        else: s['label'] = 'low'
    return secs


def drops(low_beats, rms_beats, meter):
    """Moments where sustained low-band energy jumps the most (the 'drop'): compare 2 bars before vs 2 bars after."""
    w = 2 * meter
    x = uniform_filter1d(norm(low_beats) + 0.5 * norm(rms_beats), size=meter)
    out = []
    for i in range(w, len(x) - w):
        jump = x[i:i + w].mean() - x[i - w:i].mean()
        out.append(jump)
    out = np.array(out)
    if not len(out): return []
    peaks = pick_peaks(out, pre=w, post=w, delta=out.std() * .5, wait=8 * meter)
    peaks = sorted(peaks, key=lambda p: -out[p])[:5]
    return sorted([{'beat': int(p + w), 'jump': round(float(out[p]), 3)} for p in peaks], key=lambda d: d['beat'])


# ---------------------------------------------------------------- sidechain / pump
def pump(mid_env, kick_frames, fps, look=0.5):
    """Average mid-band envelope in the 500 ms after each kick, normalised to the level just before it: the pumping fingerprint."""
    n = int(look * fps)
    curves = []
    for k in kick_frames:
        if k - 3 < 0 or k + n >= len(mid_env): continue
        pre = mid_env[k - 3:k].mean() + 1e-9
        curves.append(mid_env[k:k + n] / pre)
    if len(curves) < 8: return None
    c = np.median(np.array(curves), axis=0)
    dip = float(c.min()); t_dip = float(np.argmin(c) / fps)
    rec = np.where(c[np.argmin(c):] > 0.9)[0]
    t_rec = float((np.argmin(c) + rec[0]) / fps) if len(rec) else look
    return {'depth': round(1 - dip, 3), 'dip_at_s': round(t_dip, 3), 'recover_s': round(t_rec, 3), 'curve': [round(float(v), 3) for v in c[::2]]}


# ---------------------------------------------------------------- timbre / texture
def hpss_ratio(X):
    H = median_filter(X, size=(1, 17))
    P = median_filter(X, size=(17, 1))
    mh = (H ** 2 / (H ** 2 + P ** 2 + 1e-9))
    h = (X * mh).sum(); p = (X * (1 - mh)).sum()
    return float(h / (h + p + 1e-9))


def spectral_stats(f, X):
    P = X ** 2 + 1e-12
    tot = P.sum(axis=0)
    cent = (f[:, None] * P).sum(axis=0) / tot
    cum = np.cumsum(P, axis=0) / tot
    roll = f[np.argmax(cum >= 0.85, axis=0)]
    flat = np.exp(np.log(P).mean(axis=0)) / P.mean(axis=0)
    bw = np.sqrt(((f[:, None] - cent) ** 2 * P).sum(axis=0) / tot)
    # tilt: slope of log-power vs log-frequency on the mean spectrum
    m = P.mean(axis=1); ok = (f > 40) & (f < 10000)
    slope = np.polyfit(np.log10(f[ok]), 10 * np.log10(m[ok]), 1)[0]
    return {'centroid_hz': round(float(np.median(cent)), 1), 'rolloff85_hz': round(float(np.median(roll)), 1),
            'flatness': round(float(np.median(flat)), 4), 'bandwidth_hz': round(float(np.median(bw)), 1),
            'tilt_db_per_decade': round(float(slope), 2)}


def band_balance(f, X):
    P = X ** 2
    tot = P.sum() + 1e-9
    bands = {'sub_20_60': (20, 60), 'bass_60_150': (60, 150), 'lowmid_150_400': (150, 400), 'mid_400_2k': (400, 2000),
             'himid_2k_6k': (2000, 6000), 'high_6k_11k': (6000, 11025)}
    out = {}
    for k, (lo, hi) in bands.items():
        idx = band_idx(f, lo, hi)
        out[k] = round(float(10 * np.log10(P[idx].sum() / tot + 1e-12)), 2)
    return out


def stereo_width(path):
    if not os.path.exists(path): return None
    y = load(path)
    if y.ndim == 1: return None
    L, R = y[:, 0], y[:, 1]
    mid = (L + R) / 2; side = (L - R) / 2
    sos_lo = signal.butter(4, 200, 'low', fs=SR, output='sos')
    sos_hi = signal.butter(4, 2000, 'high', fs=SR, output='sos')
    def ratio(a, b): return float(np.sqrt((a ** 2).mean()) / (np.sqrt((b ** 2).mean()) + 1e-9))
    return {'side_mid_full': round(ratio(side, mid), 3),
            'side_mid_low': round(ratio(signal.sosfilt(sos_lo, side), signal.sosfilt(sos_lo, mid)), 3),
            'side_mid_high': round(ratio(signal.sosfilt(sos_hi, side), signal.sosfilt(sos_hi, mid)), 3),
            'correlation': round(float(np.corrcoef(L, R)[0, 1]), 3)}


def dynamics(y):
    frame = int(0.4 * SR); hop = int(0.1 * SR)
    n = (len(y) - frame) // hop
    rms = np.array([np.sqrt((y[i * hop:i * hop + frame] ** 2).mean()) for i in range(n)])
    db = 20 * np.log10(rms + 1e-9)
    peak = 20 * np.log10(np.abs(y).max() + 1e-9)
    loud = db[db > db.max() - 40]
    return {'peak_dbfs': round(float(peak), 2), 'rms_dbfs': round(float(20 * np.log10(np.sqrt((y ** 2).mean()) + 1e-9)), 2),
            'crest_db': round(float(peak - 20 * np.log10(np.sqrt((y ** 2).mean()) + 1e-9)), 2),
            'loudness_range_db': round(float(np.percentile(loud, 95) - np.percentile(loud, 10)), 2),
            'rms_curve_db_1s': [round(float(v), 1) for v in db[::10]]}


# ---------------------------------------------------------------- melody / sequence rate
def melodic_activity(f, X, fps):
    """Onsets in the 300–3000 Hz band as a proxy for note events; rate per beat and burstiness tell arps from pads."""
    idx = band_idx(f, 300, 3000)
    env = norm(flux(np.log1p(X[idx] * 50)))
    on = pick_peaks(env, delta=0.35, wait=3)
    return env, on


# ================================================================ main per-track
def analyze(wav_path, st_path):
    name = os.path.basename(wav_path)[:-4]
    y = load(wav_path)
    dur = len(y) / SR
    f, X = stft_mag(y)
    W, mel_hz = mel_bank()
    M = np.log1p(W @ X * 30)
    onset = norm(flux(M))
    # band envelopes for drum roles
    kick_env = norm(flux(np.log1p(X[band_idx(f, 30, 140)] * 50)))
    snare_env = norm(flux(np.log1p(X[band_idx(f, 150, 2500)] * 50)) + 0.6 * flux(np.log1p(X[band_idx(f, 2500, 6000)] * 50)))
    hat_env = norm(flux(np.log1p(X[band_idx(f, 6000, 11000)] * 50)))
    low_pow = (X[band_idx(f, 30, 150)] ** 2).sum(axis=0)
    mid_pow = np.sqrt((X[band_idx(f, 400, 2500)] ** 2).sum(axis=0))

    # tempo + beats
    cands = tempo_candidates(onset, FPS)
    bpm0 = cands[0][0]
    beats = beat_track(onset, FPS, bpm0)
    bpm = refine_bpm(beats, FPS) or bpm0
    # the kick/hat spacing settles half, double and dotted ambiguity
    kick_on0 = pick_peaks(kick_env, delta=.8, wait=5); hat_on0 = pick_peaks(hat_env, delta=.5, wait=2)
    kick_ioi, kick_share = ioi_mode(kick_on0, FPS); hat_ioi, hat_share = ioi_mode(hat_on0, FPS)
    bpm, tempo_src = resolve_tempo(bpm, cands, kick_ioi, kick_share, hat_ioi)
    beats = beat_track(onset, FPS, bpm)
    bpm = refine_bpm(beats, FPS) or bpm
    beat_times = beats / FPS
    regular = kick_share >= .15          # a dominant kick spacing = a steady pulse; below it the groove is irregular/polyrhythmic

    # beat-synchronous envelopes
    def bs(env): return np.array([env[a:max(b, a + 1)].mean() for a, b in zip(beats[:-1], beats[1:])])
    kick_b, on_b, rms_b, low_b = bs(kick_env), bs(onset), bs(np.sqrt((W @ X).sum(axis=0))), bs(low_pow)
    hat_b, snare_b = bs(hat_env), bs(snare_env)
    dens_b = bs((onset > 1.0).astype(float))

    meter, phase, meter_score, accent, meter_confident = meter_and_downbeats(kick_b, on_b)

    # drum grids
    kick_on = pick_peaks(kick_env, delta=0.6, wait=4)
    snare_on = pick_peaks(snare_env, delta=0.6, wait=4)
    hat_on = pick_peaks(hat_env, delta=0.45, wait=2)
    kick_grid, nbars, swing_k = grid_pattern(kick_on, beats, meter, phase)
    snare_grid, _, swing_s = grid_pattern(snare_on, beats, meter, phase)
    hat_grid, _, swing_h = grid_pattern(hat_on, beats, meter, phase)

    # harmony
    C = chroma(f, X)
    key = key_estimate(C)
    chords = chord_per_bar(C, beats, meter, phase, key['tonic'])
    Cb = beat_sync(C, beats)

    # structure
    Fb = np.vstack([beat_sync(M, beats) / 3.0, Cb * 2.0])
    nov = novelty(Fb, kernel=4 * meter)
    secs = sections(nov, rms_b, low_b, dens_b, meter)
    drp = drops(low_b, rms_b, meter)

    # melody / sequences
    mel_env, mel_on = melodic_activity(f, X, FPS)
    notes_per_beat = len(mel_on) / max(len(beats), 1)
    mel_b = bs(mel_env)

    # per-section drum density and note rate, so the generator can shape an arc
    for s in secs:
        a, b = s['start_beat'], s['end_beat']
        s['kick_per_beat'] = round(float(((kick_on >= beats[a]) & (kick_on < beats[min(b, len(beats) - 1)])).sum() / max(b - a, 1)), 3)
        s['hat_per_beat'] = round(float(((hat_on >= beats[a]) & (hat_on < beats[min(b, len(beats) - 1)])).sum() / max(b - a, 1)), 3)
        s['notes_per_beat'] = round(float(((mel_on >= beats[a]) & (mel_on < beats[min(b, len(beats) - 1)])).sum() / max(b - a, 1)), 3)
        s['start_s'] = round(float(beat_times[a]), 2); s['end_s'] = round(float(beat_times[min(b, len(beat_times) - 1)]), 2)

    out = {
        'track': name, 'duration_s': round(dur, 2),
        'tempo': {'bpm': round(bpm, 2), 'resolved_by': tempo_src, 'candidates': [[round(b, 1), round(s, 3)] for b, s in cands], 'beats': len(beats),
                  'beat_stability': round(float(1 - np.std(np.diff(beat_times)) / (np.mean(np.diff(beat_times)) + 1e-9)), 4),
                  'kick_ioi_s': round(kick_ioi, 3) if kick_ioi else None, 'kick_ioi_share': round(kick_share, 3),
                  'hat_ioi_s': round(hat_ioi, 3) if hat_ioi else None, 'pulse': 'steady' if regular else 'irregular',
                  'kick_pulse': ('8ths' if kick_ioi and abs(kick_ioi - 30 / bpm) / (30 / bpm) < .12 else 'beats' if kick_ioi and abs(kick_ioi - 60 / bpm) / (60 / bpm) < .12 else 'other')},
        'meter': {'beats_per_bar': meter, 'downbeat_phase': phase, 'accent_contrast': round(meter_score, 2), 'confident': bool(meter_confident), 'accent_profile': accent},
        'drums': {'grid_steps': meter * 4,
                  'kick': kick_grid, 'snare': snare_grid, 'hat': hat_grid,
                  'swing': {'kick': round(swing_k, 3), 'snare': round(swing_s, 3), 'hat': round(swing_h, 3)},
                  'rates_per_beat': {'kick': round(len(kick_on) / max(len(beats), 1), 3), 'snare': round(len(snare_on) / max(len(beats), 1), 3), 'hat': round(len(hat_on) / max(len(beats), 1), 3)},
                  'cycles': {'kick': cycle_lengths(kick_b), 'snare': cycle_lengths(snare_b), 'hat': cycle_lengths(hat_b), 'melody': cycle_lengths(mel_b)}},
        'harmony': {**key, 'chords': chords, 'chroma_entropy': round(float(-(np.mean(Cb, axis=1) * np.log2(np.mean(Cb, axis=1) + 1e-9)).sum()), 3)},
        'melody': {'notes_per_beat': round(notes_per_beat, 3), 'density_curve_beats': [round(float(v), 3) for v in uniform_filter1d(mel_b, 8)[::4]]},
        'structure': {'sections': secs, 'drops': [{**d, 'time_s': round(float(beat_times[min(d['beat'], len(beat_times) - 1)]), 2)} for d in drp],
                      'novelty_beats': [round(float(v), 3) for v in nov[::2]]},
        'pump': pump(mid_pow, kick_on, FPS),
        'spectrum': {**spectral_stats(f, X), 'balance_db': band_balance(f, X), 'harmonic_ratio': round(hpss_ratio(X[:, ::4]), 3)},
        'dynamics': dynamics(y),
        'stereo': stereo_width(st_path),
        'curves': {'rms_beats': [round(float(v), 3) for v in (rms_b / (rms_b.max() + 1e-9))[::2]],
                   'low_beats': [round(float(v), 3) for v in (low_b / (low_b.max() + 1e-9))[::2]],
                   'hat_beats': [round(float(v), 3) for v in (hat_b / (hat_b.max() + 1e-9))[::2]],
                   'beat_times_s': [round(float(t), 3) for t in beat_times[::8]]},
    }
    return out


def profile(tracks):
    """Cross-track medians and ranges: what the generator is parameterised from."""
    def med(vals): vals = [v for v in vals if v is not None]; return round(float(np.median(vals)), 3) if vals else None
    def rng(vals): vals = [v for v in vals if v is not None]; return [round(float(min(vals)), 3), round(float(max(vals)), 3)] if vals else None
    bpms = [t['tempo']['bpm'] for t in tracks]
    meters = [t['meter']['beats_per_bar'] for t in tracks]
    from collections import Counter
    keys = Counter(t['harmony']['key'] for t in tracks)
    modes = Counter(t['harmony']['mode'] for t in tracks)
    g = lambda role: np.mean([t['drums'][role] for t in tracks if t['meter']['beats_per_bar'] == 4], axis=0).round(3).tolist() if any(t['meter']['beats_per_bar'] == 4 for t in tracks) else None
    sec_lens = [s['bars'] for t in tracks for s in t['structure']['sections']]
    odd = [c for t in tracks for role in ('kick', 'snare', 'hat', 'melody') for c in t['drums']['cycles'][role] if c['odd']]
    return {
        'n_tracks': len(tracks),
        'tempo_bpm': {'median': med(bpms), 'range': rng(bpms), 'all': [round(b, 1) for b in bpms]},
        'pulse': dict(Counter(t['tempo']['pulse'] for t in tracks)),
        'kick_pulse': dict(Counter(t['tempo']['kick_pulse'] for t in tracks)),
        'meter_confident': dict(Counter(t['meter']['confident'] for t in tracks)),
        'meter': dict(Counter(meters)),
        'keys': dict(keys), 'modes': dict(modes),
        'drum_grid_mean_4_4': {'kick': g('kick'), 'snare': g('snare'), 'hat': g('hat')},
        'swing_median': med([t['drums']['swing']['hat'] for t in tracks]),
        'rates_per_beat': {r: {'median': med([t['drums']['rates_per_beat'][r] for t in tracks]), 'range': rng([t['drums']['rates_per_beat'][r] for t in tracks])} for r in ('kick', 'snare', 'hat')},
        'odd_cycles_found': sorted(Counter(c['beats'] for c in odd).items()),
        'notes_per_beat': {'median': med([t['melody']['notes_per_beat'] for t in tracks]), 'range': rng([t['melody']['notes_per_beat'] for t in tracks])},
        'chord_change_rate_per_bar': med([t['harmony']['chords']['change_rate_per_bar'] for t in tracks]),
        'distinct_chords': med([t['harmony']['chords']['distinct_chords'] for t in tracks]),
        'section_bars': {'median': med(sec_lens), 'common': sorted(Counter(sec_lens).most_common(6))},
        'sections_per_track': med([len(t['structure']['sections']) for t in tracks]),
        'drops_per_track': med([len(t['structure']['drops']) for t in tracks]),
        'first_drop_fraction': med([t['structure']['drops'][0]['time_s'] / t['duration_s'] for t in tracks if t['structure']['drops']]),
        'pump': {'depth': med([t['pump']['depth'] for t in tracks if t['pump']]), 'recover_s': med([t['pump']['recover_s'] for t in tracks if t['pump']])},
        'spectrum': {k: med([t['spectrum'][k] for t in tracks]) for k in ('centroid_hz', 'rolloff85_hz', 'flatness', 'tilt_db_per_decade', 'harmonic_ratio')},
        'balance_db': {k: med([t['spectrum']['balance_db'][k] for t in tracks]) for k in tracks[0]['spectrum']['balance_db']},
        'dynamics': {k: med([t['dynamics'][k] for t in tracks]) for k in ('rms_dbfs', 'crest_db', 'loudness_range_db')},
        'stereo': {k: med([t['stereo'][k] for t in tracks if t['stereo']]) for k in ('side_mid_full', 'side_mid_low', 'side_mid_high', 'correlation')},
        'duration_s': {'median': med([t['duration_s'] for t in tracks]), 'range': rng([t['duration_s'] for t in tracks])},
    }


if __name__ == '__main__':
    wav_dir, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    results = []
    for p in sorted(glob.glob(os.path.join(wav_dir, '*.wav'))):
        if p.endswith('_st.wav'): continue
        name = os.path.basename(p)[:-4]
        print('analyzing', name, flush=True)
        r = analyze(p, p[:-4] + '_st.wav')
        with open(os.path.join(out_dir, name + '.json'), 'w') as fh: json.dump(r, fh, indent=1)
        results.append(r)
        print('  bpm %.1f  meter %d/4  key %s  sections %d  drops %d' % (r['tempo']['bpm'], r['meter']['beats_per_bar'], r['harmony']['key'], len(r['structure']['sections']), len(r['structure']['drops'])), flush=True)
    with open(os.path.join(out_dir, 'profile.json'), 'w') as fh: json.dump(profile(results), fh, indent=1)
    print('profile written')
