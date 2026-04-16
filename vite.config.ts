import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import http from 'node:http'

/** Proxy /__ai_proxy/<port>/path → http://localhost:<port>/path to avoid CORS in dev */
function aiCorsProxy(): Plugin {
  return {
    name: 'ai-cors-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = req.url?.match(/^\/__ai_proxy\/(\d+)(\/.*)/);
        if (!match) return next();
        const [, port, path] = match;
        const fwdHeaders = { ...req.headers, host: `localhost:${port}` };
        // Remove accept-encoding so upstream sends uncompressed (important for SSE)
        delete fwdHeaders['accept-encoding'];
        const proxyReq = http.request(
          { hostname: 'localhost', port: Number(port), path, method: req.method, headers: fwdHeaders },
          (proxyRes) => {
            const h: Record<string, string | string[]> = {};
            for (const [k, v] of Object.entries(proxyRes.headers)) {
              if (v != null && k !== 'transfer-encoding' && k !== 'content-encoding') h[k] = v;
            }
            h['cache-control'] = 'no-cache';
            h['x-accel-buffering'] = 'no';
            res.writeHead(proxyRes.statusCode ?? 502, h);
            // Flush each chunk immediately for SSE streaming
            proxyRes.on('data', (chunk: Buffer) => { res.write(chunk); });
            proxyRes.on('end', () => { res.end(); });
          },
        );
        proxyReq.on('error', (err) => {
          if (!res.headersSent) res.writeHead(502);
          res.end(`Proxy error: ${err.message}`);
        });
        req.pipe(proxyReq);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), aiCorsProxy()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand', 'd3', 'yjs'],
    exclude: ['@blocksuite/store', '@blocksuite/presets', '@blocksuite/blocks'],
  },
  server: {
    port: 3000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
