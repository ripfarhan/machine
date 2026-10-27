#!/usr/bin/env python3
"""Mix metrics for a render vs the Max Cooper reference curve.
usage: metrics.py ref_cases_dir file.wav [...]  → per file: integrated LUFS, true-ish peak, LTAS deviation per region, timeline"""
import sys, os, json, glob, subprocess, re
import numpy as np
sys.path.insert(0, '/home/claude/analysis')
from casestudy import third_octave_ltas, ff
def lufs(path):
    r = subprocess.run(['ffmpeg', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = re.findall(r'I:\s+(-?[\d.]+) LUFS', r); TP = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r); LRA = re.findall(r'LRA:\s+([\d.]+) LU', r)
    return float(I[-1]) if I else None, float(TP[-1]) if TP else None, float(LRA[-1]) if LRA else None
REG = {'sub 25-63': (25, 63), 'bass 80-160': (79, 160), 'mud 200-500': (199, 505), 'mid 630-1.6k': (630, 1601), 'harsh 2-5k': (2000, 5080), 'air 6-16k': (6000, 16100)}
def regions(lt):
    d = dict((round(f, 1), v) for f, v in lt); out = {}
    for k, (a, b) in REG.items():
        vs = [10 ** (v / 10) for f, v in lt if a <= f <= b]; out[k] = 10 * np.log10(np.mean(vs)) if vs else None
    return out
def main():
    refdir = sys.argv[1]; refs = []
    for p in glob.glob(os.path.join(refdir, '*.case.json')):
        c = json.load(open(p)); refs.append(regions(c['ltas_third_octave_db']))
    ref = {k: float(np.median([r[k] for r in refs])) for k in REG} if refs else None
    if ref: print('REF (median of %d)' % len(refs), ' '.join('%s %.1f' % (k.split()[0], v) for k, v in ref.items()))
    for f in sys.argv[2:]:
        y = ff(f, 22050, 1); lt = third_octave_ltas(y, 22050); rg = regions(lt); I, TP, LRA = lufs(f)
        dev = ' '.join('%s %+.1f' % (k.split()[0], rg[k] - ref[k]) for k in REG) if ref else ''
        # timeline: rms per 10 s
        w = 22050 * 10; tl = [round(20 * np.log10(np.sqrt(np.mean(y[i:i + w] ** 2)) + 1e-9)) for i in range(0, len(y) - w, w)]
        print(os.path.basename(f).ljust(18), 'I %.1f TP %.1f LRA %.1f |' % (I, TP, LRA), dev, '| rms10s', tl)
main()
