#!/usr/bin/env python3
"""Measure rendered pieces with the same definitions as music/analyze.py and compare to the Max Cooper profile.
usage: metrics.py <profile.json> <outdir> [tag]  → prints a table and writes <outdir>/<tag>_metrics.json"""
import sys, os, json, glob
import numpy as np
from scipy import signal
from scipy.io import wavfile
SR = 22050; N_FFT = 2048; HOP = 220

def load(path):
    sr, y = wavfile.read(path); y = (y / 32768.0).astype(np.float32); assert sr == SR; return y

def stft_mag(y):
    f, t, Z = signal.stft(y, fs=SR, nperseg=N_FFT, noverlap=N_FFT - HOP, window='hann', boundary=None, padded=False)
    return f, np.abs(Z).astype(np.float32)

def band_idx(f, lo, hi): return np.where((f >= lo) & (f < hi))[0]

def spectral_stats(f, X):
    P = X ** 2 + 1e-12; tot = P.sum(axis=0); cent = (f[:, None] * P).sum(axis=0) / tot
    cum = np.cumsum(P, axis=0) / tot; roll = f[np.argmax(cum >= 0.85, axis=0)]
    flat = np.exp(np.log(P).mean(axis=0)) / P.mean(axis=0)
    m = P.mean(axis=1); ok = (f > 40) & (f < 10000); slope = np.polyfit(np.log10(f[ok]), 10 * np.log10(m[ok]), 1)[0]
    return {'centroid_hz': float(np.median(cent)), 'rolloff85_hz': float(np.median(roll)), 'flatness': float(np.median(flat)), 'tilt_db_per_decade': float(slope)}

def band_balance(f, X):
    P = X ** 2; tot = P.sum() + 1e-9
    bands = {'sub_20_60': (20, 60), 'bass_60_150': (60, 150), 'lowmid_150_400': (150, 400), 'mid_400_2k': (400, 2000), 'himid_2k_6k': (2000, 6000), 'high_6k_11k': (6000, 11025)}
    return {k: float(10 * np.log10(P[band_idx(f, lo, hi)].sum() / tot + 1e-12)) for k, (lo, hi) in bands.items()}

def stereo_width(y):
    L, R = y[:, 0], y[:, 1]; mid = (L + R) / 2; side = (L - R) / 2
    sos_lo = signal.butter(4, 200, 'low', fs=SR, output='sos'); sos_hi = signal.butter(4, 2000, 'high', fs=SR, output='sos')
    def ratio(a, b): return float(np.sqrt((a ** 2).mean()) / (np.sqrt((b ** 2).mean()) + 1e-9))
    return {'side_mid_full': ratio(side, mid), 'side_mid_low': ratio(signal.sosfilt(sos_lo, side), signal.sosfilt(sos_lo, mid)),
            'side_mid_high': ratio(signal.sosfilt(sos_hi, side), signal.sosfilt(sos_hi, mid)), 'correlation': float(np.corrcoef(L, R)[0, 1])}

def dynamics(y):
    frame = int(0.4 * SR); hop = int(0.1 * SR); n = (len(y) - frame) // hop
    rms = np.array([np.sqrt((y[i * hop:i * hop + frame] ** 2).mean()) for i in range(n)]); db = 20 * np.log10(rms + 1e-9)
    peak = 20 * np.log10(np.abs(y).max() + 1e-9); loud = db[db > db.max() - 40]
    rmsall = 20 * np.log10(np.sqrt((y ** 2).mean()) + 1e-9)
    # fraction of samples within 0.5 dB of the peak: a soft-clip / limiter-abuse fingerprint
    thr = np.abs(y).max() * 0.944
    return {'rms_dbfs': float(rmsall), 'crest_db': float(peak - rmsall), 'loudness_range_db': float(np.percentile(loud, 95) - np.percentile(loud, 10)),
            'near_peak_pct': float((np.abs(y) > thr).mean() * 100), 'peak_dbfs': float(peak)}

# interval roughness (semitone class → dissonance), weighted toward close voicings
DISS = {0: 0.0, 1: 1.0, 2: 0.35, 3: 0.05, 4: 0.05, 5: 0.05, 6: 0.5, 7: 0.0, 8: 0.15, 9: 0.05, 10: 0.2, 11: 0.7}
def dissonance(ev):
    notes = ev['notes']; BT = ev['BT']; ST = BT / 16
    if not notes: return {'roughness': 0, 'clash_pct': 0, 'poly': 0}
    T = max(n['t'] + n['d'] for n in notes); steps = int(T / ST) + 1
    rough = []; poly = []
    starts = sorted(notes, key=lambda n: n['t'])
    for s in range(steps):
        t = s * ST + ST * .5
        act = [n for n in starts if n['t'] <= t < n['t'] + max(n['d'], ST * .9)]
        if len(act) < 2: poly.append(len(act)); continue
        poly.append(len(act)); r = 0; c = 0
        for i in range(len(act)):
            for j in range(i + 1, len(act)):
                a, b = act[i]['m'], act[j]['m']; iv = abs(a - b); cls = iv % 12
                w = 1.0 if iv < 12 else 0.4 if iv < 24 else 0.15
                r += DISS[cls] * w; c += 1
        rough.append(r / c)
    return {'roughness': float(np.mean(rough)) if rough else 0.0, 'poly': float(np.mean(poly)), 'rough_p90': float(np.percentile(rough, 90)) if rough else 0.0}

def main():
    prof = json.load(open(sys.argv[1])); out = sys.argv[2]; tag = sys.argv[3] if len(sys.argv) > 3 else ''
    rows = []
    for f in sorted(glob.glob(os.path.join(out, f'{tag}*_mono.wav'))):
        base = f[:-9]; y = load(f); st = load(base + '_st.wav'); fq, X = stft_mag(y)
        r = {'name': os.path.basename(base)}; r.update(spectral_stats(fq, X)); r['balance'] = band_balance(fq, X); r.update(dynamics(y)); r['stereo'] = stereo_width(st)
        try: r.update(dissonance(json.load(open(base + '_events.json'))))
        except Exception as e: r['roughness'] = -1
        rows.append(r)
    if not rows: print('no files'); return
    def med(k, sub=None): v = [r[sub][k] if sub else r[k] for r in rows]; return float(np.median(v))
    P = prof
    print(f"{'metric':22s} {'cooper':>9s} {'ours(med)':>10s}   per-piece")
    def line(k, target, vals, fmt='{:8.2f}'): print(f"{k:22s} {fmt.format(target):>9s} {fmt.format(float(np.median(vals))):>10s}   " + ' '.join(fmt.format(v).strip() for v in vals))
    line('centroid_hz', P['spectrum']['centroid_hz'], [r['centroid_hz'] for r in rows], '{:8.0f}')
    line('rolloff85_hz', P['spectrum']['rolloff85_hz'], [r['rolloff85_hz'] for r in rows], '{:8.0f}')
    line('tilt_db/dec', P['spectrum']['tilt_db_per_decade'], [r['tilt_db_per_decade'] for r in rows])
    for k in P['balance_db']: line('bal ' + k, P['balance_db'][k], [r['balance'][k] for r in rows])
    line('rms_dbfs', P['dynamics']['rms_dbfs'], [r['rms_dbfs'] for r in rows])
    line('crest_db', P['dynamics']['crest_db'], [r['crest_db'] for r in rows])
    line('loudness_range_db', P['dynamics']['loudness_range_db'], [r['loudness_range_db'] for r in rows])
    line('near_peak_pct', 0.0, [r['near_peak_pct'] for r in rows], '{:8.3f}')
    for k in P['stereo']: line('st ' + k, P['stereo'][k], [r['stereo'][k] for r in rows], '{:8.3f}')
    line('roughness', 0.0, [r['roughness'] for r in rows], '{:8.3f}')
    line('rough_p90', 0.0, [r.get('rough_p90', 0) for r in rows], '{:8.3f}')
    line('poly(voices)', 0.0, [r.get('poly', 0) for r in rows])
    json.dump(rows, open(os.path.join(out, f'{tag or "all"}_metrics.json'), 'w'), indent=1)

main()
