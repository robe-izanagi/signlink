import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Keep public 3D assets available at stable root-relative URLs.
  // For deployment under a subpath, configure `base` deliberately.
});
