# SIGNLINK 3D Concept Package

## Contents
- `models/*_Assembled.glb`: assembled products with individually named components.
- `models/*_Exploded.glb`: static exploded arrangements of the same components.
- `previews/*.png`: studio preview renders, including assembled and exploded views.
- `reference/COMPONENTS_REFERENCE.md`: human-readable component index.
- `reference/all_components.json`: structured catalog for all variants.
- `reference/threejs_explode_manifest.json`: per-part exploded offsets for Three.js animation.
- `source/build_models.py`: procedural source generator for the concept geometry.

## Component counts
- SIGNLINK Smart: 41 components.
- SIGNLINK Connect: 48 components.
- SIGNLINK Vision: 49 components.
- Total: 138 individually named mesh components.

## Opening the models
Import a `.glb` file into Blender or another glTF-compatible 3D viewer. In Blender, use the Outliner to select individual named components. The assembled and exploded states are supplied as separate files for inspection.

## Three.js
For interactive web viewing, load the assembled GLB and animate each named mesh using `reference/threejs_explode_manifest.json`. The separate exploded GLB is a static reference; it does not need to be loaded for an interactive explosion slider.

## Limitations
These are visual concept models, not manufacturing-ready CAD, validated optical designs, tested electronics, or certified hardware layouts. Component placements and dimensions require professional engineering validation before fabrication.
