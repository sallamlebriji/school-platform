import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En développement, l'API Express tourne sur :4000 ; Vite relaie /api et /socket.io.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
});
