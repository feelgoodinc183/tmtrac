import React, { useState, useRef, useEffect, useId } from 'react';
import { ChatMessage } from '../types/regatta';
import { X, Bot, Send, Sparkles, User, RefreshCw } from 'lucide-react';
import { DialogFrame } from './ui/Dialog';

interface GeminiChatModalProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onClose: () => void;
}

export const GeminiChatModal: React.FC<GeminiChatModalProps> = ({
  messages,
  onSendMessage,
  onClose,
}) => {
  const titleId = useId();
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
    <DialogFrame
      onClose={onClose}
      labelledBy={titleId}
      overlayClassName="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      className="bg-surface border border-line w-full max-w-xl h-[600px] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-ink"
    >
      {/* Header */}
      <div className="p-4 bg-canvas border-b border-line flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 id={titleId} className="text-sm font-bold tracking-tight text-ink flex items-center gap-2">
              TMTRAC Tactician AI
              <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded border border-accent/30">
                Gemini 3.6 Flash
              </span>
            </h2>
            <p className="text-xs text-ink-muted">
              Sailing Tactics & Meshtastic Network Assistant
            </p>
          </div>
        </div>
        <button
          aria-label="Close"
          onClick={onClose}
          className="p-1.5 rounded-lg text-ink-muted hover:text-ink transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Quick Suggestion Chips */}
      <div className="px-4 py-2 bg-canvas/50 border-b border-line flex gap-2 overflow-x-auto shrink-0 scrollbar-none">
        <button
          onClick={() => handleQuickPrompt("Analyze Wind Runner's VMG & tactic")}
          className="text-xs whitespace-nowrap bg-raised hover:bg-accent/20 text-accent px-2.5 py-1 rounded-full border border-accent/30 transition-all"
        >
          Wind Runner VMG
        </button>
        <button
          onClick={() => handleQuickPrompt('How do I fix LoRa mesh negative SNR?')}
          className="text-xs whitespace-nowrap bg-raised hover:bg-success-ink/20 text-success-ink px-2.5 py-1 rounded-full border border-success-ink/30 transition-all"
        >
          Fix LoRa SNR
        </button>
        <button
          onClick={() => handleQuickPrompt('Explain IRC vs ORC corrected time math')}
          className="text-xs whitespace-nowrap bg-raised hover:bg-warning-ink/20 text-warning-ink px-2.5 py-1 rounded-full border border-warning-ink/30 transition-all"
        >
          ⏱️ IRC vs ORC Math
        </button>
      </div>

      {/* Messages Thread */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-ink-muted">
            <Sparkles className="w-8 h-8 text-accent mb-2" />
            <p className="text-xs mb-1 text-ink">Ask Tactician AI Anything</p>
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
                <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-xl p-3 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-accent text-on-accent font-medium rounded-tr-none '
                    : 'bg-canvas border border-line text-ink rounded-tl-none whitespace-pre-wrap'
                }`}
              >
                {msg.text}
              </div>

              {msg.sender === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-raised flex items-center justify-center text-ink-muted shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex gap-3 items-center text-xs text-accent">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Tactician AI is thinking...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="p-3 bg-canvas border-t border-line flex gap-2 items-center shrink-0"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask about race tactics, IRC ratings, or Meshtastic nodes..."
          className="flex-1 bg-surface border border-line rounded-xl px-4 py-2.5 text-xs text-ink placeholder-ink-muted focus:border-accent outline-none"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="p-2.5 bg-accent hover:brightness-110 disabled:opacity-40 text-on-accent rounded-xl transition-all font-bold"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </DialogFrame>
  );
};
