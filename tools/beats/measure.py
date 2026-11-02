#!/usr/bin/env python3
"""Band balance, loudness and a spectrogram for BARS renders. usage: measure.py [--png] file.wav ..."""
import sys, re, subprocess, wave, os
import numpy as np
from scipy import signal
B = [('sub 30-60', 30, 60), ('low 60-120', 60, 120), ('lowmid 120-300', 120, 300), ('mud 300-600', 300, 600), ('mid 600-1.5k', 600, 1500), ('voice 1.5-4k', 1500, 4000), ('air 4-16k', 4000, 16000)]
def read(p):
    w = wave.open(p); n = w.getnframes(); sr = w.getframerate(); x = np.frombuffer(w.readframes(n), dtype=np.int16).reshape(-1, 2) / 32768
    return x, sr
def lufs(p):
    r = subprocess.run(['ffmpeg', '-nostats', '-hide_banner', '-i', p, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = re.findall(r'I:\s+(-?[\d.]+) LUFS', r); TP = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r); return float(I[-1]) if I else None, float(TP[-1]) if TP else None
def main():
    args = sys.argv[1:]; png = '--png' in args; args = [a for a in args if a != '--png']
    for p in args:
        x, sr = read(p); m = x.mean(1); f, Pxx = signal.welch(m, sr, nperseg=8192)
        lv = [10 * np.log10(np.sum(Pxx[(f >= a) & (f < b)]) * (f[1] - f[0]) + 1e-14) for _, a, b in B]; I, TP = lufs(p)
        peak = np.abs(x).max(); rms = np.sqrt((x ** 2).mean()); side = np.sqrt((((x[:, 0] - x[:, 1]) / 2) ** 2).mean()) / (np.sqrt((m ** 2).mean()) + 1e-9)
        print(os.path.basename(p).ljust(22), 'I %.1f TP %.1f crest %.1f width %.2f |' % (I or 0, TP or 0, 20 * np.log10(peak / (rms + 1e-9)), side), ' '.join('%s %.0f' % (n.split()[0], v) for (n, _, _), v in zip(B, lv)))
        if png:
            import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
            fq, t, S = signal.spectrogram(m, sr, nperseg=2048, noverlap=1536); fig, ax = plt.subplots(figsize=(14, 4)); ax.pcolormesh(t, fq, 10 * np.log10(S + 1e-12), vmin=-110, vmax=-40, shading='auto', cmap='magma'); ax.set_yscale('symlog', linthresh=200); ax.set_ylim(20, 16000); ax.set_title(os.path.basename(p)); fig.tight_layout(); fig.savefig(p + '.png', dpi=70); plt.close(fig)
main()
