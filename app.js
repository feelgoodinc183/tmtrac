/**
 * cPanel / Phusion Passenger Node.js Entry Point for TMTRAC (tmtrac.my)
 * 
 * Configured specifically for Exabytes cPanel shared hosting:
 * Directory: /home/tmtecq00/public_html/tmtrac.my
 */
// Ensure process.cwd() is strictly pinned to this app's folder on cPanel Passenger
try {
  process.chdir(__dirname);
} catch (e) {}

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.APP_DIR = __dirname;
process.env.DATA_DIR = require('path').join(__dirname, 'data');

console.log('=== [TMTRAC] Starting on cPanel Phusion Passenger ===');
console.log('Node version:', process.version);
console.log('Process PID:', process.pid);
console.log('Current Directory:', process.cwd());
console.log('App Directory:', __dirname);
console.log('PORT environment:', process.env.PORT || '(none, using passenger socket)');
console.log('PhusionPassenger detected:', typeof PhusionPassenger !== 'undefined');

// Helper to bind a server to Passenger socket or fallback port
function bindToPassenger(srv, label = 'Server') {
  if (typeof PhusionPassenger !== 'undefined') {
    srv.listen('passenger', () => {
      console.log(`[TMTRAC] ${label} listening on PhusionPassenger socket`);
    });
  } else if (process.env.PORT) {
    const rawP = process.env.PORT;
    if (!isNaN(Number(rawP))) {
      srv.listen(Number(rawP), '0.0.0.0', () => {
        console.log(`[TMTRAC] ${label} listening on http://0.0.0.0:${rawP}`);
      });
    } else {
      srv.listen(rawP, () => {
        console.log(`[TMTRAC] ${label} listening on socket: ${rawP}`);
      });
    }
  } else {
    // If running in cPanel without PORT env, try passenger socket first
    try {
      srv.listen('passenger', () => {
        console.log(`[TMTRAC] ${label} listening on passenger socket`);
      });
    } catch (e) {
      srv.listen(3000, '0.0.0.0', () => {
        console.log(`[TMTRAC] ${label} listening on port 3000`);
      });
    }
  }
}

// Export bind helper for server.cjs
global.__bindToPassenger = bindToPassenger;

try {
  // Load production bundled application
  require('./dist/server.cjs');
} catch (err) {
  console.error('=== [TMTRAC] Server startup error ===', err);

  // If dist/server.cjs failed to load (e.g. dependencies not yet installed),
  // DO NOT exit with process.exit(1)! Exiting causes cPanel to show a blank 503 error.
  // Instead, launch a diagnostic dashboard on the Passenger socket so the user
  // gets clear guidance in their browser on what command to run.
  const http = require('http');
  const fs = require('fs');
  const path = require('path');

  const diagServer = http.createServer((req, res) => {
    // Attempt to serve static assets from dist/ if requested
    const url = (req.url || '/').split('?')[0];
    const distPath = path.join(__dirname, 'dist');
    const filePath = path.join(distPath, url === '/' ? 'index.html' : url);

    if (url !== '/' && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.woff2': 'font/woff2',
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      return fs.createReadStream(filePath).pipe(res);
    }

    // Render diagnostic guide
    const errString = (err && (err.stack || err.message)) || 'Unknown startup error';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TMTRAC - cPanel Setup Assistant</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; background: #070B14; color: #CBD5E1; padding: 24px; line-height: 1.6; }
          .container { max-width: 840px; margin: 20px auto; background: #0E1526; border: 1px solid #1E293B; border-radius: 16px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1E293B; padding-bottom: 20px; margin-bottom: 24px; }
          .badge { background: #0284C7; color: #FFF; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; }
          h1 { color: #F8FAFC; font-size: 22px; font-weight: 700; }
          .desc { font-size: 13px; color: #94A3B8; margin-top: 4px; }
          .error-card { background: #1F1318; border: 1px solid #E11D48; border-radius: 10px; padding: 18px; margin-bottom: 24px; }
          .error-card h3 { color: #FDA4AF; font-size: 14px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
          pre { background: #090D18; color: #FB7185; padding: 14px; border-radius: 6px; font-size: 12px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; border: 1px solid #334155; }
          .step-card { background: #131C31; border: 1px solid #334155; border-radius: 10px; padding: 20px; margin-bottom: 16px; }
          .step-card h4 { color: #38BDF8; font-size: 15px; margin-bottom: 8px; }
          .step-card p { font-size: 13px; color: #94A3B8; margin-bottom: 12px; }
          .cmd-box { background: #050811; border: 1px solid #0284C7; border-radius: 8px; padding: 12px 16px; font-family: monospace; font-size: 12px; color: #7DD3FC; word-break: break-all; user-select: all; }
          .btn { display: inline-block; background: #0284C7; color: white; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 13px; margin-top: 10px; cursor: pointer; border: none; }
          .btn:hover { background: #0369A1; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div>
              <div style="display:flex;align-items:center;gap:10px;">
                <h1>⚓ TMTRAC Setup Assistant</h1>
                <span class="badge">tmtrac.my</span>
              </div>
              <p class="desc">Location: /home/tmtecq00/public_html/tmtrac.my</p>
            </div>
          </div>

          <div class="error-card">
            <h3>⚠️ Startup Notice (503 Avoided)</h3>
            <p style="font-size:12px;color:#FDA4AF;margin-bottom:8px;">
              The Node.js server started on Passenger, but paused because production dependencies need to be installed.
            </p>
            <pre>${errString}</pre>
          </div>

          <div class="step-card">
            <h4>👉 Step 1: Run NPM Install in cPanel</h4>
            <p>Go to cPanel &gt; <strong>Setup Node.js App</strong> and click <strong>"Run NPM Install"</strong>.</p>
            <p>Or open cPanel <strong>Terminal</strong> and run this single command:</p>
            <div class="cmd-box">source /home/tmtecq00/nodevenv/public_html/tmtrac.my/20/bin/activate && cd /home/tmtecq00/public_html/tmtrac.my && npm install --omit=dev</div>
          </div>

          <div class="step-card">
            <h4>👉 Step 2: Click Restart</h4>
            <p>In cPanel <strong>Setup Node.js App</strong>, click the orange <strong>"Restart"</strong> button at the top.</p>
            <button class="btn" onclick="window.location.reload()">Reload Page</button>
          </div>
        </div>
      </body>
      </html>
    `);
  });

  bindToPassenger(diagServer, 'Diagnostic Server');
}
