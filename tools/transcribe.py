#!/usr/bin/env python3
"""Polyphonic note transcription with Spotify's basic-pitch ICASSP-2022 model (ONNX), no librosa/tensorflow.
Port of basic_pitch/inference.py + note_creation.py (Apache-2.0) using ffmpeg for decoding and numpy/scipy only.
usage: transcribe.py <audio> <out.json> [--onset 0.5] [--frame 0.3] [--minlen-ms 80] [--fmin 30] [--fmax 4200]"""
import sys, json, subprocess, argparse
import numpy as np, scipy.signal, onnxruntime as ort

SR = 22050; FFT_HOP = 256; WIN = 2; FPS = SR // FFT_HOP; ANNOT_N_FRAMES = FPS * WIN; N_SAMPLES = SR * WIN - FFT_HOP
MIDI_OFFSET = 21; MAX_FREQ_IDX = 87; MAGIC = 0.0018; OVERLAP_FRAMES = 30
MODEL = '/home/claude/basic-pitch/basic_pitch/saved_models/icassp_2022/nmp.onnx'

def load(path, sr=SR):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

def infer(audio, sess):
    overlap_len = OVERLAP_FRAMES * FFT_HOP; hop = N_SAMPLES - overlap_len; orig = len(audio)
    a = np.concatenate([np.zeros(overlap_len // 2, np.float32), audio])
    outs = {'note': [], 'onset': [], 'contour': []}; batch = []
    def flush():
        if not batch: return
        x = np.stack(batch)[..., None].astype(np.float32)
        r = sess.run(['StatefulPartitionedCall:1', 'StatefulPartitionedCall:2', 'StatefulPartitionedCall:0'], {'serving_default_input_2:0': x})
        for k, v in zip(['note', 'onset', 'contour'], r): outs[k].append(v)
        batch.clear()
    for i in range(0, len(a), hop):
        w = a[i:i + N_SAMPLES]
        if len(w) < N_SAMPLES: w = np.pad(w, (0, N_SAMPLES - len(w)))
        batch.append(w)
        if len(batch) == 16: flush()
    flush()
    n_olap = OVERLAP_FRAMES // 2; res = {}
    for k in outs:
        o = np.concatenate(outs[k])[:, n_olap:-n_olap, :]; o = o.reshape(o.shape[0] * o.shape[1], o.shape[2])
        n_exp = orig / hop; per = WIN * FPS - OVERLAP_FRAMES; res[k] = o[:int(n_exp * per)]
    return res

def frames_to_time(n):
    t = np.arange(n) * FFT_HOP / SR; wn = np.floor(np.arange(n) / ANNOT_N_FRAMES)
    off = (FFT_HOP / SR) * (ANNOT_N_FRAMES - (N_SAMPLES / FFT_HOP)) + MAGIC
    return t - off * wn

def hz_to_idx(hz): return int(np.round(69 + 12 * np.log2(hz / 440.0) - MIDI_OFFSET))

def notes_poly(frames, onsets, onset_thresh, frame_thresh, min_len, fmin, fmax, energy_tol=11, melodia=True):
    frames = frames.copy(); onsets = onsets.copy(); n = frames.shape[0]
    lo = hz_to_idx(fmin) if fmin else 0; hi = hz_to_idx(fmax) if fmax else frames.shape[1]
    for m in (onsets, frames): m[:, :lo] = 0; m[:, hi:] = 0
    diffs = []
    for k in (1, 2):
        fa = np.concatenate([np.zeros((k, frames.shape[1])), frames]); diffs.append(fa[k:] - fa[:-k])
    fd = np.min(diffs, axis=0); fd[fd < 0] = 0; fd[:2] = 0
    if fd.max() > 0: fd = onsets.max() * fd / fd.max()
    onsets = np.maximum(onsets, fd)
    pk = np.zeros(onsets.shape); p = scipy.signal.argrelmax(onsets, axis=0); pk[p] = onsets[p]
    ti, fi = np.where(pk >= onset_thresh); ti = ti[::-1]; fi = fi[::-1]
    rem = frames.copy(); ev = []
    for s, f in zip(ti, fi):
        if s >= n - 1: continue
        i = s + 1; k = 0
        while i < n - 1 and k < energy_tol:
            k = k + 1 if rem[i, f] < frame_thresh else 0; i += 1
        i -= k
        if i - s <= min_len: continue
        rem[s:i, f] = 0
        if f < MAX_FREQ_IDX: rem[s:i, f + 1] = 0
        if f > 0: rem[s:i, f - 1] = 0
        ev.append((s, i, f + MIDI_OFFSET, float(np.mean(frames[s:i, f]))))
    if melodia:
        while rem.max() > frame_thresh:
            im, f = np.unravel_index(np.argmax(rem), rem.shape); rem[im, f] = 0
            i = im + 1; k = 0
            while i < n - 1 and k < energy_tol:
                if rem[i, f] < frame_thresh: k += 1
                else: k = 0
                rem[i, f] = 0
                if f < MAX_FREQ_IDX: rem[i, f + 1] = 0
                if f > 0: rem[i, f - 1] = 0
                i += 1
            ie = i - 1 - k
            i = im - 1; k = 0
            while i > 0 and k < energy_tol:
                if rem[i, f] < frame_thresh: k += 1
                else: k = 0
                rem[i, f] = 0
                if f < MAX_FREQ_IDX: rem[i, f + 1] = 0
                if f > 0: rem[i, f - 1] = 0
                i -= 1
            ist = i + 1 + k
            if ist < 0 or ie >= n: continue
            if ie - ist <= min_len: continue
            ev.append((ist, ie, f + MIDI_OFFSET, float(np.mean(frames[ist:ie, f]))))
    return ev

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('audio'); ap.add_argument('out')
    ap.add_argument('--onset', type=float, default=.5); ap.add_argument('--frame', type=float, default=.3)
    ap.add_argument('--minlen-ms', type=float, default=80); ap.add_argument('--fmin', type=float, default=30); ap.add_argument('--fmax', type=float, default=4200)
    a = ap.parse_args()
    so = ort.SessionOptions(); so.intra_op_num_threads = 2
    sess = ort.InferenceSession(MODEL, so, providers=['CPUExecutionProvider'])
    audio = load(a.audio); out = infer(audio, sess)
    min_len = int(np.round(a.minlen_ms / 1000 * (SR / FFT_HOP)))
    ev = notes_poly(out['note'], out['onset'], a.onset, a.frame, min_len, a.fmin, a.fmax)
    t = frames_to_time(out['note'].shape[0])
    notes = sorted([{'t': round(float(t[s]), 4), 'end': round(float(t[min(e, len(t) - 1)]), 4), 'm': int(m), 'a': round(a_, 3)} for s, e, m, a_ in ev], key=lambda x: (x['t'], x['m']))
    json.dump({'audio': a.audio, 'duration': len(audio) / SR, 'notes': notes}, open(a.out, 'w'))
    np.savez_compressed(a.out.replace('.json', '_act.npz'), note=out['note'].astype(np.float16), onset=out['onset'].astype(np.float16))
    print(f'{len(notes)} notes, {len(audio) / SR:.1f} s → {a.out}')

if __name__ == '__main__': main()
