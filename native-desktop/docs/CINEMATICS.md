# Cinematic reel and landscape edit

The two formats use fourteen unique circuit shots, alternating the browser WebGL renderer and the native Forward+ renderer. Both are authored at 60 frames per second, with separate portrait and landscape framing. The cars follow scripted paths derived from the game's racing line. This is in-engine footage, not a recording of human driving or a demonstration of autonomous overtaking.

Capture uses 1440×2560 for the reel and 2560×1440 for landscape, then downsamples to 1080×1920 and 1920×1080. Additional lighting, depth of field, contact shading and depth-aware motion blur apply only during authoring. Recording can run slower than real time; the encoded frame rate is not a gameplay performance measurement.

The edit uses the music file supplied by the user. That file is not redistributed with the game or source archive. Its location and the music/shot timings are set in `tools/trailer-plan.json`. Track titles, feature captions and the closing card all use regular Michroma. Titles have individual positions for each shot and format. The captions have letter-shaped shadows, no panel and no orange title bar. The normal Milano corner logo fades before the final hero mark and “ALWAYS THE FASTEST” card.

From the full repository, with both source trees and the music available:

```text
python native-desktop/tools/record-mixed-trailer.py --reuse
```

This optional authoring workflow requires Windows, a Vulkan GPU, FFmpeg, Pillow, NumPy and the browser automation dependencies. It uses separate temporary authoring projects and retains source captures in `work/mixed-trailer`. Do not run graphics benchmarks during recording. A local `work/mixed-trailer/plan.json`, if present, overrides the versioned plan. `--assemble --reuse` edits existing captures; it refuses missing or stale shots.

The final checks decode the complete output, verify dimensions, frame count, frame rate, duration and one audio stream, then produce a contact sheet. The per-format QA reports record the source build hashes and output hash. These checks and frame inspection are distinct from real-time playback review. The older native cinematic reel remains a separate file.

For a typography-only re-edit of an already verified capture, `--assemble --titles-only reel` or `--assemble --titles-only landscape` retains the original recording hashes and verifies every source clip. Runtime changes are not misrepresented as newly recorded footage.
