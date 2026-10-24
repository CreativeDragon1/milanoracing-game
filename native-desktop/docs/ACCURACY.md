# Circuit evidence and accuracy

This native project shares researched source assets with the browser game. Its runtime, renderer, material pipeline, UI and vehicle code are independent. Godot 4.7.2 Forward+ supplies the native Vulkan renderer; Milano does not claim to have written Vulkan, the graphics driver or Godot.

The real circuits are reconstructions, not laser-scanned digital twins. OpenStreetMap footprints and roads, calibrated circuit traces, public width data, terrain tiles and photographic references have different spatial resolution and capture dates. Some land-cover imagery dates from 2016/2017. A building's mapped footprint does not establish its exact facade, height or current appearance. Inferred dimensions and placement must not be described as surveyed facts.

Milano Autodromo, Riviera and Solara are fictional. The two new designs use selected FIA Appendix O dimensional guidance; they are not homologated circuits. Team sponsor placements are an original Milano event design, not the real venues' commercial contracts.

## Preserved data

- Circuit coordinates, variable widths, banking, elevations and optimized line data: `game/circuits/physics.json`, generated from `upgrade/src/world-tour-data.json`.
- Geographic transform, source and imagery vintage: `game/circuits/geography.json`.
- Mapped pit routes: `game/circuits/pits.json`. Width, clearance and ramp elevation are reconstructed. Yas Marina's mapped underground section is explicitly separated from its road deck.
- Native meshes and materials: exported offline from the curated source geometry, then compiled into `.scn` resources. No HTML or browser runtime is shipped in the native executable.
- Original MR 26 geometry, livery and supplied Milano logo are retained. Native resin shading preserves the artwork.

## Validation boundaries

Compiler success and finite vehicle states do not establish real-car correlation. Screenshots do not establish dynamic frame-rate stability. A single GPU benchmark does not establish minimum specifications. Every release must report actual frame-time distributions, circuit coverage, unresolved rendering defects and which game modes are implemented.

Exact every-detail claims require independently surveyed geometry, up-to-date site imagery and suitable asset rights. The project records these gaps rather than presenting approximations as exact.
