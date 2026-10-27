#!/usr/bin/env python3
"""Click / discontinuity detector: flags samples where the 2nd difference of the high-passed signal jumps far above its local level."""
import sys, numpy as np, subprocess
from scipy import signal
for f in sys.argv[1:]:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '2', '-ar', '44100', '-f', 'f32le', '-'], capture_output=True).stdout
    y = np.frombuffer(raw, np.float32).reshape(-1, 2); sos = signal.butter(4, 6000, 'hp', fs=44100, output='sos'); out = []
    for ch in range(2):
        h = signal.sosfilt(sos, y[:, ch]); d = np.abs(np.diff(h, 2)); env = signal.medfilt(d[::32], 31).repeat(32)[:len(d)] + 1e-5
        idx = np.where(d > env * 40)[0]; out.append(idx)
    idx = np.unique(np.concatenate(out) // 4410)   # 0.1 s buckets
    print(f.split('/')[-1].ljust(16), 'click-buckets', len(idx), 'per min %.1f' % (len(idx) / (len(y) / 44100 / 60)), 'first:', [round(i * .1, 1) for i in idx[:8]])
