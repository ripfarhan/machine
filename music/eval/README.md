# Studio evaluation

Measures rendered pieces with the same definitions as `music/analyze.py` and compares them to the reference profile.

    node music/eval/render.js js/synth.js /tmp/eval new random 64 1 2 3 4 5 6 7 8   # 8 "New piece" rolls, 64 bars
    python3 music/eval/metrics.py music/analysis/profile.json /tmp/eval new        # balance, dynamics, stereo, roughness
    node music/eval/solo.js 3                                                      # every role solo, raw, for seed 3 → out/
    python3 music/eval/solve.py                                                    # role gains that land the mix on the profile

`roughness` scores the interval content of simultaneously sounding notes (semitones and minor ninths cost most);
`near_peak_pct` is the fraction of samples within 0.5 dB of the peak — a soft-clip fingerprint.
