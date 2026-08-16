import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHtmlPlugin } from 'vite-plugin-html'

export default defineConfig({
  plugins: [
    react(),
    createHtmlPlugin({
      inject: {
        data: {
          googleAnalytics: `
            <script async src="https://www.googletagmanager.com/gtag/js?id=G-ZL7207LWHV"></script>
            <script>
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-ZL7207LWHV');
            </script>
          `
        }
      }
    })
  ]
})
