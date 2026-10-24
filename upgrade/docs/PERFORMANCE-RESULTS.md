# Performance and pit validation — 25 October 2026

This release fits the supplied Livery_FINAL artwork to its matching designer UVs and preserves MR 26 geometry, road textures and nearby tree detail. The browser renderer shares opponent draws and caches static transforms and foliage selection. Ambient occlusion uses half-resolution sampling with depth-aware reconstruction; beauty, depth and normals remain full resolution. Native assets include precomputed geometry, GPU buffers, visibility bounds and car distance meshes. These changes reduce redundant work rather than establishing identical pixels at every viewpoint.

An additional browser pass shares exactly matching static materials and unmodified box geometry. Its texture comparisons use texture identity without exporting image pixels. Fifteen serializer checks passed, and nine seeded before/after views across Monza, Singapore and Interlagos were pixel-for-pixel identical. This isolates the batching optimization; it does not establish that every earlier rendering change is pixel-identical to the old release.

## Measurements

The machine uses an NVIDIA GeForce RTX 3050 6 GB Laptop GPU. Both versions use High at 1440×810. GPU tests run sequentially. Baselines are the untouched prior Downloads builds. The native comparison alternates old/new per circuit. Browser tests alternate old/new twice per circuit, reversing order on the second repetition; table entries average the two runs, including spike counts. Raw individual runs remain in the reports. Thermal state and background work vary, so these short runs do not establish minimum FPS or performance on low-end machines.

Browser: 22-car field moving while the player remains at the grid, 12 seconds after a 3-second warmup. Lower frame times are better.

| Circuit | Load seconds, old → new | Median ms | p95 ms | p99 ms | Frames >33 ms | Frames >50 ms | Draw calls |
|---|---:|---:|---:|---:|---:|---:|---:|
| monza | 11.67 → 4.94 | 13.90 → 10.40 | 17.40 → 14.00 | 24.30 → 20.80 | 1.5 → 2.5 | 0 → 1 | 2483 → 2298 |
| singapore | 10.40 → 4.90 | 6.90 → 6.90 | 7.10 → 7.10 | 10.55 → 13.90 | 0 → 3 | 0 → 1.5 | 1353 → 961 |
| interlagos | 12.26 → 5.81 | 6.95 → 7.00 | 13.70 → 13.90 | 14.00 → 14.05 | 0 → 3.5 | 0 → 0.5 | 1491 → 1019 |

Native: 22-car moving field with a deterministic driver, 30 seconds after a 3-second warmup. The table includes frame pacing and loading; it is not an unlimited-throughput benchmark.

| Circuit | Load seconds, old → new | Median ms | p95 ms | Mean race-model CPU ms |
|---|---:|---:|---:|---:|
| monza | 12.23 → 7.06 | 12.49 → 11.67 | 23.43 → 22.63 | 1.257 → 1.395 |
| singapore | 7.03 → 7.01 | 8.34 → 8.50 | 12.12 → 11.92 | 1.479 → 1.456 |
| interlagos | 6.50 → 6.74 | 9.22 → 8.52 | 12.80 → 11.53 | 1.570 → 1.545 |

The raw reports retain all spikes and regressions. Faster average/median frames do not prove that every stutter is gone. Earlier prototype reports, including experiments with fewer nearby tree triangles or manual native AI batching, are historical and do not describe the shipped settings. Manual native AI batching was rejected after a worse measured result.

The new browser still recorded isolated frames over 50 ms in the short comparisons. A separate 20-second Singapore trace, starting after the three-second warmup, caught a 32.7 ms major garbage-collection pause within a 50 ms task near the start; no further long task appeared in that trace. This identifies one remaining hitch, not the cause of every spike. It is not a stutter-free claim. The final Singapore loading probe became ready in 4.52 seconds, with a 294 ms longest task, versus 8.85 seconds and 5.40 seconds respectively in the earlier untouched-baseline loading probe. Those loading probes are separate from the alternating runs above.

## Isolated race-model CPU work

Six alternating timed repetitions after warmup, 22 cars and 3,600 simulation steps per repetition. This isolates the corridor-query change from graphics and is not a claim of equivalent FPS improvement.

| Circuit | Old total ms | New total ms | Reduction |
|---|---:|---:|---:|
| monza | 583.9 | 369.1 | 36.8% |
| singapore | 624.3 | 374.0 | 40.1% |
| interlagos | 556.3 | 345.0 | 38.0% |

## Pit, handling and release checks

- All 14 complete browser assisted pit traversals passed. 5,718 pit surface rays found no missing floor or overlapping tested ground. The checks also found no garage-edge intrusion, reversed generated seating or pit paint crossing the racing surface.
- The separated working corridor has at least 2.03 m of clearance from the game racing surface. The first and last 120 m are merge zones; the Yas Marina underground crossing is excluded from the horizontal-separation requirement.
- The largest one-step player-control handover movement was 0.186 m and heading change was 0.202 degrees at 120 Hz. These are numerical checks, supported by rendered merge and garage inspection frames.
- Browser qualifying, race start, pit stop, tyre service and return to the track passed. The sporting model passed 3,254,000 checks after the traffic update. Offline browser loading and native packaged checks are recorded separately.
- Native source tests cover software-injected keyboard/gamepad input and complete practice pit traversals. Exported executable checks cover all 14 moving grids, full Monaco and Spa races, wet rendering, home footage, player input and UI. Private local multiplayer is tested with two native clients.
- Adaptive pace fitting passed synthetic held-out tests across all 14 circuits. It is a small local model, not a driving policy trained on real players. No physical Bluetooth device or public-Internet session was tested.

The render checks sample scenes and routes; they do not prove that every viewpoint is defect-free or that the game matches surveyed geometry. No live website deployment or access-policy change was performed.

Browser HTML SHA-256: `e826afe82dfb43232bd988f8752bea4978243615d25b41bb96be81cb6bc0b173`

Native pack SHA-256: `bfed7df025f89b565d5a9ea97bffdafd345c17e0d79bd0172ea4bde9e7c4df50`

Evidence: browser `qa/pit-driving.json`, `qa/pit-alignment.json`, `qa/performance-release-*.json`, `qa/race-cpu-performance.json`; native `qa/packaged-*.json`, `qa/performance-comparison.json` and subsystem reports. Repeatable tools and tests are included in the source archives.
