"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ArrowUp, Square, ChevronDown, Radio } from "lucide-react";

/**
 * ─────────────────────────────────────────────────────────────────────────
 * FE-06 · Streaming AI Chat Interface — UI LAYER ONLY
 * ─────────────────────────────────────────────────────────────────────────
 * This file is the CLIENT half of the assignment. There is no API key here,
 * no server call, and no model config — on purpose. It simulates the token
 * stream locally (see `fakeStreamTokens` at the bottom) so you can build
 * and demo the interface before the route handler exists.
 *
 * To wire this up to the real thing later (FE-07 territory):
 *  1. Replace `fakeStreamTokens()` with a fetch to your route handler,
 *     e.g. POST /api/chat, reading the SSE/ReadableStream body chunk by
 *     chunk instead of the setInterval loop below.
 *  2. Keep the model name + system prompt in ONE server-side module
 *     (never in this file) — that module is what FE-07 extends.
 *  3. The `AbortController` pattern used for the stop button maps 1:1
 *     onto aborting a real fetch — swap `stopStreaming()`'s interval
 *     clear for `controller.abort()`.
 * ─────────────────────────────────────────────────────────────────────────
 */

// ---- Canned "model" responses, purely to demonstrate the streaming UI ----
const DEMO_RESPONSES = [
  "Here's the idea: the transport doesn't matter to this component. Whether tokens arrive over SSE, a ReadableStream, or — like right now — a local `setInterval`, the UI only needs three states per message: `thinking`, `streaming`, and `complete`. Everything else, the cursor, the auto-scroll, the stop button, is built on top of that state machine, not on top of *how* the text arrives.\n\nA short code block, to check the renderer doesn't choke on partial fences while it's still streaming in:\n\n```ts\ntype MessageStatus = \"thinking\" | \"streaming\" | \"complete\" | \"stopped\";\n```\n\nStop me mid-sentence if you want to see what a **partial** message looks like once it's",
  "Auto-scroll is the part people get wrong. The rule is simple: pin to bottom *only* while the user is already at the bottom, and release the moment they scroll up — even by a pixel. Try it: scroll up while I'm still talking, and I'll stop chasing your viewport. A small \"jump to latest\" pill shows up instead.\n\nThe handoff from the thinking indicator to the first token matters too — it should feel like one continuous thing, not a swap. If you watch closely, the signal bars fade out at the same moment the first character fades in.",
  "Try the stop button partway through this one, then send another message right after. The partial reply above should stay exactly as it was cut off, the input should already be usable again, and this new turn should stream in cleanly — no leftover interval, no stuck state. That's the actual test, not just the styling around it.",
];

let demoIndex = 0;
function nextDemoResponse() {
  const text = DEMO_RESPONSES[demoIndex % DEMO_RESPONSES.length];
  demoIndex += 1;
  return text;
}

// ---- id helper ----
let idCounter = 0;
const nextId = () => `m_${Date.now()}_${idCounter++}`;

export default function StreamingChat() {
  const [messages, setMessages] = useState(() => [
    {
      id: nextId(),
      role: "assistant",
      status: "complete",
      content:
        "This is the UI layer for a streaming chat — no backend wired up yet. Send a message and I'll simulate a token stream so you can see the thinking indicator, the streaming cursor, and the stop button in action.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isPinned, setIsPinned] = useState(true);
  const [showJump, setShowJump] = useState(false);

  const streamingIdRef = useRef(null);
  const intervalRef = useRef(null);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const bottomSentinelRef = useRef(null);

  const isStreaming = streamingIdRef.current !== null;

  // ---- auto-scroll: pin to bottom only while already at bottom ----
  const checkPinned = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 48;
    setIsPinned(atBottom);
    setShowJump(!atBottom);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkPinned, { passive: true });
    return () => el.removeEventListener("scroll", checkPinned);
  }, [checkPinned]);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    bottomSentinelRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  // Only auto-follow new content while pinned to bottom.
  useEffect(() => {
    if (isPinned) scrollToBottom(isStreaming ? "auto" : "smooth");
  }, [messages, isPinned, isStreaming, scrollToBottom]);

  // ---- textarea auto-resize ----
  const handleInputChange = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    }
  };

  // ---- core: simulate a token stream onto one message ----
  const streamInto = useCallback((messageId, fullText) => {
    let cursor = 0;
    intervalRef.current = window.setInterval(() => {
      // variable chunk size so it doesn't feel like a metronome
      const chunk = 1 + Math.floor(Math.random() * 4);
      cursor = Math.min(cursor + chunk, fullText.length);
      const slice = fullText.slice(0, cursor);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, content: slice, status: "streaming" } : m
        )
      );
      if (cursor >= fullText.length) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        streamingIdRef.current = null;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, status: "complete" } : m
          )
        );
      }
    }, 24);
  }, []);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg = { id: nextId(), role: "user", status: "complete", content: text };
    const assistantId = nextId();
    const assistantMsg = {
      id: assistantId,
      role: "assistant",
      status: "thinking",
      content: "",
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsPinned(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    streamingIdRef.current = assistantId;

    // simulated "time to first token"
    window.setTimeout(() => {
      // guard: only start streaming if this turn hasn't been aborted
      if (streamingIdRef.current !== assistantId) return;
      streamInto(assistantId, nextDemoResponse());
    }, 550 + Math.random() * 500);
  }, [input, isStreaming, streamInto]);

  const stopStreaming = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const id = streamingIdRef.current;
    streamingIdRef.current = null;
    if (id) {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "stopped" } : m))
      );
    }
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="scv-root">
      <style>{`
        .scv-root {
          --bg: #0c1220;
          --panel: #10182b;
          --panel-2: #141f38;
          --border: #22304d;
          --text: #e7edf7;
          --text-muted: #8291ab;
          --accent: #e8a33d;
          --accent-dim: #6b552a;
          --user-bubble: #1c3a5e;
          --font-body: 'IBM Plex Sans', 'Inter', -apple-system, sans-serif;
          --font-mono: 'IBM Plex Mono', 'SFMono-Regular', Menlo, monospace;

          display: flex;
          flex-direction: column;
          height: 100dvh;
          max-height: 100dvh;
          width: 100%;
          background: var(--bg);
          color: var(--text);
          font-family: var(--font-body);
          overflow: hidden;
        }
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

        .scv-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--panel);
          flex-shrink: 0;
        }
        .scv-header-left { display: flex; align-items: center; gap: 8px; }
        .scv-title { font-family: var(--font-mono); font-size: 13px; letter-spacing: 0.06em; font-weight: 600; text-transform: uppercase; }
        .scv-live-dot {
          width: 7px; height: 7px; border-radius: 999px; background: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-dim);
        }
        .scv-live-dot.idle { background: #4a5872; box-shadow: 0 0 0 3px rgba(74,88,114,0.25); }
        .scv-model-pill {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 4px 10px;
          white-space: nowrap;
        }

        .scv-scroll {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 20px 14px 8px;
          scroll-behavior: smooth;
        }
        .scv-scroll::-webkit-scrollbar { width: 8px; }
        .scv-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 999px; }

        .scv-msg-row { display: flex; margin-bottom: 14px; max-width: 100%; }
        .scv-msg-row.user { justify-content: flex-end; }
        .scv-msg-row.assistant { justify-content: flex-start; }

        .scv-msg {
          max-width: min(560px, 86%);
          border-radius: 16px;
          padding: 12px 14px;
          font-size: 14.5px;
          line-height: 1.55;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .scv-msg.user {
          background: var(--user-bubble);
          border-bottom-right-radius: 4px;
          color: var(--text);
        }
        .scv-msg.assistant {
          background: var(--panel-2);
          border: 1px solid var(--border);
          border-left: 2px solid var(--accent);
          border-bottom-left-radius: 4px;
          color: var(--text);
        }
        .scv-msg.stopped { opacity: 0.85; }

        .scv-label {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 4px;
        }

        .scv-cursor {
          display: inline-block;
          width: 7px;
          height: 15px;
          background: var(--accent);
          margin-left: 2px;
          vertical-align: text-bottom;
          animation: scv-blink 1s steps(1) infinite;
        }
        @keyframes scv-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }

        .scv-thinking { display: flex; align-items: center; gap: 8px; height: 15px; }
        .scv-bar {
          width: 3px;
          height: 14px;
          background: var(--accent);
          border-radius: 2px;
          animation: scv-pulse 1s ease-in-out infinite;
        }
        .scv-bar:nth-child(2) { animation-delay: 0.15s; }
        .scv-bar:nth-child(3) { animation-delay: 0.3s; }
        @keyframes scv-pulse {
          0%, 100% { transform: scaleY(0.4); opacity: 0.5; }
          50% { transform: scaleY(1); opacity: 1; }
        }

        .scv-tag {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          margin-top: 6px;
        }

        .scv-code-block {
          background: #0a0f1d;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 12px;
          margin: 8px 0;
          font-family: var(--font-mono);
          font-size: 12.5px;
          overflow-x: auto;
          color: #d7dee9;
        }
        .scv-inline-code {
          font-family: var(--font-mono);
          font-size: 0.92em;
          background: rgba(232, 163, 61, 0.12);
          color: var(--accent);
          padding: 1px 5px;
          border-radius: 4px;
        }

        .scv-bottom-sentinel { height: 1px; }

        .scv-jump-wrap {
          position: sticky;
          bottom: 8px;
          display: flex;
          justify-content: center;
          pointer-events: none;
        }
        .scv-jump {
          pointer-events: auto;
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--panel-2);
          border: 1px solid var(--border);
          color: var(--text);
          font-family: var(--font-mono);
          font-size: 11px;
          padding: 6px 12px;
          border-radius: 999px;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(0,0,0,0.35);
        }
        .scv-jump:hover { border-color: var(--accent); color: var(--accent); }

        .scv-dock {
          flex-shrink: 0;
          border-top: 1px solid var(--border);
          background: var(--panel);
          padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
        }
        .scv-input-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          background: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 8px 8px 8px 14px;
        }
        .scv-input-row:focus-within { border-color: var(--accent); }
        .scv-textarea {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          color: var(--text);
          font-family: var(--font-body);
          font-size: 16px; /* keeps iOS from zooming on focus */
          line-height: 1.4;
          max-height: 160px;
          padding: 6px 0;
        }
        .scv-textarea::placeholder { color: var(--text-muted); }

        .scv-send-btn {
          flex-shrink: 0;
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          background: var(--accent);
          color: #1a1305;
          transition: transform 0.12s ease, opacity 0.12s ease;
        }
        .scv-send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .scv-send-btn:not(:disabled):active { transform: scale(0.92); }
        .scv-send-btn.stop { background: #d94f4f; color: #fff; }

        .scv-hint {
          text-align: center;
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          margin-top: 6px;
        }

        @media (prefers-reduced-motion: reduce) {
          .scv-cursor, .scv-bar { animation: none !important; opacity: 1 !important; }
          .scv-scroll { scroll-behavior: auto; }
        }

        @media (max-width: 480px) {
          .scv-msg { max-width: 90%; font-size: 14px; }
          .scv-title { font-size: 12px; }
        }
      `}</style>

      <header className="scv-header">
        <div className="scv-header-left">
          <span className={`scv-live-dot ${isStreaming ? "" : "idle"}`} />
          <span className="scv-title">Streaming Console</span>
        </div>
        <div className="scv-model-pill">
          <Radio size={11} style={{ display: "inline", marginRight: 5, verticalAlign: -1 }} />
          UI demo · no backend wired
        </div>
      </header>

      <div className="scv-scroll" ref={scrollRef}>
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div className="scv-bottom-sentinel" ref={bottomSentinelRef} />
        {showJump && (
          <div className="scv-jump-wrap">
            <button
              type="button"
              className="scv-jump"
              onClick={() => {
                setIsPinned(true);
                setShowJump(false);
                scrollToBottom("smooth");
              }}
            >
              <ChevronDown size={12} />
              Jump to latest
            </button>
          </div>
        )}
      </div>

      <div className="scv-dock">
        <div className="scv-input-row">
          <textarea
            ref={textareaRef}
            className="scv-textarea"
            rows={1}
            placeholder="Ask something…"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          {isStreaming ? (
            <button
              type="button"
              className="scv-send-btn stop"
              onClick={stopStreaming}
              aria-label="Stop generating"
              title="Stop generating"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              className="scv-send-btn"
              onClick={sendMessage}
              disabled={!input.trim()}
              aria-label="Send message"
              title="Send message"
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          )}
        </div>
        <div className="scv-hint">Enter to send · Shift+Enter for a new line</div>
      </div>
    </div>
  );
}

// ── Message rendering ───────────────────────────────────────────────────

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const isThinking = message.status === "thinking";
  const isStreaming = message.status === "streaming";
  const isStopped = message.status === "stopped";

  return (
    <div className={`scv-msg-row ${isUser ? "user" : "assistant"}`}>
      <div className="scv-msg-col">
        <div className="scv-label">{isUser ? "You" : "Assistant"}</div>
        <div className={`scv-msg ${isUser ? "user" : "assistant"} ${isStopped ? "stopped" : ""}`}>
          {isThinking ? (
            <ThinkingIndicator />
          ) : (
            <>
              {renderSafeMarkdown(message.content)}
              {isStreaming && <span className="scv-cursor" />}
            </>
          )}
        </div>
        {isStopped && <div className="scv-tag">Stopped by user · partial response kept</div>}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="scv-thinking" aria-label="Assistant is thinking">
      <span className="scv-bar" />
      <span className="scv-bar" />
      <span className="scv-bar" />
    </div>
  );
}

// ── Minimal, streaming-safe markdown rendering ──────────────────────────
// Renders bold, inline code, and fenced code blocks. Crucially: an
// UNCLOSED code fence (which happens constantly mid-stream) is left as
// plain text instead of being rendered as a broken/open block, so the
// UI never flickers into a half-parsed state while tokens are arriving.
function renderSafeMarkdown(text) {
  const fenceCount = (text.match(/```/g) || []).length;
  const hasUnclosedFence = fenceCount % 2 === 1;

  const safeText = hasUnclosedFence
    ? text.slice(0, text.lastIndexOf("```"))
    : text;
  const trailing = hasUnclosedFence ? text.slice(text.lastIndexOf("```")) : "";

  const parts = safeText.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const code = part.replace(/^```(\w*)\n?/, "").replace(/```$/, "");
          return (
            <div className="scv-code-block" key={i}>
              {code}
            </div>
          );
        }
        return <React.Fragment key={i}>{renderInline(part)}</React.Fragment>;
      })}
      {trailing && <React.Fragment>{renderInline(trailing)}</React.Fragment>}
    </>
  );
}

function renderInline(text) {
  const segments = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return segments.map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**")) {
      return <strong key={i}>{seg.slice(2, -2)}</strong>;
    }
    if (seg.startsWith("`") && seg.endsWith("`") && seg.length > 1) {
      return (
        <code className="scv-inline-code" key={i}>
          {seg.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={i}>{seg}</React.Fragment>;
  });
}
