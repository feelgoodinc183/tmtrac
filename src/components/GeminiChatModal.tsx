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
    <div className="fixed inset-0 z-50 bg-[#020408]/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#0A0F1E] border border-[#1E293B] w-full max-w-xl h-[600px] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[#E0E6ED]">
        {/* Header */}
        <div className="p-4 bg-[#060B16] border-b border-[#1E293B] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00D4FF]/20 border border-[#00D4FF]/40 flex items-center justify-center text-[#00D4FF]">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                TMTRAC Tactician AI
                <span className="text-[10px] bg-[#00D4FF]/20 text-[#00D4FF] px-2 py-0.5 rounded font-mono border border-[#00D4FF]/30">
                  Gemini 3.6 Flash
                </span>
              </h2>
              <p className="text-[10px] text-[#64748B] font-mono">
                Sailing Tactics & Meshtastic Network Assistant
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

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-[#060B16]/50 border-b border-[#1E293B] flex gap-2 overflow-x-auto shrink-0 scrollbar-none">
          <button
            onClick={() => handleQuickPrompt("Analyze Wind Runner's VMG & tactic")}
            className="text-[10px] font-mono whitespace-nowrap bg-[#1E293B] hover:bg-[#00D4FF]/20 text-[#00D4FF] px-2.5 py-1 rounded-full border border-[#00D4FF]/30 transition-all"
          >
            ⛵ Wind Runner VMG
          </button>
          <button
            onClick={() => handleQuickPrompt('How do I fix LoRa mesh negative SNR?')}
            className="text-[10px] font-mono whitespace-nowrap bg-[#1E293B] hover:bg-[#00FF9D]/20 text-[#00FF9D] px-2.5 py-1 rounded-full border border-[#00FF9D]/30 transition-all"
          >
            📡 Fix LoRa SNR
          </button>
          <button
            onClick={() => handleQuickPrompt('Explain IRC vs ORC corrected time math')}
            className="text-[10px] font-mono whitespace-nowrap bg-[#1E293B] hover:bg-[#FFB800]/20 text-[#FFB800] px-2.5 py-1 rounded-full border border-[#FFB800]/30 transition-all"
          >
            ⏱️ IRC vs ORC Math
          </button>
        </div>

        {/* Messages Thread */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#64748B]">
              <Sparkles className="w-8 h-8 text-[#00D4FF] mb-2 animate-pulse" />
              <p className="text-xs font-mono mb-1 text-white">Ask Tactician AI Anything</p>
              <p className="text-[11px]">
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
                  <div className="w-7 h-7 rounded-lg bg-[#00D4FF]/20 border border-[#00D4FF]/40 flex items-center justify-center text-[#00D4FF] shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-xl p-3 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[#00D4FF] text-[#020408] font-medium rounded-tr-none shadow-[0_0_12px_rgba(0,212,255,0.3)]'
                      : 'bg-[#060B16] border border-[#1E293B] text-[#E0E6ED] rounded-tl-none whitespace-pre-wrap'
                  }`}
                >
                  {msg.text}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-[#1E293B] flex items-center justify-center text-[#94A3B8] shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex gap-3 items-center text-xs text-[#00D4FF] font-mono">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Tactician AI is thinking...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="p-3 bg-[#060B16] border-t border-[#1E293B] flex gap-2 items-center shrink-0"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask about race tactics, IRC ratings, or Meshtastic nodes..."
            className="flex-1 bg-[#0A0F1E] border border-[#1E293B] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#64748B] focus:border-[#00D4FF] outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2.5 bg-[#00D4FF] hover:bg-cyan-300 disabled:opacity-40 text-[#020408] rounded-xl transition-all font-bold shadow-[0_0_8px_#00D4FF]"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
