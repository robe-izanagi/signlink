# GitHub Copilot Agent Prompt — Build the SIGNLINK React Landing Page

You are a senior React.js frontend engineer, product UI/UX designer, and Three.js developer. Implement the SIGNLINK landing page in this existing Vite + React JavaScript project.

## 1. Read the supplied references first

Before coding, inspect:

1. `public/SIGNLINK_Landing_Page_Concept_Claude.html` — this is the approved visual and interaction design reference. Reproduce its design language, page structure, section order, content hierarchy, colour system, product identities, and interactions in React.
2. `public/SIGNLINK_3D_Concepts_v2/README.md`
3. `public/SIGNLINK_3D_Concepts_v2/GLB_AND_THREEJS_GUIDE.md`
4. `public/SIGNLINK_3D_Concepts_v2/reference/COMPONENTS_REFERENCE.md`
5. `public/SIGNLINK_3D_Concepts_v2/reference/threejs_explode_manifest.json`
6. `public/SIGNLINK_3D_Concepts_v2/reference/all_components.json`
7. Each product-specific parts file in `public/SIGNLINK_3D_Concepts_v2/reference/`.

Do not start by inventing a new design. The Claude HTML is the visual source of truth. You may improve responsiveness, accessibility, maintainability, and code quality, but preserve its overall look and user experience.

## 2. Required stack and constraints

- React.js with JavaScript and `.jsx` files only. Do not use TypeScript or `.tsx`.
- Vite is already configured.
- Use the installed `three` package directly with `GLTFLoader` and `OrbitControls` from `three/addons/...`.
- Use `lucide-react` for icons where appropriate.
- Use regular CSS files and reusable React components.
- Do not use an iframe to embed the Claude HTML as the final site. Rebuild the design in React.
- Do not use a different frontend framework.
- Do not modify, rename, compress destructively, or regenerate the supplied GLB assets.
- Do not replace the supplied models with primitive glasses or placeholder models.
- Do not create an APK or add a fake download URL.

The app dependencies and starter structure are already in `package.json`. Run `npm install` if dependencies are not installed.

## 3. Asset locations — preserve these paths

All assets are in Vite's public directory:

`public/SIGNLINK_3D_Concepts_v2/`

At runtime, access them using URLs beginning with:

`/SIGNLINK_3D_Concepts_v2/`

Important model files:

- `models/SIGNLINK_Smart_Assembled.glb`
- `models/SIGNLINK_Smart_Exploded.glb`
- `models/SIGNLINK_Connect_Assembled.glb`
- `models/SIGNLINK_Connect_Exploded.glb`
- `models/SIGNLINK_Vision_Assembled.glb`
- `models/SIGNLINK_Vision_Exploded.glb`

Preview renders:

- `previews/SIGNLINK_Smart_Assembled.png`
- `previews/SIGNLINK_Connect_Assembled.png`
- `previews/SIGNLINK_Vision_Assembled.png`
- Corresponding `*_Exploded.png` files and `SIGNLINK_3D_Overview.png`.

Use the assembled GLB as the interactive viewer's base model. Use the exploded GLB as a visual validation/reference state. The supplied manifest contains each component's target exploded offset; use it to animate individual meshes from the assembled model. Do not simply switch to the static exploded GLB when the user moves the explosion slider.

## 4. Brand and visual direction

Brand: SIGNLINK.

Main headline from the reference:

“Technology That Connects Every Perspective.”

Brand line:

“One intelligent platform. Three ways to experience the world.”

Use a premium, editorial, modern wearable-technology aesthetic. Keep the product models as the visual focus. Avoid a generic SaaS template.

Preserve the reference colour system:

- Dark background: `#0a101c`
- Secondary dark: `#121b2c`
- Deep panel: `#1b2740`
- Light section background: `#edf0f4`
- Main light text: `#e8edf6`
- Muted text: `#9aa8c0`
- SIGNLINK Smart accent: `#6aa8ff`
- SIGNLINK Connect accent: `#2fd6c9`
- SIGNLINK Vision accent: `#ffa23a`

Use Bricolage Grotesque for headings and Instrument Sans for body copy, matching the Claude HTML. Load fonts responsibly and provide system fallbacks.

## 5. Three product variants — keep their roles accurate

### SIGNLINK Smart

Target: General users.

Proposed features:
- AI personal companion
- Voice interaction
- Scene understanding
- Language translation
- Hands-free photo and video capture

Model: `SIGNLINK_Smart_Assembled.glb`.

### SIGNLINK Connect

Target: Deaf and hard-of-hearing people.

Proposed features:
- Real-time speech captions
- Speech-to-sign representation
- Sign recognition
- Sign-to-text and sign-to-voice
- Selectable text, sign, or combined output

Hearing and blind people may benefit as communication partners without needing to wear the device.

Model: `SIGNLINK_Connect_Assembled.glb`.

### SIGNLINK Vision

Target: Blind and low-vision people.

Proposed features:
- AI Visual Companion
- Live scene descriptions
- Voice questions about surroundings
- Image/video explanations
- Concise default descriptions and detailed answers on request
- Basic awareness alerts for supported potential hazards

Do not claim that hazard alerts guarantee safety or replace a cane, guide dog, or other mobility support.

Model: `SIGNLINK_Vision_Assembled.glb`.

All product functions must be described as proposed/concept features, not validated commercial capabilities.

## 6. Page sections — follow the Claude reference

Implement these sections in this order:

1. Fixed navigation bar with SIGNLINK logo, Overview, Products, Technology, Explore 3D, About, and Get the App.
2. Hero section with headline, subtitle, primary CTAs, and a premium product visual. A subtle auto-rotating Smart 3D hero is preferred if performance allows.
3. Three product cards for Smart, Connect, and Vision using the supplied preview images.
4. Interactive 3D product explorer.
5. Technology section covering AI, computer vision, speech recognition, sign-language recognition, augmented reality, wearable electronics, and audio assistance.
6. Product use-case sections for all three variants with preview renders.
7. Product comparison table.
8. SIGNLINK Android app promotion section.
9. About SIGNLINK section.
10. Footer with navigation and concept disclaimer.

Use smooth anchor navigation and working product-card/tab selection. Keep content close to the original Claude page. Small editorial improvements are acceptable, but do not remove major sections.

## 7. Interactive Three.js viewer — highest priority

Build a reusable React Three.js viewer, ideally in its own component and hook/service. It must support all three variants.

Required behavior:

- Load the selected product's assembled GLB using `GLTFLoader`.
- 360-degree orbit using `OrbitControls`.
- Mouse and touch rotation.
- Zoom and pan with sensible min/max distances.
- Reset camera/view.
- Product switching between Smart, Connect, and Vision.
- Lazy-load only the selected product's assembled GLB; dispose the previous scene resources safely.
- Loading state, progress if available, and a visible error/fallback state.
- Use the correct product accent colour for selected states and controls.

Exploded view:

- Provide Explode, Assemble, and a 0–100% range slider.
- Animate smoothly between assembled and exploded states.
- Allow the user to stop/pause animation if appropriate.
- Store every component's original position/quaternion/scale before applying offsets.
- Always derive the current position from the original transform and slider progress; never repeatedly add offsets to an already moved position.
- Read the offsets from `reference/threejs_explode_manifest.json`.
- Manifest offsets are in metres. Respect the supplied units.
- Match nodes using the original GLB node name / `userData.name`. Node names include a two-digit ID prefix, for example `01 | Left Front Frame Rim`.
- The manifest product entry is keyed by the component name. Use both the name and component ID to validate matches.
- Convert world-space exploded offsets to the correct parent-local direction if a component has a transformed parent. Update world matrices before computing conversions.
- Do not invent arbitrary offsets.
- The separately supplied exploded GLB is a visual reference only for validating the direction and general amount of separation.

Component inspection:

- Clicking/tapping a mesh selects it and highlights it without permanently damaging its original material.
- Restore the original material when deselected or when the model changes.
- Show component ID, exact component name, description, role/type, and useful location text in an information panel.
- Build the component list from the supplied product-specific JSON or `all_components.json`, not a hand-maintained duplicate list.
- Selecting a list item highlights the correct mesh and scrolls the list item into view.
- Clicking the selected component again or pressing Deselect clears selection.
- Use a search field to filter component names and IDs.
- If a transparent lens intersects pointer picking, prefer a meaningful solid component behind it when appropriate.

Lifecycle and performance:

- Create the renderer only when the canvas is mounted.
- Use `ResizeObserver` and clean it up.
- Stop or reduce rendering when the viewer is outside the viewport or the browser tab is hidden.
- Cancel animation frames on unmount.
- Remove event listeners and dispose of `OrbitControls`, renderer, geometries, materials, and owned textures correctly.
- Avoid stale async model loads overwriting a newly selected product; use a request token or cancellation guard.
- Do not run duplicate animation loops under React StrictMode.

## 8. App download section

The APK does not exist yet.

Show a Coming Soon badge and a disabled button or clear unavailable status. Do not fabricate a download link or claim the application is available.

## 9. Responsive design and accessibility

- Desktop: premium multi-column layouts and a large 3D viewer.
- Tablet: reduce columns and preserve comfortable viewer dimensions.
- Mobile: stack layouts, keep the viewer touch-friendly, make component list usable, and prevent horizontal overflow.
- Use semantic landmarks, accessible button labels, visible focus styles, sufficient contrast, and reduced-motion support.
- Keep controls usable with keyboard where practical.

## 10. Recommended React project structure

You may refine the exact structure, but keep responsibilities separated. For example:

```text
src/
  App.jsx
  main.jsx
  components/
    layout/
      Navbar.jsx
      Footer.jsx
    sections/
      HeroSection.jsx
      ProductCardsSection.jsx
      TechnologySection.jsx
      UseCasesSection.jsx
      ProductComparison.jsx
      AppDownloadSection.jsx
      AboutSection.jsx
    product-explorer/
      ProductExplorer.jsx
      ThreeProductViewer.jsx
      ViewerControls.jsx
      ComponentInfoPanel.jsx
      ComponentList.jsx
  data/
    products.js
  hooks/
    useProductModel.js
  utils/
    assetPaths.js
    componentMetadata.js
  styles/
    index.css
    variables.css
```

Use `.jsx` and `.js` only. Avoid TypeScript.

## 11. Verification before finishing

After implementation:

1. Run `npm run build` and fix build errors.
2. Run the app with `npm run dev`.
3. Confirm the Claude reference HTML remains accessible at `/SIGNLINK_Landing_Page_Concept_Claude.html`.
4. Confirm all 3 assembled models load from the correct public asset paths.
5. Confirm product switching does not leave stale models in memory.
6. Confirm 360-degree rotation, zoom, and pan.
7. Confirm Explode, Assemble, and slider at 0%, 50%, and 100%.
8. Confirm component picking and list selection for every product.
9. Confirm descriptions and IDs match the supplied JSON/manifest.
10. Confirm no broken preview images.
11. Confirm mobile layout and touch interaction.
12. Confirm the APK button remains Coming Soon and has no fake href.

Do not claim a test passed unless you actually ran it. Provide a concise completion summary including any remaining limitations.

## 12. Start now

First inspect the included HTML and asset folders. Then replace the temporary starter screen with the complete React landing page. Preserve the Claude design as closely as possible while making the code modular, responsive, and production-conscious.
