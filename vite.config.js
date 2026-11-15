import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Web Bluetooth only works on a secure origin (https or localhost).
// `npm run dev:phone` serves over self-signed https on your LAN so you can
// open it from your phone's Chrome (tap "Advanced → Proceed" once).
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'phone' ? [basicSsl()] : [])],
  server: { port: 5173 },
}));
