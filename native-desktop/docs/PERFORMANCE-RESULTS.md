# Smoothness and terrain update — 25 October 2026

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
