# Smoothness and terrain update — 25 October 2026

## Later feedback-loop pass: timers, loading and UI

The release now uses Michroma throughout the game and trailer captions. Phone circuit cards fit their maps and statistics without horizontal clipping. Website play occupies the available viewport, including short phone landscape screens. Leaving or hiding the embedded game pauses it and suspends its 3D rendering; it does not silently resume a race.

Qualifying and lap clocks have one display owner and use the session clock. Milliseconds are rounded once before formatting, including minute rollover. Completing Q2 and Q3 after player elimination now yields between small simulation batches; leaving the result screen cancels the pending work. A deterministic full-session comparison retained the same grid, times, progress and wear. The result backdrop stays still while those invisible sessions advance.

Steady driving no longer reads the viewport layout every frame. Resizing uses one drawing-buffer update; actual desktop, portrait and landscape images were compared with the previous resize path. The check allows only a single 8-bit rounding step in fewer than 0.01% of pixels, not a change of resolution or detail.

A profiler identified synchronous shader-link inspection as the large first-entry stall. A narrowly checked backport in tools/async_compile_patch.py submits shader variants without immediately reading their uniforms. Loading polls KHR_parallel_shader_compile completion, checks link failures, then uploads the existing textures in short batches. Browsers without that extension check one program between UI yields. Shader diagnostics remain enabled during play. This follows the non-blocking completion approach documented by [MDN](https://developer.mozilla.org/en-US/docs/Web/API/KHR_parallel_shader_compile); it does not reduce the shader work or texture quality.

The feedback loop caught and corrected an initial shader-cache colour regression before release. A fixed-camera comparison with preparation disabled then produced identical pixels. In that particular Singapore comparison, first draw took 384 ms with preparation and 9,601 ms without it; readiness took 11.16 s and 7.95 s respectively. Preparation deliberately moves work before play. These single sequential runs are not cache-independent speed guarantees. The earlier qualifying-entry diagnostic recorded a roughly 10 s cold stall; the final run's largest gap was 340 ms. Smaller gaps remain, so this is not a zero-stutter claim.

Current checks: qa/shader-preparation.json, qualifying-responsive.json, qualifying-browser-responsive.json, hud-timing.json, resize-render-equivalence.json and offline-all.json. The all-circuit and shader reports carry the tested HTML hash and are required by packaging. The comparison tables below belong to the older hashes printed beneath them.

Livery update: the active car now uses the supplied 2colour_livery artwork at 4096 x 4096. The historical comparison tables below describe their recorded artifact hashes, not a new browser performance benchmark for this artwork update. Current desktop package samples are recorded in qa/packaged-rendering.json and qa/performance-comparison.json.

The browser reuses race and render state instead of repeatedly allocating temporary objects. Its ambient-occlusion visibility pass caches the affected objects. Native code reuses traffic records and sampled poses, updates the racing-line instance buffer in one upload, and changes local shadow lights only when the selected lights change. These changes retain the existing graphics presets and supplied car/livery.

Circuit data in the standalone browser file is now compressed losslessly and decoded on demand. All 72 records compare equal to the source JSON. The HTML decreased from 98.51 MiB to 87.92 MiB (10.8%). This is a file-size measurement, not a promised loading-time reduction on every machine.

## Matched measurements

Before samples retained from the initial comparison; after samples rerun for the corrected barrier build. Same RTX 3050 laptop, High 1440x810. Browser samples 45 seconds; native samples 30 seconds. No simultaneous GPU benchmark or build. Single runs have uncontrolled thermal/background variation and are not minimum-FPS guarantees. Both tests use a moving 22-car field and a three-second warmup. The browser player is stationary; the native QA driver moves. Lower times are better. Thermal state and background activity can affect these single-run samples.

### Browser

| Circuit | Ready seconds, old → new | Median ms | p95 ms | Frames >33 ms | Frames >50 ms |
|---|---:|---:|---:|---:|---:|
| suzuka | 7.77 → 6.25 | 7.00 → 6.90 | 14.00 → 13.80 | 3 → 9 | 2 → 2 |
| singapore | 6.41 → 5.81 | 6.90 → 6.90 | 7.10 → 7.20 | 4 → 6 | 3 → 2 |
| interlagos | 7.12 → 7.26 | 7.00 → 7.00 | 14.00 → 13.90 | 11 → 7 | 7 → 2 |

### Native desktop

| Circuit | Ready seconds, old → new | Median ms | p95 ms | Frames >33 ms | Frames >50 ms |
|---|---:|---:|---:|---:|---:|
| suzuka | 6.45 → 6.62 | 7.15 → 7.01 | 10.54 → 9.66 | 2 → 1 | 0 → 0 |
| singapore | 7.39 → 6.16 | 8.20 → 7.28 | 11.55 → 9.88 | 6 → 3 | 2 → 1 |
| interlagos | 7.20 → 6.36 | 8.98 → 7.66 | 13.43 → 9.54 | 5 → 3 | 2 → 0 |

The raw comparisons preserve gains and regressions. Isolated long frames remain. This release does not establish universal FPS gains or eliminate all stutters. Earlier comparison reports describe older builds and should not be presented as measurements of this update.

## Terrain and unchanged rendering checks

Roadside terrain and runoff now partition one continuous surface, with identical heights along shared edges. The road coordinates, widths, banking and driving model remain unchanged. The Suzuka upper bridge is kept separate. Pit joins are cut without subdividing unrelated ground. Native conversion preserves connected ground detail instead of independently simplifying each adjoining strip. City-wide generic paint that bridged unrelated ground levels was removed; authored road markings and geographically mapped surfaces remain.

- All 14 browser circuits passed 7,200 sampled terrain checks each, with no detected road intrusions or mismatched seams after the city paint correction. Mapped coastlines and the intentional Suzuka bridge height difference are excluded from same-level seam assertions.
- All 14 browser circuits loaded and drove with network access blocked. Grandstand support/seating tests passed on all 14.
- The isolated ambient-occlusion cache change produced identical rendered pixels in Suzuka, Singapore and Monaco. This does not claim pixel identity for intentionally repaired ground geometry.
- Race-state reuse matched 686,400 prior-model fields across deterministic scenarios. Native vehicle and race tests passed 84,127 and 103,741 checks respectively.

These are finite software tests and sampled views, not a claim that every viewpoint is flawless, the circuits are survey-exact, or every low-end device performs equally. Physical controllers and public Internet sessions were not tested during this update. No website deployment or access-control change occurred.

## Trailer capture

The reel and landscape edit use separate framing and alternate real browser/native shots. Cinematic motion blur, depth of field, extra lighting and contact shadows run only in the offline capture projects. Normal gameplay does not load these added video effects. The source music is supplied by the user and is not included in source archives. Final media checks are recorded in the mixed-trailer reports.

Browser HTML SHA-256: `9992618638348148168e40d499ded6addbbfe3a98944d8bb1f12a999f81020b8`

Native resource pack SHA-256: `b82c87c376962e0b4e483abcea82df4d4bddf10a28d9af6d6b88791065b3ceb0`

Evidence: `upgrade/qa/smooth-comparison.json`, `terrain-seams-final.json`, `ssao-equivalence.json`, `packed-data.json`, `offline.json`, `offline-all.json`, `grandstand-grounding.json`; native `qa/performance-comparison.json`, `packaged-rendering.json`, `packaged-modes.json`, `packaged-input.json` and subsystem reports.

## Final browser frame samples for this pass

High, 1440 x 810, 22-car grid with moving AI and stationary player; 30 seconds after warmup. Single sequential samples, not minimum-frame-rate guarantees.

| Circuit | Median ms | p95 ms | p99 ms | Frames above 50 ms |
|---|---:|---:|---:|---:|
| singapore | 7.0 | 14.4 | 20.9 | 2 |
| suzuka | 7.0 | 13.9 | 14.0 | 1 |
| interlagos | 7.1 | 14.0 | 14.2 | 2 |

There is no uniform steady-state FPS gain in these browser samples. The measured first-entry and qualifying freezes are reduced; isolated gameplay and loading gaps remain. Texture sizes, road geometry and graphics presets are unchanged by this pass.

Tested HTML: 990ad51d16aa0ee19df829d4d68c5dc6bb60e4dbe07c7a75a40d6f212d6569b0

## Human handling and working pit-stop release

Steering, reverse, pit skipping and the responsive standings/strategy layout are covered in DRIVING-UPDATE.md. The crew exchanges only wheel assemblies: ten fixed axle/hub pieces remain attached in one shared draw batch per car. New opponent models cannot inherit removed wheels or a pit jack lift. The browser practice-mode idle-pose error is repaired and finite geometry is checked during service.

Idle crew poses no longer interpolate or upload unchanged geometry. Active service retains the articulated animation and synchronized pneumatic gun, jack and tyre effects. The native qualifying pit-exit skip completed in about 3.2 seconds in the UI test; this is a local observation, not a cross-device timing guarantee.

The final checks cover all 14 circuit loads, browser offline shader linking, packaged 22-car desktop grids, full Monaco and Spa desktop races, wet Singapore, home playback, keyboard input, synthetic controller inputs, pit service and pit exits. Physical-controller feel and pairing were not tested. Graphics presets, supplied livery and circuit detail are retained; no public deployment was performed.

The following are single 30-second High-preset samples at 1440 x 810 on this laptop, with one GPU test at a time. Background and thermal variation are uncontrolled. They are not minimum-FPS guarantees or evidence that all stutters are eliminated.

| Circuit | Median ms | p95 ms | p99 ms | Frames above 50 ms |
|---|---:|---:|---:|---:|
| singapore | 7.00 | 14.00 | 20.90 | 2 |
| suzuka | 7.00 | 13.80 | 14.00 | 0 |
| interlagos | 7.00 | 14.00 | 14.00 | 0 |

Tested artifact SHA-256: `f752b2ec79bf8525da17a7258fa0a6dc990272c60994d38b45ef7d6796c8904a`

## October 26 update and screen-fitting build

Fresh 30-second samples, High preset at 1440×810, one renderer at a time. Background load and temperatures were not controlled. The update retains existing graphics settings and scenery detail; these samples are regression evidence, not an FPS improvement claim or a no-stutter guarantee. Wider or larger windows may require more GPU work.

| Circuit | Median ms | p95 ms | p99 ms | Frames above 50 ms |
|---|---:|---:|---:|---:|
| singapore | 13.90 | 27.70 | 28.20 | 2 |
| suzuka | 13.90 | 20.80 | 27.80 | 0 |
| interlagos | 13.90 | 20.90 | 27.80 | 1 |

Tested artifact SHA-256: `806ebb5087346135838cb2c01bd5fde31407fab7a741b727eaa8e49ede01a10e`
