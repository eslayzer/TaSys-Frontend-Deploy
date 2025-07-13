    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';

    // https://vitejs.dev/config/
    export default defineConfig({
      plugins: [react()],
      server: {
        proxy: {
          '/api': { // Todas las solicitudes que comiencen con /api
            target: 'http://localhost:3001', // Se redirigirán a tu backend
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, '/api'), // Asegura que la ruta /api se mantenga
          },
        },
      },
    });
    