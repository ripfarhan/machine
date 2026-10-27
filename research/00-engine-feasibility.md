# 00 — Real-time engine feasibility (measured)

Measured 2026-10-28 in the build container (Node 22, headless Chromium from Playwright).

## Per-voice cost
Prototype voice = 2 PolyBLEP saws + zero-delay-feedback 4-pole ladder with `tanh` input saturation.

| voices | Node, % of real time | Chromium AudioWorklet (OfflineAudioContext), % of real time |
|---|---|---|
| 16 | 7.0 % | – |
| 32 | 12.1 % | 12.0 % |
| 64 | 23.7 % | 24.3 % |
| 96 | – | 33.6 % |
| 128 | 47.6 % | – |

≈ 0.37 % of one core per full analog voice at 48 kHz. Budget for the live engine: ≤ 45 % total
(leaves headroom for UI rendering and slower laptops) → about 60–80 voice-equivalents plus effects.
Effects (plate reverb, delays, chorus, master) are a few voice-equivalents each.

## Loading the worklet from a `file://` page
- `audioWorklet.addModule(blobURL)` **fails** on `file://` (origin `null`: "a dependency or cross-origin script failed to load").
- `audioWorklet.addModule('data:text/javascript;base64,…')` **works**, in both `AudioContext` and `OfflineAudioContext`.
  → The engine core is one self-contained function; the page builds the worklet source from `CORE.toString()` and loads it as a data URL.
- `SharedArrayBuffer` is unavailable (`crossOriginIsolated: false`), so meters, note events and engine state go over `port.postMessage`, batched once per ~20 ms.
- `baseLatency` 0.01 s.

## Consequences for the design
- The same `CORE` runs in the AudioWorklet (live), in a Worker/OfflineAudioContext (fast WAV export) and in Node (automated evaluation).
- No allocation inside `process()`: voices are pooled, state in typed arrays.
