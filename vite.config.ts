import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/graphql': {
        target: 'https://southafrica.higeco.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/graphql/, '/graphql'),
      },
      '/api/equipment': {
        target: 'https://southafrica.higeco.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/equipment/, '/GWC_V200/phpScript/deviceServerCgi.php'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            const token = proxyReq.getHeader('x-higeco-token') as string | undefined;
            if (token) {
              proxyReq.setHeader('cookie', `com.higeco.sid=${token}; ids=${token}`);
              proxyReq.removeHeader('x-higeco-token');
            }
          });
        },
      },
    },
  },
})
