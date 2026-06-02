import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { scanDirectory, parseIgnoreFile } from '../utils/files';
import { bundleRepository, estimateTokens } from '../utils/bundler';

export interface ServerConfig {
  port: number;
  workspaceRoot: string;
}

export function startWebServer(config: ServerConfig): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = req.url || '/';

      // 1. API: Get Workspace File Tree
      if (url === '/api/files' && req.method === 'GET') {
        try {
          const gitignorePath = path.join(config.workspaceRoot, '.gitignore');
          const deckignorePath = path.join(config.workspaceRoot, '.deckignore');
          const ignoreRules = [
            ...parseIgnoreFile(gitignorePath),
            ...parseIgnoreFile(deckignorePath)
          ];
          const files = scanDirectory(config.workspaceRoot, ignoreRules);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ files }));
        } catch (e: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Failed to scan directory: ${e.message}` }));
        }
        return;
      }

      // 2. API: Generate Bundle
      if (url === '/api/bundle' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const { files, format, removeEmptyLines } = data;

            if (!Array.isArray(files)) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'files parameter must be an array' }));
              return;
            }

            const bundle = bundleRepository(config.workspaceRoot, files, {
              format: format || 'xml',
              removeEmptyLines: !!removeEmptyLines
            });

            const tokenStats = estimateTokens(bundle);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ bundle, tokenStats }));
          } catch (e: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Failed to build bundle: ${e.message}` }));
          }
        });
        return;
      }

      // 3. Static File Server
      // Resolve path within the public folder.
      // The public folder is located adjacent to this script in the built dist or src directory.
      let safeUrl = url.split('?')[0];
      if (safeUrl === '/') safeUrl = '/index.html';

      const publicDir = path.join(__dirname, 'public');
      const filePath = path.join(publicDir, safeUrl);

      // Simple directory traversal protection
      if (!filePath.startsWith(publicDir)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
      }

      if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
        const ext = path.extname(filePath).toLowerCase();
        let contentType = 'text/plain';

        if (ext === '.html') contentType = 'text/html';
        else if (ext === '.css') contentType = 'text/css';
        else if (ext === '.js') contentType = 'application/javascript';
        else if (ext === '.json') contentType = 'application/json';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.jpg') contentType = 'image/jpeg';
        else if (ext === '.ico') contentType = 'image/x-icon';

        res.writeHead(200, { 'Content-Type': contentType });
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      }
    });

    server.on('error', (e: any) => {
      if (e.code === 'EADDRINUSE') {
        // Try another port if in use
        const nextPort = config.port + 1;
        server.listen(nextPort, () => {
          resolve({ server, port: nextPort });
        });
      } else {
        reject(e);
      }
    });

    server.listen(config.port, () => {
      resolve({ server, port: config.port });
    });
  });
}
