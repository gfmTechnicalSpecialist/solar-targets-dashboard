import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-ignore -- no type declarations available
import obfuscatorPlugin from 'vite-plugin-obfuscator'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    obfuscatorPlugin({
      include: ['src/api/**', 'src/context/AuthContext.tsx'],
      apply: 'build',
      options: {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.4,
        stringArray: true,
        stringArrayEncoding: ['rc4'],
        stringArrayThreshold: 0.75,
        renameGlobals: false,
        selfDefending: false,
        splitStrings: true,
        splitStringsChunkLength: 5,
        identifierNamesGenerator: 'hexadecimal',
      },
    }),
  ],
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
