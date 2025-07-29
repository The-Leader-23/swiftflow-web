'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type Message = {
  type: 'user' | 'bot';
  text: string;
};

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { type: 'bot', text: '👋 Hi CEO! Ask me anything about your business.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { type: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      const data = await res.json();
      const reply: Message = {
        type: 'bot',
        text: data.reply || '⚠️ Sorry, I didn’t get that.',
      };

      setMessages((prev) => [...prev, reply]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { type: 'bot', text: '❌ Something went wrong. Try again later.' },
      ]);
    }

    setInput('');
    setLoading(false);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <>
      {/* Floating Bubble */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-full shadow-lg z-50"
      >
        💬
      </button>

      {/* Sliding Chatbox */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-20 right-6 w-[300px] max-h-[400px] bg-gray-900 border border-gray-700 rounded-xl shadow-lg z-50 flex flex-col"
          >
            {/* Header */}
            <div className="p-3 border-b border-gray-700 font-semibold text-white">
              SwiftMind AI 💼
            </div>

            {/* Chat Log */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 text-sm text-gray-200">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`p-2 rounded-lg ${
                    m.type === 'bot'
                      ? 'bg-gray-800 text-left'
                      : 'bg-purple-600 text-right'
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {loading && (
                <div className="text-left text-gray-400 text-xs pl-1">🤖 Thinking...</div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-700 p-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask a question..."
                className="w-full px-3 py-1 rounded-md bg-gray-800 text-white border border-gray-600 focus:outline-none"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

