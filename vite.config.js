import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'

// `npm run dev:phone` start de dev-server met een zelfondertekend HTTPS-certificaat
// op je lokale netwerk, zodat de camera ook op je iPhone werkt (camera vereist HTTPS).
export default defineConfig(({ mode }) => ({
  plugins: [vue(), ...(mode === 'phone' ? [basicSsl()] : [])],
  build: {
    // inferencejs bundelt TensorFlow.js; die chunk is groot, dat is normaal.
    chunkSizeWarningLimit: 8000,
  },
  test: {
    environment: 'node',
  },
}))
