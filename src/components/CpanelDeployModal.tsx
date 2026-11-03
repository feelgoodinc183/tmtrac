import React, { useState } from 'react';
import {
  X,
  Download,
  Server,
  Globe,
  FileArchive,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  Terminal,
  FolderArchive,
  FileCode,
  Layers,
  HelpCircle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Zap,
} from 'lucide-react';

interface CpanelDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CpanelDeployModal: React.FC<CpanelDeployModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'nodejs' | 'update' | 'static' | 'dns'>('nodejs');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0B0F19] border border-cyan-500/30 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl shadow-cyan-950/50 overflow-hidden text-slate-200 font-sans">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#0F172A] via-[#111827] to-[#0A192F] border-b border-cyan-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-xs">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white tracking-wide font-mono">
                  cPanel Deployment Center
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  tmtrac.my
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono text-purple-300 bg-purple-500/20 border border-purple-500/30">
                  Exabytes Shared Hosting
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Server path: <span className="text-cyan-300">/home/tmtecq00/public_html/tmtrac.my</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Download Action Cards */}
        <div className="p-6 bg-[#0E1526]/60 border-b border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
          {/* Package 1: Full-Stack */}
          <div className="p-3.5 rounded-xl border border-cyan-500/40 bg-gradient-to-br from-cyan-950/30 via-[#101b33] to-[#0c1322] relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300">
                    <FileArchive className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xs">Full-Stack cPanel ZIP</h3>
                    <p className="text-[10px] text-slate-400 font-mono">tmtrac-cpanel-deployment.zip</p>
                  </div>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  Initial Setup
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
                Complete package with <code className="text-cyan-300 font-mono">app.js</code>, compiled <code className="text-cyan-300 font-mono">dist/</code>, and <code className="text-cyan-300 font-mono">package.json</code> for first installation.
              </p>
            </div>

            <a
              href="/tmtrac-cpanel-deployment.zip"
              download="tmtrac-cpanel-deployment.zip"
              className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-900/30 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Full Setup
            </a>
          </div>

          {/* Package 2: Fast Update Only */}
          <div className="p-3.5 rounded-xl border border-emerald-500/50 bg-gradient-to-br from-emerald-950/30 via-[#0e201b] to-[#091512] relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xs">Quick Update ZIP</h3>
                    <p className="text-[10px] text-slate-400 font-mono">tmtrac-update-only.zip</p>
                  </div>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 font-semibold animate-pulse">
                  60-Sec Sync
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
                Overwrites only <code className="text-emerald-300 font-mono">dist/</code> and <code className="text-emerald-300 font-mono">app.js</code>. No need to run NPM install again!
              </p>
            </div>

            <a
              href="/tmtrac-update-only.zip"
              download="tmtrac-update-only.zip"
              className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Fast Update
            </a>
          </div>

          {/* Package 3: Static public_html */}
          <div className="p-3.5 rounded-xl border border-slate-700/80 bg-gradient-to-br from-[#12192b] to-[#0d1322] relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300">
                    <FolderArchive className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xs">Static public_html</h3>
                    <p className="text-[10px] text-slate-400 font-mono">tmtrac-public_html.zip</p>
                  </div>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                  No Node.js
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
                Direct static upload for standard shared hosting <code className="text-amber-300 font-mono">public_html</code> with Apache rewrite rules.
              </p>
            </div>

            <a
              href="/tmtrac-public_html.zip"
              download="tmtrac-public_html.zip"
              className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 hover:text-white font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download static ZIP
            </a>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 bg-[#0B101E] border-b border-slate-800 flex gap-2 pt-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('nodejs')}
            className={`pb-2.5 px-3 font-mono text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'nodejs'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Step 1: Setup Node.js App
          </button>
          <button
            onClick={() => setActiveTab('update')}
            className={`pb-2.5 px-3 font-mono text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'update'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            🔄 How to Upload Updates (60-Sec)
          </button>
          <button
            onClick={() => setActiveTab('static')}
            className={`pb-2.5 px-3 font-mono text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'static'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            Static public_html
          </button>
          <button
            onClick={() => setActiveTab('dns')}
            className={`pb-2.5 px-3 font-mono text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'dns'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Domain &amp; SSL (tmtrac.my)
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto space-y-6">
          {activeTab === 'nodejs' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-cyan-950/20 border border-cyan-800/40 rounded-xl p-4 text-xs text-slate-300 leading-relaxed">
                <span className="font-bold text-cyan-300 font-mono">🌟 Full Real-Time Capabilities: </span>
                This method enables central live WebSocket telemetry broadcasting, race room PIN locks, automated LoRa MQTT broker sync, and persistent state across all race committee skippers and spectator viewers.
              </div>

              {/* Step 1 */}
              <div className="border border-slate-800 rounded-xl p-4 bg-[#0d1424]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold text-xs flex items-center justify-center">1</span>
                  <h4 className="font-bold text-sm text-white font-mono">Create the Node.js App in Exabytes cPanel</h4>
                </div>
                <p className="text-xs text-slate-400 mb-3 ml-8">
                  In Exabytes cPanel, click <strong>Setup Node.js App</strong> (under Software) and click <strong>Create Application</strong> with these settings:
                </p>
                <div className="ml-8 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center">
                    <span className="text-slate-400">Node.js Version:</span>
                    <span className="text-cyan-300 font-bold">20.x or 18.x</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center">
                    <span className="text-slate-400">Application Mode:</span>
                    <span className="text-cyan-300 font-bold">Production</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center">
                    <span className="text-slate-400">Application Root:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-bold">public_html/tmtrac.my</span>
                      <button
                        onClick={() => handleCopy('root', 'public_html/tmtrac.my')}
                        className="text-slate-400 hover:text-cyan-300 p-0.5"
                      >
                        {copiedKey === 'root' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center">
                    <span className="text-slate-400">Application URL:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-bold">tmtrac.my</span>
                      <button
                        onClick={() => handleCopy('url', 'tmtrac.my')}
                        className="text-slate-400 hover:text-cyan-300 p-0.5"
                      >
                        {copiedKey === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center md:col-span-2">
                    <span className="text-slate-400">Application Startup File:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-400 font-bold">app.js</span>
                      <button
                        onClick={() => handleCopy('startup', 'app.js')}
                        className="text-slate-400 hover:text-cyan-300 p-0.5"
                      >
                        {copiedKey === 'startup' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Exabytes Terminal One-Liner */}
                <div className="mt-3 ml-8 p-3 rounded-lg bg-slate-950 border border-purple-900/40 text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-mono text-purple-300 font-semibold flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5" />
                      Exabytes cPanel Terminal 1-Liner (Activate virtualenv &amp; Install):
                    </span>
                    <button
                      onClick={() => handleCopy('terminal_cmd', 'source /home/tmtecq00/nodevenv/public_html/tmtrac.my/20/bin/activate && cd /home/tmtecq00/public_html/tmtrac.my && npm install --omit=dev')}
                      className="text-cyan-300 hover:text-white flex items-center gap-1 font-mono text-[11px]"
                    >
                      {copiedKey === 'terminal_cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      Copy Command
                    </button>
                  </div>
                  <code className="text-slate-300 text-[11px] font-mono block overflow-x-auto bg-black/40 p-2 rounded">
                    source /home/tmtecq00/nodevenv/public_html/tmtrac.my/20/bin/activate &amp;&amp; cd /home/tmtecq00/public_html/tmtrac.my &amp;&amp; npm install --omit=dev
                  </code>
                </div>
              </div>

              {/* Step 2 */}
              <div className="border border-slate-800 rounded-xl p-4 bg-[#0d1424]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold text-xs flex items-center justify-center">2</span>
                  <h4 className="font-bold text-sm text-white font-mono">Upload &amp; Extract the ZIP</h4>
                </div>
                <div className="text-xs text-slate-300 ml-8 space-y-2">
                  <p>1. Open <strong>File Manager</strong> in cPanel and navigate to: <code className="text-cyan-300 font-mono font-bold">/home/tmtecq00/public_html/tmtrac.my/</code>.</p>
                  <p>2. Upload <code className="text-cyan-300 font-bold">tmtrac-cpanel-deployment.zip</code> and click <strong>Extract</strong>.</p>
                  <p>3. Confirm that <code className="text-white">app.js</code>, <code className="text-white">package.json</code>, <code className="text-white">.htaccess</code>, and the <code className="text-white">dist/</code> folder are extracted directly into <code className="text-slate-300">/home/tmtecq00/public_html/tmtrac.my/</code>.</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="border border-slate-800 rounded-xl p-4 bg-[#0d1424]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold text-xs flex items-center justify-center">3</span>
                  <h4 className="font-bold text-sm text-white font-mono">Run NPM Install &amp; Restart</h4>
                </div>
                <div className="text-xs text-slate-300 ml-8 space-y-2">
                  <p>1. Go back to cPanel &gt; <strong>Setup Node.js App</strong>.</p>
                  <p>2. Click the <strong>Run NPM Install</strong> button (or run the Terminal command above).</p>
                  <p>3. Click the orange <strong>Restart</strong> button at the top.</p>
                  <p>4. Done! Visit <a href="https://tmtrac.my" target="_blank" rel="noreferrer" className="text-cyan-400 underline font-bold">https://tmtrac.my</a>.</p>
                </div>
              </div>

              {/* Troubleshooting Card for Error 503, NPM Install, and Startup */}
              <div className="border border-rose-600/40 bg-rose-950/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2 text-rose-300 font-bold text-xs font-mono">
                  <HelpCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>Troubleshooting: Getting "Error 503 Service Unavailable"?</span>
                </div>
                <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                  <p>
                    <strong>Why Error 503 occurs in cPanel:</strong> In Phusion Passenger, a 503 error means the Node.js process halted on startup because <strong>Run NPM Install</strong> has not been executed yet in the application directory.
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 text-slate-300 text-[11px]">
                    <li><strong>1-Minute Fix:</strong> Open cPanel &gt; <strong>Setup Node.js App</strong>, select <code className="text-cyan-300 font-mono">tmtrac.my</code>, and click the <strong>"Run NPM Install"</strong> button.</li>
                    <li>
                      <strong>Or run via cPanel Terminal:</strong>
                      <code className="block mt-1 p-2 bg-black/60 text-cyan-300 rounded font-mono text-[10px]">
                        source /home/tmtecq00/nodevenv/public_html/tmtrac.my/20/bin/activate &amp;&amp; cd /home/tmtecq00/public_html/tmtrac.my &amp;&amp; npm install --omit=dev
                      </code>
                    </li>
                    <li><strong>Click Restart:</strong> Once dependencies finish installing, click the orange <strong>"Restart"</strong> button at the top. The 503 error will immediately clear!</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'update' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Highlight summary banner */}
              <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-4 text-xs text-slate-200 leading-relaxed flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm font-mono mb-1">
                    Super Fast Updates (Under 60 Seconds!)
                  </h4>
                  <p className="text-slate-300">
                    Because your Node.js 20 environment and <code className="text-emerald-300 font-mono">node_modules</code> are already installed and configured on your cPanel server, syncing updates is as simple as <strong>Upload &rarr; Extract &rarr; Click Restart</strong>.
                  </p>
                </div>
              </div>

              {/* Step 1: Download Update */}
              <div className="border border-slate-800 rounded-xl p-4 bg-[#0d1424]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs flex items-center justify-center">1</span>
                    <h4 className="font-bold text-sm text-white font-mono">Download the Updated ZIP</h4>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ~350 KB
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3 ml-8">
                  Whenever you ask AI Studio to make changes, a fresh build is automatically prepared. Click below to download:
                </p>
                <div className="ml-8 flex flex-wrap gap-3">
                  <a
                    href="/tmtrac-update-only.zip"
                    download="tmtrac-update-only.zip"
                    className="py-2 px-4 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Download Quick Update ZIP (tmtrac-update-only.zip)
                  </a>
                  <a
                    href="/tmtrac-cpanel-deployment.zip"
                    download="tmtrac-cpanel-deployment.zip"
                    className="py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-mono font-medium flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Download Full ZIP
                  </a>
                </div>
              </div>

              {/* Step 2: Upload & Extract */}
              <div className="border border-slate-800 rounded-xl p-4 bg-[#0d1424]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs flex items-center justify-center">2</span>
                  <h4 className="font-bold text-sm text-white font-mono">Upload &amp; Extract in cPanel File Manager</h4>
                </div>
                <div className="text-xs text-slate-300 ml-8 space-y-2.5">
                  <p>
                    1. Open cPanel &gt; <strong>File Manager</strong> and navigate inside your application folder: <code className="text-cyan-300 font-bold font-mono">/home/tmtecq00/public_html/tmtrac.my/</code>.
                  </p>
                  <p>
                    2. Click <strong>Upload</strong> in the top toolbar and select <code className="text-emerald-300 font-mono font-bold">tmtrac-update-only.zip</code>.
                  </p>
                  <p>
                    3. Right-click the uploaded zip file and click <strong>Extract</strong> &rarr; confirm extraction into the current directory.
                  </p>
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400">
                    <strong className="text-cyan-300">What happens during extraction?</strong> cPanel cleanly replaces the <code className="text-white font-mono">dist/</code> folder and <code className="text-white font-mono">app.js</code> with the newest build. Your <code className="text-emerald-400 font-mono">node_modules/</code> and configuration stay untouched.
                  </div>
                </div>
              </div>

              {/* Step 3: Click Restart */}
              <div className="border border-slate-800 rounded-xl p-4 bg-[#0d1424]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs flex items-center justify-center">3</span>
                  <h4 className="font-bold text-sm text-white font-mono">Restart Phusion Passenger (Crucial!)</h4>
                </div>
                <div className="text-xs text-slate-300 ml-8 space-y-3">
                  <p className="text-amber-300 bg-amber-950/30 border border-amber-500/30 p-2.5 rounded-lg leading-relaxed">
                    <strong>Why restart is required:</strong> Phusion Passenger caches running Node.js processes in server RAM. If you don't restart, Passenger will continue serving old code and old database paths (like legacy <code className="text-rose-300 font-mono">regatta.db</code>) from memory!
                  </p>
                  
                  <div className="space-y-2">
                    <p className="font-semibold text-white">Choose any of these 3 easy ways to restart:</p>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                      <li>
                        <strong>Option A (One-click Web Hit):</strong> Open{' '}
                        <a href="https://tmtrac.my/restart.php" target="_blank" rel="noreferrer" className="text-cyan-400 font-mono underline font-bold">
                          https://tmtrac.my/restart.php
                        </a>{' '}
                        in a browser tab. This instantly signals Passenger to recycle the Node.js process and sanitize any legacy paths.
                      </li>
                      <li>
                        <strong>Option B (cPanel Interface):</strong> Open cPanel &gt; <strong>Setup Node.js App</strong> and click the orange <strong>&quot;Restart&quot;</strong> button.
                      </li>
                      <li>
                        <strong>Option C (Inside TMTRAC UI):</strong> Go to <strong>Super Admin &gt; Troubleshooter</strong> tab and click the red <strong>&quot;Restart Node Server&quot;</strong> button.
                      </li>
                    </ul>
                  </div>

                  <p className="pt-1">
                    Once restarted, refresh <a href="https://tmtrac.my" target="_blank" rel="noreferrer" className="text-emerald-400 font-mono underline font-bold">https://tmtrac.my</a>. Your active runtime database will correctly be <code className="text-cyan-300 font-mono">/home/tmtecq00/public_html/tmtrac.my/data/tmtrac.db</code> and all package &amp; event changes will persist immediately!
                  </p>
                </div>
              </div>

              {/* FAQ / Good to know */}
              <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/50 space-y-3">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs font-mono">
                  <HelpCircle className="w-4 h-4 text-cyan-400" />
                  <span>Frequently Asked Update Questions</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-[#0c1322] border border-slate-800">
                    <h5 className="font-bold text-white mb-1">Do I need to click "Run NPM Install" every time?</h5>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      <strong>No!</strong> 99% of UI, styling, and feature changes only touch the frontend and server bundles inside <code className="text-cyan-300">dist/</code>. You only need to run NPM install if a brand new third-party library is added to <code className="text-cyan-300">package.json</code>.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0c1322] border border-slate-800">
                    <h5 className="font-bold text-white mb-1">Will browser caching prevent users from seeing changes?</h5>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      <strong>No!</strong> Vite builds unique cryptographic content hashes into every file name (e.g. <code className="text-cyan-300">index-b9f2a1.js</code>). Browsers detect the new filename instantly on next visit.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'static' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4 text-xs text-slate-300 leading-relaxed">
                <span className="font-bold text-amber-300 font-mono">⚡ Static Hosting in public_html/tmtrac.my: </span>
                If your cPanel hosting account does not include the Node.js selector, upload this static archive directly to <code className="text-amber-300 font-mono">/home/tmtecq00/public_html/tmtrac.my</code>.
              </div>

              <div className="border border-slate-800 rounded-xl p-4 bg-[#0d1424]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold text-xs flex items-center justify-center">1</span>
                  <h4 className="font-bold text-sm text-white font-mono">Upload to public_html/tmtrac.my</h4>
                </div>
                <div className="text-xs text-slate-300 ml-8 space-y-2">
                  <p>1. Open cPanel <strong>File Manager</strong> and open <code className="text-amber-300 font-mono font-bold">/home/tmtecq00/public_html/tmtrac.my</code>.</p>
                  <p>2. Upload <code className="text-amber-300 font-bold">tmtrac-public_html.zip</code>.</p>
                  <p>3. Right-click the file and click <strong>Extract</strong>.</p>
                  <p>4. Verify that <code className="text-white">index.html</code>, <code className="text-white">.htaccess</code>, and <code className="text-white">assets/</code> are inside <code className="text-amber-300 font-mono">/home/tmtecq00/public_html/tmtrac.my</code>.</p>
                </div>
              </div>

              {/* .htaccess review */}
              <div className="border border-slate-800 rounded-xl p-4 bg-[#0d1424]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    <h4 className="font-bold text-sm text-white font-mono">Included .htaccess for tmtrac.my</h4>
                  </div>
                  <button
                    onClick={() => handleCopy('htaccess', `# TMTRAC SPA Rewrite & HTTPS
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteCond %{HTTPS} off
  RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [L]
</IfModule>`)}
                    className="text-xs text-cyan-300 hover:text-white flex items-center gap-1 font-mono"
                  >
                    {copiedKey === 'htaccess' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy Rules
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-2">
                  Automatically redirects HTTP to HTTPS on <code className="text-slate-300">tmtrac.my</code> and rewrites deep links to <code className="text-slate-300">index.html</code>.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'dns' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border border-slate-800 rounded-xl p-4 bg-[#0d1424]">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-5 h-5 text-cyan-400" />
                  <h4 className="font-bold text-sm text-white font-mono">1. DNS Records for tmtrac.my</h4>
                </div>
                <p className="text-xs text-slate-300 mb-3">
                  At your domain registrar (MYNIC / namecheap / Cloudflare), point your DNS A records to your cPanel server IP:
                </p>
                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-slate-400">Type: </span>
                      <span className="text-cyan-300 font-bold">A Record</span>
                      <span className="text-slate-500 ml-2">Name: </span>
                      <span className="text-white">@ (or tmtrac.my)</span>
                    </div>
                    <span className="text-slate-400 text-[11px]">&rarr; Your cPanel Shared IP</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-slate-400">Type: </span>
                      <span className="text-cyan-300 font-bold">CNAME</span>
                      <span className="text-slate-500 ml-2">Name: </span>
                      <span className="text-white">www</span>
                    </div>
                    <span className="text-slate-400 text-[11px]">&rarr; tmtrac.my</span>
                  </div>
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl p-4 bg-[#0d1424]">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h4 className="font-bold text-sm text-white font-mono">2. Free SSL Certificate (AutoSSL / Let's Encrypt)</h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  In order for browsers to permit Live Geolocation (<code className="text-cyan-300 font-mono">navigator.geolocation</code>) and Web Bluetooth (<code className="text-cyan-300 font-mono">navigator.bluetooth</code> for LoRa radios), HTTPS is required:
                </p>
                <ol className="text-xs text-slate-300 space-y-1.5 ml-4 list-decimal">
                  <li>In cPanel, click <strong>SSL/TLS Status</strong>.</li>
                  <li>Check the checkbox next to <strong>tmtrac.my</strong> and <strong>www.tmtrac.my</strong>.</li>
                  <li>Click <strong>Run AutoSSL</strong>.</li>
                  <li>Within a few minutes, green lock icons will appear and HTTPS will be fully active!</li>
                </ol>
              </div>

              <div className="border border-slate-800 rounded-xl p-4 bg-[#0d1424]">
                <div className="flex items-center gap-2 mb-2">
                  <Terminal className="w-5 h-5 text-purple-400" />
                  <h4 className="font-bold text-sm text-white font-mono">3. Default Administrator Account</h4>
                </div>
                <div className="text-xs font-mono space-y-2 mt-2">
                  <div className="p-2 rounded bg-slate-900 flex justify-between items-center">
                    <span className="text-slate-400">Email:</span>
                    <span className="text-cyan-300 font-bold">irsyadismail@gmail.com</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 flex justify-between items-center">
                    <span className="text-slate-400">Username:</span>
                    <span className="text-cyan-300 font-bold">irsyadismail</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 flex justify-between items-center">
                    <span className="text-slate-400">Password:</span>
                    <span className="text-emerald-400 font-bold">outdoor1122</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#090D18] border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Domain target: <strong className="text-white">tmtrac.my</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
