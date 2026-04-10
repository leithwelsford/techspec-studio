import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite plugin that provides a /api/log endpoint for server-side logging.
 * The browser POSTs log data here and it prints to the terminal.
 */
function serverLogPlugin(): Plugin {
  return {
    name: 'server-log',
    configureServer(server) {
      server.middlewares.use('/api/log', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });

              if (data.type === 'cache') {
                const { cacheRead, cacheCreation, normalInput, savings, cost } = data;
                if (cacheRead > 0) {
                  console.log(`\x1b[32m[${ts}] 💾 CACHE HIT: ${cacheRead} tokens read (${savings}) — cost: $${cost?.toFixed(4) || '?'}\x1b[0m`);
                } else if (cacheCreation > 0) {
                  console.log(`\x1b[33m[${ts}] 💾 CACHE WRITE: ${cacheCreation} tokens written, ${normalInput} normal — cost: $${cost?.toFixed(4) || '?'}\x1b[0m`);
                }
              } else if (data.type === 'fix-progress') {
                console.log(`\x1b[36m[${ts}] 🔧 Fix ${data.current}/${data.total}: ${data.issue}\x1b[0m`);
              } else if (data.type === 'fix-complete') {
                console.log(`\x1b[32m[${ts}] ✅ Fix complete: ${data.fixes} fixes, ${data.errors} errors\x1b[0m`);
              } else if (data.type === 'generation') {
                console.log(`\x1b[36m[${ts}] 📄 ${data.message}\x1b[0m`);
              } else {
                console.log(`[${ts}] 📋 ${JSON.stringify(data)}`);
              }
            } catch {
              console.log(`[LOG] ${body}`);
            }
            res.writeHead(200);
            res.end('ok');
          });
        } else {
          res.writeHead(405);
          res.end();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serverLogPlugin()],
  server: {
    host: '0.0.0.0', // Listen on all interfaces for Docker
    port: 3000,
    open: false, // Don't auto-open in container
    strictPort: true,
    hmr: {
      clientPort: 3000 // Ensure HMR works through Docker port mapping
    }
  }
})
