# SIGNLINK React Landing Page

The React/Vite landing page recreates the supplied Claude design and uses the SIGNLINK concept previews, GLB models, and component references in `public/SIGNLINK_3D_Concepts_v2/`.

## Run locally

Use Node.js 20.19+ or 22.12+:

```bash
npm install
npm run dev
```

Open the local address printed by Vite. Create a production build with `npm run build`.

## Interactive model explorer

The 3D viewer loads the selected assembled GLB on demand. It uses the supplied exploded-view manifest and component data to animate named meshes, describe components, and support selection, search, rotation, zoom, and pan. The separate exploded GLBs and preview renders remain unchanged in `public/SIGNLINK_3D_Concepts_v2/`.

All three products and every described function are concepts, not validated or commercially available features. The SIGNLINK Android app is not available; its disabled download button has no APK URL.
