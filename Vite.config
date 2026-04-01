import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
 
// During "npm run dev" Vite runs on :5173 and proxies /api → Express on :4567
// After "npm run build", Express serves everything on :4567
 
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4567'
    }
  }
})