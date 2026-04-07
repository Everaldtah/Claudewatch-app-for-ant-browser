'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useDevice } from '../lib/useDevice';
import { useVoice } from '../lib/useVoice';
import { useSettings, type Settings } from '../lib/useSettings';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

/* ============================================================
   Settings Modal
   ============================================================ */

function SettingsModal({
  settings,
  onSave,
  onClose,
  isFirstRun,
}: {
  settings: Settings;
  onSave: (s: Settings) => void;
  onClose: () => void;
  isFirstRun: boolean;
}) {
  const [url, setUrl] = useState(settings.serverURL);
  const [token, setToken] = useState(settings.authToken);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !isFirstRun) onClose(); }}>
      <div className="modal">
        <h2 className="modal-title">⚙ Relay Settings</h2>
        <p className="modal-hint">
          Point to your Claude Code relay server. The token is stored only on this device.
        </p>

        <div className="field-group">
          <label className="field-label" htmlFor="relay-url">Relay URL</label>
          <input
            id="relay-url"
            className="field-input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-relay.example.com"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="relay-token">Bearer Token</label>
          <input
            id="relay-token"
            className="field-input"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="your-auth-token"
            autoComplete="current-password"
          />
        </div>

        <div className="modal-actions">
          {!isFirstRun && (
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          )}
          <button
            className="btn-primary"
            onClick={() => onSave({ ...settings, serverURL: url.trim(), authToken: token.trim() })}
            disabled={!url.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Main page
   ============================================================ */

export default function Home() {
  const device = useDevice();
  const { settings, saveSettings } = useSettings();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputBeforeMicRef = useRef('');

  const isWatch = device === 'watch';

  // Mark mounted so we can show settings if first-run
  useEffect(() => {
    setMounted(true);
  }, []);

  // First-run: open settings when serverURL is missing
  useEffect(() => {
    if (mounted && !settings.serverURL) {
      setShowSettings(true);
    }
  }, [mounted, settings.serverURL]);

  const appendToLastAssistant = useCallback((updater: (prev: Message) => Message) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== 'assistant') return prev;
      return [...prev.slice(0, -1), updater(last)];
    });
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    if (!settings.serverURL) {
      setShowSettings(true);
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setStreaming(true);
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          session_id: settings.sessionID || undefined,
          server_url: settings.serverURL,
          auth_token: settings.authToken || undefined,
        }),
      });

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed) as {
              type: string;
              text?: string;
              session_id?: string;
              message?: string;
            };

            if (event.type === 'text' && event.text) {
              appendToLastAssistant((m) => ({
                ...m,
                content: m.content + event.text,
              }));
            } else if (event.type === 'done') {
              if (event.session_id) {
                saveSettings({ ...settings, sessionID: event.session_id });
              }
            } else if (event.type === 'error') {
              appendToLastAssistant((m) => ({
                ...m,
                content: m.content + (m.content ? '\n' : '') + `⚠ ${event.message ?? 'Unknown error'}`,
                error: true,
              }));
            }
          } catch {
            // skip malformed NDJSON lines
          }
        }
      }
    } catch (err) {
      appendToLastAssistant((m) => ({
        ...m,
        content: `⚠ ${err instanceof Error ? err.message : String(err)}`,
        error: true,
      }));
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, settings, saveSettings, appendToLastAssistant]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleNewSession = () => {
    saveSettings({ ...settings, sessionID: '' });
    setMessages([]);
  };

  // Voice
  const { listening, supported, startListening, stopListening } = useVoice({
    onTranscript: (text) => {
      const prefix = inputBeforeMicRef.current;
      setInput(prefix ? `${prefix} ${text}` : text);
    },
  });

  const toggleMic = () => {
    if (listening) {
      stopListening();
    } else {
      inputBeforeMicRef.current = input;
      startListening();
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isFirstRun = mounted && !settings.serverURL;

  return (
    <div className={`app ${device}`}>
      {/* ── Settings Modal ── */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={(s) => { saveSettings(s); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
          isFirstRun={isFirstRun}
        />
      )}

      {/* ── Header ── */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">⌚</span>
            <span className="logo-text">{isWatch ? 'CW' : 'ClaudeWatch'}</span>
          </div>
          <div className="header-actions">
            <button
              className="icon-btn"
              onClick={handleNewSession}
              title="New session"
              aria-label="New session"
            >
              ↺
            </button>
            <button
              className="icon-btn"
              onClick={() => setShowSettings(true)}
              title="Settings"
              aria-label="Settings"
            >
              ⚙
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero (phone + desktop only) ── */}
      {!isWatch && (
        <section className="hero">
          <h1>Drive Claude Code from your wrist or pocket</h1>
          <p>
            Voice-first interface for the Claude Code CLI. Works in Ant Browser on Apple Watch
            and iPhone, and in any modern browser.
          </p>
          <div className="feature-grid">
            {[
              { icon: '🎤', title: 'Voice Input', desc: 'Speak your prompts hands-free via WebKit Speech API' },
              { icon: '⚡', title: 'Live Streaming', desc: 'Real-time NDJSON stream from Claude Code relay' },
              { icon: '🔒', title: 'Private by Default', desc: 'Token lives only on your device — never in env vars' },
              { icon: '📱', title: 'Adaptive Layout', desc: 'Auto-switches between Watch, Phone, and Desktop UIs' },
            ].map((f) => (
              <div key={f.title} className="feature-card">
                <span className="feature-icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Chat ── */}
      <main className="chat-section">
        <div className="chat-card">
          <div className="messages">
            {messages.length === 0 && (
              <div className="empty-state">
                {isWatch ? 'Tap 🎤 to start' : 'Send a prompt to Claude Code to get started'}
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}${msg.error ? ' error' : ''}`}>
                {!isWatch && (
                  <span className="msg-label">{msg.role === 'user' ? 'You' : 'Claude'}</span>
                )}
                <div className="msg-content">
                  {msg.content ||
                    (msg.role === 'assistant' && streaming ? '▋' : '')}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-bar">
            <textarea
              className="input-field"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isWatch
                  ? 'Prompt…'
                  : 'Type a prompt… (Enter to send, Shift+Enter for newline)'
              }
              rows={isWatch ? 1 : 2}
              disabled={streaming}
              aria-label="Prompt input"
            />
            <div className="input-actions">
              {supported && (
                <button
                  className={`icon-btn mic-btn${listening ? ' recording' : ''}`}
                  onClick={toggleMic}
                  disabled={streaming}
                  title={listening ? 'Stop recording' : 'Voice input'}
                  aria-label={listening ? 'Stop recording' : 'Start voice input'}
                  aria-pressed={listening}
                >
                  🎤
                </button>
              )}
              <button
                className="send-btn"
                onClick={sendMessage}
                disabled={!input.trim() || streaming}
                title="Send"
                aria-label="Send message"
              >
                {streaming ? '…' : '↑'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer (phone + desktop only) ── */}
      {!isWatch && (
        <footer className="footer">
          <p>
            ClaudeWatch &middot; Voice-first Claude Code client &middot;{' '}
            <a
              href="https://github.com/Everaldtah/Claudewatch-app-for-ant-browser"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </p>
        </footer>
      )}
    </div>
  );
}
