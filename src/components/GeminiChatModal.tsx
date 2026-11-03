import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, RaceState, Boat } from '../types/regatta';
import { X, Bot, Send, Sparkles, User, RefreshCw } from 'lucide-react';

interface GeminiChatModalProps {
  messages: ChatMessage[];
  raceState: RaceState;
  boats: Boat[];
  onSendMessage: (text: string) => Promise<void>;
  onClose: () => void;
}

export const GeminiChatModal: React.FC<GeminiChatModalProps> = ({
  messages,
  raceState,
  boats,
  onSendMessage,
  onClose,
}) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const textToSend = inputText;
    setInputText('');
    setIsLoading(true);

    try {
      await onSendMessage(textToSend);
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (promptText: string) => {
    setInputText(promptText);
  };

  return (
    <div className="fixed inset-0 z-50 bg-lb-020408/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-lb-0a0f1e border border-ll-1e293b w-full max-w-xl h-[600px] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-lt-e0e6ed">
        {/* Header */}
        <div className="p-4 bg-lb-060b16 border-b border-ll-1e293b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-lb-00d4ff/20 border border-ll-00d4ff/40 flex items-center justify-center text-lt-00d4ff">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-lt-white flex items-center gap-2">
                TMTRAC Tactician AI
                <span className="text-xs bg-lb-00d4ff/20 text-lt-00d4ff px-2 py-0.5 rounded font-mono border border-ll-00d4ff/30">
                  Gemini 3.6 Flash
                </span>
              </h2>
              <p className="text-xs text-lt-64748b font-mono">
                Sailing Tactics & Meshtastic Network Assistant
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-lt-64748b hover:text-lt-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-lb-060b16/50 border-b border-ll-1e293b flex gap-2 overflow-x-auto shrink-0 scrollbar-none">
          <button
            onClick={() => handleQuickPrompt("Analyze Wind Runner's VMG & tactic")}
            className="text-xs font-mono whitespace-nowrap bg-lb-1e293b hover:bg-lb-00d4ff/20 text-lt-00d4ff px-2.5 py-1 rounded-full border border-ll-00d4ff/30 transition-all"
          >
            ⛵ Wind Runner VMG
          </button>
          <button
            onClick={() => handleQuickPrompt('How do I fix LoRa mesh negative SNR?')}
            className="text-xs font-mono whitespace-nowrap bg-lb-1e293b hover:bg-lb-00ff9d/20 text-lt-00ff9d px-2.5 py-1 rounded-full border border-ll-00ff9d/30 transition-all"
          >
            📡 Fix LoRa SNR
          </button>
          <button
            onClick={() => handleQuickPrompt('Explain IRC vs ORC corrected time math')}
            className="text-xs font-mono whitespace-nowrap bg-lb-1e293b hover:bg-lb-ffb800/20 text-lt-ffb800 px-2.5 py-1 rounded-full border border-ll-ffb800/30 transition-all"
          >
            ⏱️ IRC vs ORC Math
          </button>
        </div>

        {/* Messages Thread */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-lt-64748b">
              <Sparkles className="w-8 h-8 text-lt-00d4ff mb-2 animate-pulse" />
              <p className="text-xs font-mono mb-1 text-lt-white">Ask Tactician AI Anything</p>
              <p className="text-xs">
                Get real-time sailing tactical guidance, World Sailing RRS rule clarifications, or Meshtastic LoRa node troubleshooting.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-lb-00d4ff/20 border border-ll-00d4ff/40 flex items-center justify-center text-lt-00d4ff shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-xl p-3 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-lb-00d4ff text-lt-020408 font-medium rounded-tr-none shadow-[0_0_12px_rgba(0,212,255,0.3)]'
                      : 'bg-lb-060b16 border border-ll-1e293b text-lt-e0e6ed rounded-tl-none whitespace-pre-wrap'
                  }`}
                >
                  {msg.text}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-lb-1e293b flex items-center justify-center text-lt-94a3b8 shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex gap-3 items-center text-xs text-lt-00d4ff font-mono">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Tactician AI is thinking...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="p-3 bg-lb-060b16 border-t border-ll-1e293b flex gap-2 items-center shrink-0"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask about race tactics, IRC ratings, or Meshtastic nodes..."
            className="flex-1 bg-lb-0a0f1e border border-ll-1e293b rounded-xl px-4 py-2.5 text-xs text-lt-white placeholder-lt-64748b focus:border-ll-00d4ff outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2.5 bg-lb-00d4ff hover:bg-lb-cyan-300 disabled:opacity-40 text-lt-020408 rounded-xl transition-all font-bold shadow-[0_0_8px_#00D4FF]"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
