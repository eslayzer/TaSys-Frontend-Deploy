import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({ // Añadir 'mode' al parámetro de la función
  plugins: [react()],
  server: {
    // Solo aplicar el proxy en desarrollo
    proxy: mode === 'development' ? {
      '/api': { // Todas las solicitudes que comiencen con /api
        target: 'http://localhost:3001', // Se redirigirán a tu backend
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'), // Asegura que la ruta /api se mantenga
      },
    } : {}, // En producción, el proxy es un objeto vacío
  },
}));
