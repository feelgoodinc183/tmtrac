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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-canvas border border-accent/30 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-ink font-sans">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-surface via-surface to-surface border-b border-accent/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/40 flex items-center justify-center text-accent shadow-xs">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-ink">
                  cPanel Deployment Center
                </h2>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-accent/20 text-accent border border-accent/30">
                  tmtrac.my
                </span>
                <span className="px-2 py-0.5 rounded text-xs text-ink bg-raised/20 border border-line/30">
                  Exabytes Shared Hosting
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                Server path: <span className="text-accent">/home/tmtecq00/public_html/tmtrac.my</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-raised/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Download Action Cards */}
        <div className="p-6 bg-surface/60 border-b border-line/80 grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
          {/* Package 1: Full-Stack */}
          <div className="p-3.5 rounded-xl border border-accent/40 bg-gradient-to-br from-surface/30 via-surface to-surface relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-accent/20 text-accent">
                    <FileArchive className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-ink text-xs">Full-Stack cPanel ZIP</h3>
                    <p className="text-xs text-ink-muted">tmtrac-cpanel-deployment.zip</p>
                  </div>
                </div>
                <span className="text-xs px-1.5 py-0.5 rounded bg-success-ink/20 text-success-ink border border-success-ink/30 font-semibold">
                  Initial Setup
                </span>
              </div>
              <p className="text-xs text-ink mb-3 leading-relaxed">
                Complete package with <code className="text-accent">app.js</code>, compiled <code className="text-accent">dist/</code>, and <code className="text-accent">package.json</code> for first installation.
              </p>
            </div>

            <a
              href="/tmtrac-cpanel-deployment.zip"
              download="tmtrac-cpanel-deployment.zip"
              className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-accent to-accent hover:from-accent hover:to-accent text-ink font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Full Setup
            </a>
          </div>

          {/* Package 2: Fast Update Only */}
          <div className="p-3.5 rounded-xl border border-success-ink/50 bg-gradient-to-br from-surface/30 via-surface to-surface relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-success-ink/20 text-success-ink">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-ink text-xs">Quick Update ZIP</h3>
                    <p className="text-xs text-ink-muted">tmtrac-update-only.zip</p>
                  </div>
                </div>
                <span className="text-xs px-1.5 py-0.5 rounded bg-success-ink/30 text-success-ink border border-success-ink/40 font-semibold">
                  60-Sec Sync
                </span>
              </div>
              <p className="text-xs text-ink mb-3 leading-relaxed">
                Overwrites only <code className="text-success-ink">dist/</code> and <code className="text-success-ink">app.js</code>. No need to run NPM install again!
              </p>
            </div>

            <a
              href="/tmtrac-update-only.zip"
              download="tmtrac-update-only.zip"
              className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-success-ink to-accent hover:from-success-ink hover:to-accent text-ink font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Fast Update
            </a>
          </div>

          {/* Package 3: Static public_html */}
          <div className="p-3.5 rounded-xl border border-line/80 bg-gradient-to-br from-surface to-surface relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-warning-ink/20 text-warning-ink">
                    <FolderArchive className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-ink text-xs">Static public_html</h3>
                    <p className="text-xs text-ink-muted">tmtrac-public_html.zip</p>
                  </div>
                </div>
                <span className="text-xs px-1.5 py-0.5 rounded bg-warning-ink/20 text-warning-ink border border-warning-ink/30 font-semibold">
                  No Node.js
                </span>
              </div>
              <p className="text-xs text-ink mb-3 leading-relaxed">
                Direct static upload for standard shared hosting <code className="text-warning-ink">public_html</code> with Apache rewrite rules.
              </p>
            </div>

            <a
              href="/tmtrac-public_html.zip"
              download="tmtrac-public_html.zip"
              className="w-full py-2 px-3 rounded-lg bg-raised hover:bg-raised border border-line text-ink hover:text-ink font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download static ZIP
            </a>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 bg-surface border-b border-line flex gap-2 pt-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('nodejs')}
            className={`pb-2.5 px-3  text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'nodejs'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Step 1: Setup Node.js App
          </button>
          <button
            onClick={() => setActiveTab('update')}
            className={`pb-2.5 px-3  text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'update'
                ? 'border-success-ink text-success-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            How to Upload Updates (60-Sec)
          </button>
          <button
            onClick={() => setActiveTab('static')}
            className={`pb-2.5 px-3  text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'static'
                ? 'border-warning-ink text-warning-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            Static public_html
          </button>
          <button
            onClick={() => setActiveTab('dns')}
            className={`pb-2.5 px-3  text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'dns'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
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
              <div className="bg-surface/20 border border-accent/40 rounded-xl p-4 text-xs text-ink leading-relaxed">
                <span className="font-bold text-accent">Full Real-Time Capabilities: </span>
                This method enables central live WebSocket telemetry broadcasting, race room PIN locks, automated LoRa MQTT broker sync, and persistent state across all race committee skippers and spectator viewers.
              </div>

              {/* Step 1 */}
              <div className="border border-line rounded-xl p-4 bg-surface">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-accent/20 text-accent font-bold text-xs flex items-center justify-center">1</span>
                  <h4 className="font-bold text-sm text-ink">Create the Node.js App in Exabytes cPanel</h4>
                </div>
                <p className="text-xs text-ink-muted mb-3 ml-8">
                  In Exabytes cPanel, click <strong>Setup Node.js App</strong> (under Software) and click <strong>Create Application</strong> with these settings:
                </p>
                <div className="ml-8 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-surface border border-line flex justify-between items-center">
                    <span className="text-ink-muted">Node.js Version:</span>
                    <span className="text-accent font-bold">20.x or 18.x</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface border border-line flex justify-between items-center">
                    <span className="text-ink-muted">Application Mode:</span>
                    <span className="text-accent font-bold">Production</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface border border-line flex justify-between items-center">
                    <span className="text-ink-muted">Application Root:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-ink font-bold">public_html/tmtrac.my</span>
                      <button
                        onClick={() => handleCopy('root', 'public_html/tmtrac.my')}
                        className="text-ink-muted hover:text-accent p-0.5"
                      >
                        {copiedKey === 'root' ? <Check className="w-3.5 h-3.5 text-success-ink" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface border border-line flex justify-between items-center">
                    <span className="text-ink-muted">Application URL:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-ink font-bold">tmtrac.my</span>
                      <button
                        onClick={() => handleCopy('url', 'tmtrac.my')}
                        className="text-ink-muted hover:text-accent p-0.5"
                      >
                        {copiedKey === 'url' ? <Check className="w-3.5 h-3.5 text-success-ink" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface border border-line flex justify-between items-center md:col-span-2">
                    <span className="text-ink-muted">Application Startup File:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-success-ink font-bold">app.js</span>
                      <button
                        onClick={() => handleCopy('startup', 'app.js')}
                        className="text-ink-muted hover:text-accent p-0.5"
                      >
                        {copiedKey === 'startup' ? <Check className="w-3.5 h-3.5 text-success-ink" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Exabytes Terminal One-Liner */}
                <div className="mt-3 ml-8 p-3 rounded-lg bg-canvas border border-line/40 text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-ink font-semibold flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5" />
                      Exabytes cPanel Terminal 1-Liner (Activate virtualenv &amp; Install):
                    </span>
                    <button
                      onClick={() => handleCopy('terminal_cmd', 'source /home/tmtecq00/nodevenv/public_html/tmtrac.my/20/bin/activate && cd /home/tmtecq00/public_html/tmtrac.my && npm install --omit=dev')}
                      className="text-accent hover:text-ink flex items-center gap-1 text-xs"
                    >
                      {copiedKey === 'terminal_cmd' ? <Check className="w-3 h-3 text-success-ink" /> : <Copy className="w-3 h-3" />}
                      Copy Command
                    </button>
                  </div>
                  <code className="text-ink text-xs block overflow-x-auto bg-canvas/40 p-2 rounded">
                    source /home/tmtecq00/nodevenv/public_html/tmtrac.my/20/bin/activate &amp;&amp; cd /home/tmtecq00/public_html/tmtrac.my &amp;&amp; npm install --omit=dev
                  </code>
                </div>
              </div>

              {/* Step 2 */}
              <div className="border border-line rounded-xl p-4 bg-surface">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-accent/20 text-accent font-bold text-xs flex items-center justify-center">2</span>
                  <h4 className="font-bold text-sm text-ink">Upload &amp; Extract the ZIP</h4>
                </div>
                <div className="text-xs text-ink ml-8 space-y-2">
                  <p>1. Open <strong>File Manager</strong> in cPanel and navigate to: <code className="text-accent font-bold">/home/tmtecq00/public_html/tmtrac.my/</code>.</p>
                  <p>2. Upload <code className="text-accent font-bold">tmtrac-cpanel-deployment.zip</code> and click <strong>Extract</strong>.</p>
                  <p>3. Confirm that <code className="text-ink">app.js</code>, <code className="text-ink">package.json</code>, <code className="text-ink">.htaccess</code>, and the <code className="text-ink">dist/</code> folder are extracted directly into <code className="text-ink">/home/tmtecq00/public_html/tmtrac.my/</code>.</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="border border-line rounded-xl p-4 bg-surface">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-accent/20 text-accent font-bold text-xs flex items-center justify-center">3</span>
                  <h4 className="font-bold text-sm text-ink">Run NPM Install &amp; Restart</h4>
                </div>
                <div className="text-xs text-ink ml-8 space-y-2">
                  <p>1. Go back to cPanel &gt; <strong>Setup Node.js App</strong>.</p>
                  <p>2. Click the <strong>Run NPM Install</strong> button (or run the Terminal command above).</p>
                  <p>3. Click the orange <strong>Restart</strong> button at the top.</p>
                  <p>4. Done! Visit <a href="https://tmtrac.my" target="_blank" rel="noreferrer" className="text-accent underline font-bold">https://tmtrac.my</a>.</p>
                </div>
              </div>

              {/* Troubleshooting Card for Error 503, NPM Install, and Startup */}
              <div className="border border-danger-ink/40 bg-surface/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2 text-danger-ink font-bold text-xs">
                  <HelpCircle className="w-4 h-4 shrink-0 text-danger-ink" />
                  <span>Troubleshooting: Getting "Error 503 Service Unavailable"?</span>
                </div>
                <div className="text-xs text-ink space-y-2 leading-relaxed">
                  <p>
                    <strong>Why Error 503 occurs in cPanel:</strong> In Phusion Passenger, a 503 error means the Node.js process halted on startup because <strong>Run NPM Install</strong> has not been executed yet in the application directory.
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 text-ink text-xs">
                    <li><strong>1-Minute Fix:</strong> Open cPanel &gt; <strong>Setup Node.js App</strong>, select <code className="text-accent">tmtrac.my</code>, and click the <strong>"Run NPM Install"</strong> button.</li>
                    <li>
                      <strong>Or run via cPanel Terminal:</strong>
                      <code className="block mt-1 p-2 bg-canvas/60 text-accent rounded text-xs">
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
              <div className="bg-surface/30 border border-success-ink/40 rounded-xl p-4 text-xs text-ink leading-relaxed flex items-start gap-3">
                <div className="p-2 rounded-lg bg-success-ink/20 text-success-ink shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-ink text-sm mb-1">
                    Super Fast Updates (Under 60 Seconds!)
                  </h4>
                  <p className="text-ink">
                    Because your Node.js 20 environment and <code className="text-success-ink">node_modules</code> are already installed and configured on your cPanel server, syncing updates is as simple as <strong>Upload &rarr; Extract &rarr; Click Restart</strong>.
                  </p>
                </div>
              </div>

              {/* Step 1: Download Update */}
              <div className="border border-line rounded-xl p-4 bg-surface">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-success-ink/20 text-success-ink font-bold text-xs flex items-center justify-center">1</span>
                    <h4 className="font-bold text-sm text-ink">Download the Updated ZIP</h4>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-success-ink/20 text-success-ink border border-success-ink/30">
                    ~350 KB
                  </span>
                </div>
                <p className="text-xs text-ink-muted mb-3 ml-8">
                  Whenever you ask AI Studio to make changes, a fresh build is automatically prepared. Click below to download:
                </p>
                <div className="ml-8 flex flex-wrap gap-3">
                  <a
                    href="/tmtrac-update-only.zip"
                    download="tmtrac-update-only.zip"
                    className="py-2 px-4 rounded-lg bg-gradient-to-r from-success-ink to-accent hover:from-success-ink hover:to-accent text-ink font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Download Quick Update ZIP (tmtrac-update-only.zip)
                  </a>
                  <a
                    href="/tmtrac-cpanel-deployment.zip"
                    download="tmtrac-cpanel-deployment.zip"
                    className="py-2 px-4 rounded-lg bg-raised hover:bg-raised border border-line text-ink text-xs font-medium flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Download Full ZIP
                  </a>
                </div>
              </div>

              {/* Step 2: Upload & Extract */}
              <div className="border border-line rounded-xl p-4 bg-surface">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-success-ink/20 text-success-ink font-bold text-xs flex items-center justify-center">2</span>
                  <h4 className="font-bold text-sm text-ink">Upload &amp; Extract in cPanel File Manager</h4>
                </div>
                <div className="text-xs text-ink ml-8 space-y-2.5">
                  <p>
                    1. Open cPanel &gt; <strong>File Manager</strong> and navigate inside your application folder: <code className="text-accent font-bold">/home/tmtecq00/public_html/tmtrac.my/</code>.
                  </p>
                  <p>
                    2. Click <strong>Upload</strong> in the top toolbar and select <code className="text-success-ink font-bold">tmtrac-update-only.zip</code>.
                  </p>
                  <p>
                    3. Right-click the uploaded zip file and click <strong>Extract</strong> &rarr; confirm extraction into the current directory.
                  </p>
                  <div className="p-2.5 rounded-lg bg-surface/90 border border-line text-xs text-ink-muted">
                    <strong className="text-accent">What happens during extraction?</strong> cPanel cleanly replaces the <code className="text-ink">dist/</code> folder and <code className="text-ink">app.js</code> with the newest build. Your <code className="text-success-ink">node_modules/</code> and configuration stay untouched.
                  </div>
                </div>
              </div>

              {/* Step 3: Click Restart */}
              <div className="border border-line rounded-xl p-4 bg-surface">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-success-ink/20 text-success-ink font-bold text-xs flex items-center justify-center">3</span>
                  <h4 className="font-bold text-sm text-ink">Restart Phusion Passenger (Crucial!)</h4>
                </div>
                <div className="text-xs text-ink ml-8 space-y-3">
                  <p className="text-warning-ink bg-surface/30 border border-warning-ink/30 p-2.5 rounded-lg leading-relaxed">
                    <strong>Why restart is required:</strong> Phusion Passenger caches running Node.js processes in server RAM. If you don't restart, Passenger will continue serving old code and old database paths (like legacy <code className="text-danger-ink">regatta.db</code>) from memory!
                  </p>
                  
                  <div className="space-y-2">
                    <p className="font-semibold text-ink">Choose either way to restart:</p>
                    <ul className="list-disc pl-5 space-y-1.5 text-ink">
                      <li>
                        <strong>Option A (cPanel Interface):</strong> Open cPanel &gt; <strong>Setup Node.js App</strong> and click the orange <strong>&quot;Restart&quot;</strong> button.
                      </li>
                      <li>
                        <strong>Option B (Inside TMTRAC UI):</strong> Go to <strong>Super Admin &gt; Troubleshooter</strong> tab and click the red <strong>&quot;Restart Node Server&quot;</strong> button.
                      </li>
                    </ul>
                  </div>

                  <p className="pt-1">
                    Once restarted, refresh <a href="https://tmtrac.my" target="_blank" rel="noreferrer" className="text-success-ink underline font-bold">https://tmtrac.my</a>. Your active runtime database will correctly be <code className="text-accent">/home/tmtecq00/public_html/tmtrac.my/data/tmtrac.db</code> and all package &amp; event changes will persist immediately!
                  </p>
                </div>
              </div>

              {/* FAQ / Good to know */}
              <div className="border border-line rounded-xl p-4 bg-surface/50 space-y-3">
                <div className="flex items-center gap-2 text-accent font-bold text-xs">
                  <HelpCircle className="w-4 h-4 text-accent" />
                  <span>Frequently Asked Update Questions</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-surface border border-line">
                    <h5 className="font-bold text-ink mb-1">Do I need to click "Run NPM Install" every time?</h5>
                    <p className="text-ink-muted text-xs leading-relaxed">
                      <strong>No!</strong> 99% of UI, styling, and feature changes only touch the frontend and server bundles inside <code className="text-accent">dist/</code>. You only need to run NPM install if a brand new third-party library is added to <code className="text-accent">package.json</code>.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface border border-line">
                    <h5 className="font-bold text-ink mb-1">Will browser caching prevent users from seeing changes?</h5>
                    <p className="text-ink-muted text-xs leading-relaxed">
                      <strong>No!</strong> Vite builds unique cryptographic content hashes into every file name (e.g. <code className="text-accent">index-b9f2a1.js</code>). Browsers detect the new filename instantly on next visit.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'static' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-surface/20 border border-warning-ink/40 rounded-xl p-4 text-xs text-ink leading-relaxed">
                <span className="font-bold text-warning-ink">Static Hosting in public_html/tmtrac.my: </span>
                If your cPanel hosting account does not include the Node.js selector, upload this static archive directly to <code className="text-warning-ink">/home/tmtecq00/public_html/tmtrac.my</code>.
              </div>

              <div className="border border-line rounded-xl p-4 bg-surface">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-warning-ink/20 text-warning-ink font-bold text-xs flex items-center justify-center">1</span>
                  <h4 className="font-bold text-sm text-ink">Upload to public_html/tmtrac.my</h4>
                </div>
                <div className="text-xs text-ink ml-8 space-y-2">
                  <p>1. Open cPanel <strong>File Manager</strong> and open <code className="text-warning-ink font-bold">/home/tmtecq00/public_html/tmtrac.my</code>.</p>
                  <p>2. Upload <code className="text-warning-ink font-bold">tmtrac-public_html.zip</code>.</p>
                  <p>3. Right-click the file and click <strong>Extract</strong>.</p>
                  <p>4. Verify that <code className="text-ink">index.html</code>, <code className="text-ink">.htaccess</code>, and <code className="text-ink">assets/</code> are inside <code className="text-warning-ink">/home/tmtecq00/public_html/tmtrac.my</code>.</p>
                </div>
              </div>

              {/* .htaccess review */}
              <div className="border border-line rounded-xl p-4 bg-surface">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-accent" />
                    <h4 className="font-bold text-sm text-ink">Included .htaccess for tmtrac.my</h4>
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
                    className="text-xs text-accent hover:text-ink flex items-center gap-1"
                  >
                    {copiedKey === 'htaccess' ? <Check className="w-3.5 h-3.5 text-success-ink" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy Rules
                  </button>
                </div>
                <p className="text-xs text-ink-muted mb-2">
                  Automatically redirects HTTP to HTTPS on <code className="text-ink">tmtrac.my</code> and rewrites deep links to <code className="text-ink">index.html</code>.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'dns' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border border-line rounded-xl p-4 bg-surface">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-5 h-5 text-accent" />
                  <h4 className="font-bold text-sm text-ink">1. DNS Records for tmtrac.my</h4>
                </div>
                <p className="text-xs text-ink mb-3">
                  At your domain registrar (MYNIC / namecheap / Cloudflare), point your DNS A records to your cPanel server IP:
                </p>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-surface border border-line flex justify-between items-center">
                    <div>
                      <span className="text-ink-muted">Type: </span>
                      <span className="text-accent font-bold">A Record</span>
                      <span className="text-ink-muted ml-2">Name: </span>
                      <span className="text-ink">@ (or tmtrac.my)</span>
                    </div>
                    <span className="text-ink-muted text-xs">&rarr; Your cPanel Shared IP</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface border border-line flex justify-between items-center">
                    <div>
                      <span className="text-ink-muted">Type: </span>
                      <span className="text-accent font-bold">CNAME</span>
                      <span className="text-ink-muted ml-2">Name: </span>
                      <span className="text-ink">www</span>
                    </div>
                    <span className="text-ink-muted text-xs">&rarr; tmtrac.my</span>
                  </div>
                </div>
              </div>

              <div className="border border-line rounded-xl p-4 bg-surface">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-5 h-5 text-success-ink" />
                  <h4 className="font-bold text-sm text-ink">2. Free SSL Certificate (AutoSSL / Let's Encrypt)</h4>
                </div>
                <p className="text-xs text-ink leading-relaxed mb-3">
                  In order for browsers to permit Live Geolocation (<code className="text-accent">navigator.geolocation</code>) and Web Bluetooth (<code className="text-accent">navigator.bluetooth</code> for LoRa radios), HTTPS is required:
                </p>
                <ol className="text-xs text-ink space-y-1.5 ml-4 list-decimal">
                  <li>In cPanel, click <strong>SSL/TLS Status</strong>.</li>
                  <li>Check the checkbox next to <strong>tmtrac.my</strong> and <strong>www.tmtrac.my</strong>.</li>
                  <li>Click <strong>Run AutoSSL</strong>.</li>
                  <li>Within a few minutes, green lock icons will appear and HTTPS will be fully active!</li>
                </ol>
              </div>

              <div className="border border-line rounded-xl p-4 bg-surface">
                <div className="flex items-center gap-2 mb-2">
                  <Terminal className="w-5 h-5 text-ink-muted" />
                  <h4 className="font-bold text-sm text-ink">3. Default Administrator Account</h4>
                </div>
                <div className="text-xs space-y-2 mt-2">
                  <div className="p-2 rounded bg-surface flex justify-between items-center">
                    <span className="text-ink-muted">Email:</span>
                    <span className="text-accent font-bold">irsyadismail@gmail.com</span>
                  </div>
                  <div className="p-2 rounded bg-surface flex justify-between items-center">
                    <span className="text-ink-muted">Username:</span>
                    <span className="text-accent font-bold">irsyadismail</span>
                  </div>
                  <div className="p-2 rounded bg-surface flex justify-between items-center">
                    <span className="text-ink-muted">Password:</span>
                    <span className="text-success-ink font-bold">SUPER_ADMIN_PASSWORD (set in cPanel before first start)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-canvas border-t border-line/80 flex items-center justify-between text-xs text-ink-muted shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success-ink"></span>
            <span>Domain target: <strong className="text-ink">tmtrac.my</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-raised hover:bg-raised text-ink font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
