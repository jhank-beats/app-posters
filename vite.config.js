import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// NOTA: se retiró vite-plugin-html porque index.html no contiene el marcador
// <%= googleAnalytics %> y ese bloque inyectado nunca llegaba al HTML final.
export default defineConfig({
  plugins: [react()]
})
