#!/usr/bin/env python3
"""Deep case study of a reference track: structure (via music/analyze.py) + note-level content (basic-pitch transcription)
+ sound-design measurements. numpy/scipy only.
usage: casestudy.py <audio> <outdir>   →  <outdir>/<name>.case.json"""
import sys, os, json, subprocess, collections, math
import numpy as np
from scipy import signal
sys.path.insert(0, '/home/claude/Maut ki machine/music'); sys.path.insert(0, '/home/claude/analysis')
import analyze as AZ
import transcribe as TR

NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
TEMPL = {}   # chord templates: (root, quality) -> pc vector
for r in range(12):
    for q, iv in {'m': [0, 3, 7], 'M': [0, 4, 7], '5': [0, 7], 'sus2': [0, 2, 7], 'sus4': [0, 5, 7], 'm7': [0, 3, 7, 10], 'M7': [0, 4, 7, 11], '7': [0, 4, 7, 10], 'madd9': [0, 3, 7, 2], 'add9': [0, 4, 7, 2]}.items():
        v = np.zeros(12); v[[(r + i) % 12 for i in iv]] = 1; v[r] += .5; TEMPL[(r, q)] = v / np.linalg.norm(v)

def ff(path, sr, ch):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', str(ch), '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    y = np.frombuffer(raw, dtype=np.float32).copy(); return y.reshape(-1, ch) if ch > 1 else y

def wav16(path, y, sr):
    from scipy.io import wavfile
    wavfile.write(path, sr, (np.clip(y, -1, 1) * 32767).astype(np.int16))

def bar_grid(beat_times, meter, phase):
    b = beat_times[phase::meter]; return b

def notes_in(notes, t0, t1, lo=0, hi=128): return [n for n in notes if t0 <= n['t'] < t1 and lo <= n['m'] < hi]

def chord_of(notes, t0, t1):
    v = np.zeros(12)
    for n in notes:
        ov = max(0, min(n['end'], t1) - max(n['t'], t0))
        if ov > 0: v[n['m'] % 12] += ov * n['a'] * (1.6 if n['m'] < 52 else 1)   # low notes weigh more (root evidence)
    if v.sum() < 1e-6: return None, 0
    v = v / np.linalg.norm(v); best, bs = None, -1
    for k, t in TEMPL.items():
        s = float(v @ t) - (.08 if k[1] == '5' else .04 if len(k[1]) > 2 else 0)
        if s > bs: bs, best = s, k
    return best, bs

KMAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]); KMIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
def key_from_notes(notes):
    v = np.zeros(12)
    for n in notes: v[n['m'] % 12] += (n['end'] - n['t']) * n['a']
    best = None
    for r in range(12):
        for mode, prof in (('major', KMAJ), ('minor', KMIN)):
            c = np.corrcoef(v, np.roll(prof, r))[0, 1]
            if best is None or c > best[0]: best = (c, r, mode)
    return {'tonic': best[1], 'mode': best[2], 'key': NOTE[best[1]] + ' ' + best[2], 'confidence': round(float(best[0]), 3)}

def roman(root, tonic, q):
    names = ['I', 'bII', 'II', 'bIII', 'III', 'IV', 'bV', 'V', 'bVI', 'VI', 'bVII', 'VII']
    r = names[(root - tonic) % 12]; return (r.lower() if q.startswith('m') else r) + ({'m': '', 'M': ''}.get(q, q.replace('m', '', 1) if q.startswith('m') else q))

def ngrams(seq, n):
    c = collections.Counter(tuple(seq[i:i + n]) for i in range(len(seq) - n + 1)); return c

def kick_profile(y, sr, kick_times):
    """average the low band around the strongest kicks → pitch sweep (start/end Hz), decay to -20 dB, click energy"""
    if len(kick_times) < 8: return None
    sos = signal.butter(4, 900, 'low', fs=sr, output='sos'); lo = signal.sosfiltfilt(sos, y)
    W = int(.35 * sr); segs = []
    for t in kick_times:
        i = int(t * sr) - int(.01 * sr)
        if 0 <= i and i + W < len(lo):
            s = lo[i:i + W]; pk = np.argmax(np.abs(s[:int(.05 * sr)])); s = lo[i + pk - int(.002 * sr): i + pk - int(.002 * sr) + W]
            if len(s) == W: segs.append(s)
    if len(segs) < 8: return None
    segs = np.array(segs); en = (segs ** 2).sum(axis=1); segs = segs[np.argsort(en)[-min(64, len(segs)):]]
    # sign-align and average
    ref = segs[-1]; al = [s if np.dot(s, ref) >= 0 else -s for s in segs]; k = np.mean(al, axis=0)
    env = np.abs(signal.hilbert(k)); env /= env.max() + 1e-12; edb = 20 * np.log10(env + 1e-9)
    pk = int(np.argmax(env)); d20 = next((i for i in range(pk, len(edb)) if edb[i] < -20), len(edb)) - pk
    # instantaneous frequency from zero crossings of the averaged kick
    zc = np.where((k[:-1] < 0) & (k[1:] >= 0))[0]; fr = []
    for a, b in zip(zc[:-1], zc[1:]):
        if a > pk - int(.002 * sr): fr.append((a / sr, sr / (b - a)))
    f_start = float(fr[0][1]) if len(fr) >= 1 else None
    f_end = np.median([f for t, f in fr if t > (pk / sr + .06)][:6]) if len([1 for t, f in fr if t > (pk / sr + .06)]) >= 2 else None
    # pitch time-constant: time for f to fall 63% of the way
    tau = None
    if f_start and f_end and f_start > f_end:
        tgt = f_end + (f_start - f_end) * .37
        for t, f in fr:
            if f <= tgt: tau = t - pk / sr; break
    return {'n': len(segs), 'decay_to_-20dB_ms': round(d20 / sr * 1000, 1), 'f_start_hz': round(float(f_start), 1) if f_start else None, 'f_end_hz': round(float(f_end), 1) if f_end else None, 'pitch_tau_ms': round(float(tau) * 1000, 1) if tau else None}

def third_octave_ltas(y, sr):
    f, P = signal.welch(y, fs=sr, nperseg=8192); cs = [25 * 2 ** (i / 3) for i in range(0, 28)]; out = []
    for c in cs:
        lo, hi = c / 2 ** (1 / 6), c * 2 ** (1 / 6)
        if hi > sr / 2: break
        m = (f >= lo) & (f < hi); out.append([round(c, 1), round(float(10 * np.log10(P[m].sum() + 1e-15)), 2)])
    ref = max(v for _, v in out); return [[c, round(v - ref, 2)] for c, v in out]

def main():
    src, outdir = sys.argv[1], sys.argv[2]; os.makedirs(outdir, exist_ok=True)
    name = os.path.splitext(os.path.basename(src))[0]; slug = ''.join(ch if ch.isalnum() else '_' for ch in name.lower())[:48].strip('_')
    tmp = os.path.join(outdir, 'tmp'); os.makedirs(tmp, exist_ok=True)
    y = ff(src, 22050, 1); st = ff(src, 22050, 2)
    wm, ws = os.path.join(tmp, slug + '.wav'), os.path.join(tmp, slug + '_st.wav'); wav16(wm, y, 22050); wav16(ws, st, 22050)
    base = AZ.analyze(wm, ws)
    # transcription
    import onnxruntime as ort
    so = ort.SessionOptions(); so.intra_op_num_threads = 2
    sess = ort.InferenceSession(TR.MODEL, so, providers=['CPUExecutionProvider'])
    out = TR.infer(y, sess); t = TR.frames_to_time(out['note'].shape[0])
    ev = TR.notes_poly(out['note'], out['onset'], .5, .3, int(round(.08 * 22050 / 256)), 30, 4200)
    notes = sorted([{'t': float(t[s]), 'end': float(t[min(e, len(t) - 1)]), 'm': int(m), 'a': float(a)} for s, e, m, a in ev], key=lambda n: (n['t'], n['m']))
    bpm = base['tempo']['bpm']; beat = 60 / bpm; meter = base['meter']['beats_per_bar']
    # rebuild beat grid from bpm + first downbeat estimate (analyze returns sparse beat times)
    bt = np.array(base['curves']['beat_times_s']); t0 = bt[0] if len(bt) else 0
    phase = base['meter']['downbeat_phase']; first_bar = t0 + phase * beat
    while first_bar - 4 * beat > 0: first_bar -= 4 * beat
    bars = np.arange(first_bar, len(y) / 22050, meter * beat)
    kn = key_from_notes(notes); tonic = kn['tonic']
    # per-bar chord + bass + activity
    per_bar = []
    for i, b0 in enumerate(bars[:-1]):
        b1 = bars[i + 1]; nb = notes_in(notes, b0 - .05, b1 - .05)
        ch, sc = chord_of([n for n in notes if n['t'] < b1 and n['end'] > b0], b0, b1)
        bass = [n['m'] for n in nb if n['m'] < 50]; mid = [n for n in nb if 50 <= n['m'] < 86]
        per_bar.append({'bar': i, 't': round(float(b0), 2), 'chord': (NOTE[ch[0]] + ch[1]) if ch else None, 'roman': roman(ch[0], tonic, ch[1]) if ch else None, 'fit': round(sc, 2),
                        'bass_pc': NOTE[collections.Counter(m % 12 for m in bass).most_common(1)[0][0]] if bass else None, 'n_notes': len(nb), 'n_mid': len(mid)})
    # harmonic rhythm: run-lengths of chord labels (merge low-fit bars into previous)
    runs = []; cur = None
    for pb in per_bar:
        lab = pb['roman'] if pb['fit'] > .55 else (cur[0] if cur else None)
        if cur and lab == cur[0]: cur[1] += 1
        else:
            if cur: runs.append(cur)
            cur = [lab, 1]
    if cur: runs.append(cur)
    runs = [r for r in runs if r[0]]
    chord_counts = collections.Counter(); [chord_counts.update({r[0]: r[1]}) for r in runs]
    trans = collections.Counter((a[0], b[0]) for a, b in zip(runs[:-1], runs[1:]))
    # rhythm of mid-register notes on a 16th grid (onset position within bar)
    grid = np.zeros(16); ioi = []
    mids = [n for n in notes if 50 <= n['m'] < 90]
    for n in mids:
        k = np.searchsorted(bars, n['t']) - 1
        if 0 <= k < len(bars) - 1:
            pos = (n['t'] - bars[k]) / (meter * beat) * 16; grid[int(round(pos)) % 16] += 1
    on = np.array(sorted(set(round(n['t'], 3) for n in mids)))
    if len(on) > 2: ioi = np.diff(on) / (beat / 4)
    ioi_hist = collections.Counter(int(round(x)) for x in ioi if 0.5 < x < 16.5)
    # register + intervals of the top voice (melodic contour)
    top = []
    for i in range(len(on)):
        cand = [n['m'] for n in mids if abs(n['t'] - on[i]) < .02]; top.append(max(cand) if cand else None)
    top = [m for m in top if m is not None]
    ints = collections.Counter(int(np.sign(b - a) * min(abs(b - a), 12)) for a, b in zip(top[:-1], top[1:]))
    # recurring motifs: pitch-class 4/5/6-grams of the mid-register onset sequence
    seq = [n['m'] for n in mids]
    motifs = {}
    for k in (4, 5, 6, 8):
        motifs[k] = [{'pcs': [NOTE[m % 12] + str(m // 12 - 1) for m in g], 'count': c} for g, c in ngrams(seq, k).most_common(5)]
    # kick sound
    kicks = [d for d in base['drums']['kick']] if False else None
    kick_env_t = []
    # find kick onsets from low band flux directly
    f, X = AZ.stft_mag(y); ke = AZ.norm(AZ.flux(np.log1p(X[AZ.band_idx(f, 30, 140)] * 50))); kon = AZ.pick_peaks(ke, delta=.8, wait=5) / AZ.FPS
    kp = kick_profile(y, 22050, kon)
    # brightness + energy trajectory per 8 bars
    traj = []
    hop = 512; cent = (f[:, None] * X ** 2).sum(axis=0) / ((X ** 2).sum(axis=0) + 1e-12); rms = np.sqrt((X ** 2).sum(axis=0))
    for i in range(0, len(bars) - 1, 8):
        a, b = int(bars[i] * 22050 / hop), int(bars[min(i + 8, len(bars) - 1)] * 22050 / hop)
        if b > a: traj.append({'bar': i, 'centroid_hz': round(float(np.median(cent[a:b])), 0), 'rms_db': round(float(20 * np.log10(np.mean(rms[a:b]) + 1e-9)), 1),
                               'notes_per_bar': round(sum(pb['n_notes'] for pb in per_bar[i:i + 8]) / max(1, len(per_bar[i:i + 8])), 1)})
    case = {'track': name, 'slug': slug, 'bpm': bpm, 'meter': meter, 'key': kn['key'], 'mode': kn['mode'], 'key_conf': kn['confidence'], 'key_chroma_estimate': base['harmony']['key'], 'tonic': tonic, 'duration_s': base['duration_s'],
            'notes': {'count': len(notes), 'per_beat': round(len(notes) / max(1, len(y) / 22050 / beat), 2),
                      'pitch_classes': {NOTE[k]: v for k, v in collections.Counter(n['m'] % 12 for n in notes).most_common()},
                      'octaves': dict(sorted(collections.Counter(n['m'] // 12 - 1 for n in notes).items())),
                      'mid_onset_grid16': [int(x) for x in grid], 'mid_ioi_16ths': dict(sorted(ioi_hist.items())),
                      'top_voice_intervals': dict(sorted(ints.items())), 'motifs': motifs,
                      'dur_ms_median': round(float(np.median([(n['end'] - n['t']) * 1000 for n in notes])), 0) if notes else None},
            'harmony': {'bars': len(per_bar), 'runs': runs[:80], 'chord_share': {k: round(v / max(1, sum(chord_counts.values())), 3) for k, v in chord_counts.most_common(10)},
                        'transitions': [[a, b, c] for (a, b), c in trans.most_common(10)], 'mean_run_bars': round(float(np.mean([r[1] for r in runs])), 2) if runs else None},
            'kick': kp, 'ltas_third_octave_db': third_octave_ltas(y, 22050), 'trajectory_8bar': traj,
            'base': {k: base[k] for k in ('tempo', 'meter', 'drums', 'structure', 'pump', 'spectrum', 'dynamics', 'stereo')}}
    case['base']['structure'].pop('novelty_beats', None)
    json.dump(case, open(os.path.join(outdir, slug + '.case.json'), 'w'), indent=1, default=float)
    json.dump({'notes': notes, 'bars': [float(b) for b in bars]}, open(os.path.join(outdir, slug + '.notes.json'), 'w'))
    print(f"{name}: {bpm:.1f} BPM {base['harmony']['key']}, {len(notes)} notes, mean chord run {case['harmony']['mean_run_bars']} bars, kick {kp}")

if __name__ == '__main__': main()
