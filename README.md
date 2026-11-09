# SIGNLINK Prototype Review

React 18, TypeScript, Vite, and Three.js app for reviewing the SIGNLINK ENGG 405 Technopreneurship prototype concepts. It presents modelled parts, allocated part prices, planning estimates, and the prototype build cost. Figures are estimates in Philippine peso, not production manufacturing costs.

## Run locally

Use Node.js 20.19+ or 22.12+:

```bash
npm install
npm run dev
```

Open the local address printed by Vite. Run `npm test` and `npm run typecheck` to verify the data and types. Create a production build with `npm run build`.

## Assets and model viewer

The original v5 asset folder is served unchanged from `public/SIGNLINK_3D_Concepts_v5/`. Assembled models load on demand when the explorer is reached or its product is selected. Three.js is installed from npm; model and part GLBs are loaded by URL rather than imported into the bundle.

Product part data is kept in `src/data/signlinkData.ts`; the accessor can later be replaced with an API. All models and functions are concepts, and all prices are planning estimates. Refer to the Basis, assumptions and limits section in the app.
