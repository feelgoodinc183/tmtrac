import React, { useState } from 'react';
import { X, Image as ImageIcon, Sparkles, Upload, RefreshCw, CheckCircle } from 'lucide-react';

interface GeminiImageModalProps {
  onAnalyzeImage: (imageBase64: string, prompt: string, model: string) => Promise<string>;
  onClose: () => void;
}

// Sample preloaded marine photos (SVG Data URLs) for quick testing
const SAMPLE_PHOTOS = [
  {
    id: 'sample-rig',
    name: 'Meshtastic T-Echo Antenna Mounting',
    prompt: 'Analyze this marine LoRa node antenna mounting location for RF clear line of sight, salt spray protection, and structural security on a carbon mast.',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%230A0F1E"/><line x1="200" y1="20" x2="200" y2="280" stroke="%2364748B" stroke-width="8"/><rect x="185" y="60" width="30" height="45" rx="5" fill="%2300D4FF"/><line x1="200" y1="60" x2="200" y2="10" stroke="%2300FF9D" stroke-width="3"/><text x="225" y="85" fill="%2300D4FF" font-family="monospace" font-size="12">T-ECHO NODE</text></svg>',
  },
  {
    id: 'sample-ocs',
    name: 'Start Line OCS Proof Camera',
    prompt: 'Analyze this start line camera frame. Verify if vessel BOREALIS crossed the imaginary line between PIN END and RC VESSEL before 0:00 countdown.',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23050A14"/><line x1="50" y1="150" x2="350" y2="150" stroke="%23FF4D4D" stroke-width="3" stroke-dasharray="8 4"/><circle cx="50" cy="150" r="10" fill="%23FFB800"/><circle cx="350" cy="150" r="12" fill="%2300D4FF"/><path d="M 220 120 L 260 140 L 220 160 Z" fill="%23FF4D4D"/><text x="210" y="105" fill="%23FF4D4D" font-family="sans-serif" font-weight="bold" font-size="12">BOREALIS (OCS)</text></svg>',
  },
  {
    id: 'sample-[#1E293B]',
    name: 'Mainsail Trim & Draft Shape',
    prompt: 'Analyze this mainsail trim photo. Evaluate draft depth, telltail flow, leech tension, and backstay bend for 14 knot upwind sailing.',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23060B16"/><path d="M 100 280 Q 220 150 280 20 L 100 280 Z" fill="%23E0E6ED" opacity="0.8"/><line x1="100" y1="280" x2="280" y2="20" stroke="%2300D4FF" stroke-width="2"/></svg>',
  },
];

export const GeminiImageModal: React.FC<GeminiImageModalProps> = ({
  onAnalyzeImage,
  onClose,
}) => {
  const [selectedImage, setSelectedImage] = useState<string>(SAMPLE_PHOTOS[0].preview);
  const [customPrompt, setCustomPrompt] = useState<string>(SAMPLE_PHOTOS[0].prompt);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.1-pro-preview');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setCustomPrompt('Analyze this image for marine hardware, sailing tactics, or race details.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectSample = (sample: typeof SAMPLE_PHOTOS[0]) => {
    setSelectedImage(sample.preview);
    setCustomPrompt(sample.prompt);
    setAnalysisResult(null);
  };

  const handleAnalyze = async () => {
    if (!selectedImage || isLoading) return;
    setIsLoading(true);
    setAnalysisResult(null);

    try {
      const result = await onAnalyzeImage(selectedImage, customPrompt, selectedModel);
      setAnalysisResult(result);
    } catch (err: any) {
      setAnalysisResult(`Analysis Error: ${err.message || 'Failed to communicate with Gemini API'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#020408]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#0A0F1E] border border-[#1E293B] w-full max-w-2xl h-[650px] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[#E0E6ED]">
        {/* Header */}
        <div className="p-4 bg-[#060B16] border-b border-[#1E293B] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00FF9D]/20 border border-[#00FF9D]/40 flex items-center justify-center text-[#00FF9D]">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                Gemini Vision Photo Intelligence
                <span className="text-[10px] bg-[#00FF9D]/20 text-[#00FF9D] px-2 py-0.5 rounded font-mono border border-[#00FF9D]/30">
                  {selectedModel}
                </span>
              </h2>
              <p className="text-[10px] text-[#64748B] font-mono">
                Multimodal Image Analysis for Hardware & Regattas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 custom-scrollbar">
          {/* Sample selector & Upload button */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-[#64748B] block mb-2">
              Select Sample Marine Image or Upload File
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SAMPLE_PHOTOS.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => handleSelectSample(sample)}
                  className={`p-2 rounded-lg border text-left text-xs font-mono transition-all flex flex-col items-center gap-1 ${
                    selectedImage === sample.preview
                      ? 'bg-[#00D4FF]/20 border-[#00D4FF] text-white'
                      : 'bg-[#060B16] border-[#1E293B] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <img src={sample.preview} alt={sample.name} className="w-full h-16 object-cover rounded" />
                  <span className="text-[9px] font-bold text-center truncate w-full">{sample.name}</span>
                </button>
              ))}
            </div>

            <div className="mt-3">
              <label className="flex items-center justify-center gap-2 p-2.5 border border-dashed border-[#1E293B] hover:border-[#00D4FF] bg-[#060B16] rounded-xl cursor-pointer text-xs font-mono text-[#94A3B8] hover:text-white transition-all">
                <Upload className="w-4 h-4 text-[#00D4FF]" />
                Upload Custom Boat Photo / Camera Frame
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>

          {/* Model Selector & Prompt Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase tracking-widest text-[#64748B]">
                Prompt & Model Selection
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-[#060B16] border border-[#1E293B] rounded px-2 py-0.5 text-[10px] font-mono text-[#00FF9D]"
              >
                <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (High Reasoning)</option>
                <option value="gemini-3.6-flash">gemini-3.6-flash (Fast)</option>
              </select>
            </div>

            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={2}
              className="w-full bg-[#060B16] border border-[#1E293B] rounded-xl p-3 text-xs text-white placeholder-[#64748B] focus:border-[#00FF9D] outline-none font-sans"
              placeholder="Describe what you want Gemini to analyze in this photo..."
            />
          </div>

          {/* Analyze Trigger */}
          <button
            onClick={handleAnalyze}
            disabled={isLoading}
            className="w-full py-3 bg-[#00FF9D] hover:bg-emerald-300 disabled:opacity-40 text-[#020408] font-bold text-xs rounded-xl transition-all shadow-[0_0_12px_#00FF9D] flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing Photo with Gemini Vision...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Analyze Image with Gemini
              </>
            )}
          </button>

          {/* Analysis Result Box */}
          {analysisResult && (
            <div className="p-4 bg-[#060B16] border border-[#00FF9D]/40 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#00FF9D]">
                <CheckCircle className="w-4 h-4" />
                Gemini Vision Analysis
              </div>
              <p className="text-xs text-[#E0E6ED] leading-relaxed whitespace-pre-wrap font-sans">
                {analysisResult}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
