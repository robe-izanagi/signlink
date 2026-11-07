# SIGNLINK GLB and Three.js Integration Guide

## Asset location

The React website serves these assets from:

`public/SIGNLINK_3D_Concepts_v2/`

At runtime, build URLs using the Vite base path, for example:

```js
const assetRoot = `${import.meta.env.BASE_URL}SIGNLINK_3D_Concepts_v2`;
```

Do not hard-code a root-only URL if the site may be deployed beneath a subpath.

## GLB files

Each product has two GLB files:

- `models/SIGNLINK_Smart_Assembled.glb`
- `models/SIGNLINK_Smart_Exploded.glb`
- `models/SIGNLINK_Connect_Assembled.glb`
- `models/SIGNLINK_Connect_Exploded.glb`
- `models/SIGNLINK_Vision_Assembled.glb`
- `models/SIGNLINK_Vision_Exploded.glb`

Every component is a separately named mesh/node using the format:

`01 | Left Front Frame Rim`

The numeric prefix is the component ID. Preserve the component node names; they are used to match entries in the JSON reference files.

## Interactive exploded view (recommended runtime method)

The React/Three.js viewer should:

1. Load the selected product's **assembled** GLB with `GLTFLoader`.
2. Load `reference/threejs_explode_manifest.json` and `reference/all_components.json`.
3. Match each named mesh to its component ID and manifest entry.
4. Save each mesh's original local position.
5. Convert the manifest world-space offset to the mesh parent's local space if a transformed parent is used.
6. Animate each mesh from its original position to `originalPosition + offset * progress`.
7. Always calculate from the saved original position; never accumulate offsets on the already shifted position.
8. Restore the saved original positions when progress returns to zero.

The separate `*_Exploded.glb` files are **static exploded reference models**. The interactive website does not need to load them when the user presses Explode. It is expected to use the assembled GLB plus the manifest for animation. This prevents duplicate requests and avoids unnecessary model loads.

## References

- `reference/COMPONENTS_REFERENCE.md`: readable ID/name/function list.
- `reference/all_components.json`: structured per-product component data.
- `reference/SIGNLINK_Smart_parts.json`
- `reference/SIGNLINK_Connect_parts.json`
- `reference/SIGNLINK_Vision_parts.json`
- `reference/threejs_explode_manifest.json`: exploded offsets in metres.

All GLB geometry is authored in millimetres and exported in metres, consistent with glTF conventions. Manifest offsets are also in metres.

## Model limitations

These are visual concept models, not manufacturing-ready CAD. Optical modules, camera fields of view, dimensions, material thicknesses, component clearances, battery packaging, and mounting details require engineering validation before fabrication.
