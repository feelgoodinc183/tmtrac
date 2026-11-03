import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// One version number for the whole app, taken from package.json.
const appVersion: string = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')).version;
import { defineConfig, Plugin } from 'vite';
import { GoogleGenAI } from '@google/genai';

function geminiApiPlugin(): Plugin {
  return {
    name: 'gemini-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();

        if (req.url === '/api/gemini/chat' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { messages, context } = JSON.parse(body || '{}');
              const apiKey = process.env.GEMINI_API_KEY;

              if (!apiKey) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'GEMINI_API_KEY environment variable is not configured.' }));
                return;
              }

              const ai = new GoogleGenAI({
                apiKey,
                httpOptions: {
                  headers: {
                    'User-Agent': 'aistudio-build',
                  },
                },
              });

              const systemInstruction = `You are MERCURY Tactician AI, an expert marine sailing tactician, World Sailing RRS race officer, and Meshtastic LoRa mesh network engineer.
You are assisting the Race Committee or vessel skippers during a live regatta.
Context about current race:
- Location: ${context?.locationName || 'Solent / Lismore Regatta'}
- Wind: ${context?.windSpeedKt || 14.2} knots at ${context?.windDirectionDeg || 210}° SW
- Status: ${context?.status || 'COUNTDOWN'} (${context?.countdownFormatted || '02:44'})
- Active Leader: ${context?.leaderName || 'WIND RUNNER (IRC 1.042)'}
- Mesh Load: ${context?.airtimePercent || 14}% airtime (${context?.telemetryRate || 'HIGH 10s'})

Provide concise, sharp, professional sailing tactics, handicap strategy (IRC/ORC/PY), or LoRa mesh troubleshooting (SNR, battery, hop optimization).`;

              const promptText = messages.map((m: any) => `${m.sender.toUpperCase()}: ${m.text}`).join('\n');

              const response = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: promptText,
                config: {
                  systemInstruction,
                  temperature: 0.7,
                },
              });

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ text: response.text }));
            } catch (err: any) {
              console.error('Gemini Chat API Error:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Failed to process Gemini request' }));
            }
          });
          return;
        }

        if (req.url === '/api/gemini/analyze-image' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { imageBase64, mimeType, prompt, model } = JSON.parse(body || '{}');
              const apiKey = process.env.GEMINI_API_KEY;

              if (!apiKey) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'GEMINI_API_KEY environment variable is not configured.' }));
                return;
              }

              const ai = new GoogleGenAI({
                apiKey,
                httpOptions: {
                  headers: {
                    'User-Agent': 'aistudio-build',
                  },
                },
              });

              const selectedModel = model || 'gemini-3.1-pro-preview';

              const imagePart = {
                inlineData: {
                  data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
                  mimeType: mimeType || 'image/jpeg',
                },
              };

              const textPart = {
                text: prompt || 'Analyze this sailing / marine hardware photo for race tactics, sail trim, start line OCS proof, or Meshtastic node mounting setup.',
              };

              const response = await ai.models.generateContent({
                model: selectedModel,
                contents: { parts: [imagePart, textPart] },
              });

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ text: response.text }));
            } catch (err: any) {
              console.error('Gemini Image API Error:', err);
              try {
                const ai = new GoogleGenAI({
                  apiKey: process.env.GEMINI_API_KEY,
                  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
                });
                const response = await ai.models.generateContent({
                  model: 'gemini-3.6-flash',
                  contents: {
                    parts: [
                      { inlineData: { data: JSON.parse(body || '{}').imageBase64.replace(/^data:image\/\w+;base64,/, ''), mimeType: 'image/jpeg' } },
                      { text: 'Analyze this marine photo in detail.' }
                    ]
                  },
                });
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ text: response.text }));
              } catch (fallbackErr: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Image analysis failed' }));
              }
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), geminiApiPlugin()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
