# SIGNLINK 3D Concepts v5 (redesign of v4)
Same 295-component catalog as v4 (Smart 95, Connect 106, Vision 94: identical IDs, names, roles, materials, descriptions). Only the design changed: smooth sculpted wayfarer frame, curved lenses, polished temples with perforated speaker grilles, dual-camera bridge pod, flush USB-C, layered internal electronics.

- models/: Assembled, Exploded, Cutaway GLB per product (9 files; metres; front faces -Z, temples +Z, Left = -X). Nodes are named "NNN | Component Name".
- part_assets/glb/<Product>/ and part_assets/images/<Product>/: standalone GLB + PNG for each of the 295 components.
- previews/: assembled/exploded/cutaway renders + overview sheet.
- reference/: threejs_explode_manifest.json (explode offsets + per-part location), *_parts.json, all_components.json, COMPONENTS_REFERENCE.md, VALIDATION_REPORT.txt.
- source/: build_signlink_v5.py (+ build_sample.py helpers). Rebuild: `python3 build_signlink_v5.py <v4_folder> <out_folder>` (numpy, scipy, scikit-image).

Three.js notes: GLTFLoader sanitizes node names (spaces -> underscores); read the original from `object.userData.name`. Animate from stored original positions: position = original + explodedOffsetMeters * t.
Concept models only. Not manufacturing-ready CAD or validated electronics/optics/thermal/battery design.
