'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ProviderId, ToolCall } from '@/lib/ai/types';
import { SendIcon, BrainIcon, SparklesIcon, TrashIcon, ShieldCheckIcon, MicIcon, VolumeIcon, WorkflowIcon } from './Icons';
import { PromptChips } from './PromptChips';
import type { OrchestrationStep } from '@/types/orchestrator';
import { ToolExecutionResult } from '@/types/tools';
import { useVoiceInput, speakText } from '@/lib/voice/speech';

interface ChatInterfaceProps {
  selectedProvider: ProviderId;
  onProviderUsedUpdate: (provider: ProviderId) => void;
  onRequestApproval?: (payload: NonNullable<ToolExecutionResult['approvalPayload']>, toolCall?: ToolCall) => void;
}

export function ChatInterface({
  selectedProvider,
  onProviderUsedUpdate,
  onRequestApproval,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hello! I am **Farhan AI**, your Central Career Assistant.\n\nI can answer career and technical questions directly, or autonomously delegate complex tasks to specialized agents (**Career Agent**, **Opportunity Agent**, **Memory Agent**) using native tool calling. All data mutations (applications, proposals) are guarded by human approval before touching your local SQLite database.\n\nTry asking: *\"Find opportunities suitable for me\"*, *\"What are my core technical skills?\"*, or *\"Explain Retrieval-Augmented Generation (RAG)\"*.",
    },
  ]);
  const [stepsLog, setStepsLog] = useState<Record<number, OrchestrationStep[]>>({});
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { isListening, toggleListening, isSupported: isVoiceSupported } = useVoiceInput((transcript) => {
    setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming, stepsLog]);

  const handleSend = async (overrideText?: string) => {
    const textToSend = (overrideText || input).trim();
    if (!textToSend || isStreaming) return;

    setInput('');
    setErrorMessage(null);

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: textToSend },
    ];

    setMessages(newMessages);
    setIsStreaming(true);

    const assistantIndex = newMessages.length;
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      // Send directly to Central Assistant Orchestrator with Native Tool Calling
      const res = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          provider: selectedProvider,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Orchestrator error' }));
        throw new Error(err.error || `Error ${res.status}`);
      }

      const data = await res.json();

      if (data.providerUsed) {
        onProviderUsedUpdate(data.providerUsed);
      }

      // Save orchestration steps for transparent display
      if (data.steps && data.steps.length > 0) {
        setStepsLog((prev) => ({ ...prev, [assistantIndex]: data.steps }));
      }

      // Trigger Human Approval modal if action requires authorization
      if (data.approvalRequest && onRequestApproval) {
        onRequestApproval(data.approvalRequest, data.pendingToolCall);
      }

      setMessages((prev) => {
        const copy = [...prev];
        copy[assistantIndex] = {
          role: 'assistant',
          content: data.answer || 'Completed request.',
        };
        return copy;
      });
    } catch (err: unknown) {
      console.error('Chat error:', err);
      const msg = err instanceof Error ? err.message : 'Communication error';
      setErrorMessage(msg);
      setMessages((prev) => {
        const copy = [...prev];
        copy[assistantIndex] = {
          role: 'assistant',
          content: `⚠️ **Error**: ${msg}`,
        };
        return copy;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([
      {
        role: 'assistant',
        content: "Conversation cleared. What career task or tool can I run for you?",
      },
    ]);
    setStepsLog({});
    setErrorMessage(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const steps = stepsLog[idx];

          return (
            <div
              key={idx}
              className="animate-fade-in"
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: isUser ? '80%' : '88%',
              }}
            >
              {!isUser && (
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'var(--gradient-brand)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                    boxShadow: 'var(--shadow-glow)',
                  }}
                >
                  <BrainIcon className="w-4 h-4" />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                {/* Visualizer for Tool Execution Steps */}
                {!isUser && steps && steps.length > 0 && (
                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 14px',
                      fontSize: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a5b4fc', fontWeight: '600' }}>
                      <SparklesIcon />
                      <span>Central Assistant Execution Trace:</span>
                    </div>
                    {steps.map((step, sIdx) => {
                      const isApproval = step.step === 'approval_requested';
                      const isSynthesis = step.step === 'synthesis';
                      const isTool = step.step === 'tool_execution';
                      const iconColor = isApproval ? '#f59e0b' : isSynthesis ? '#10b981' : isTool ? '#06b6d4' : '#818cf8';

                      return (
                        <div key={sIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--text-secondary)' }}>
                          <span style={{ color: iconColor, marginTop: '1px' }}>{isApproval ? '⚠️' : isSynthesis ? '✓' : '✦'}</span>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ color: isApproval ? '#fbbf24' : '#f1f5f9', fontWeight: isApproval ? '600' : '400' }}>
                              {step.title}
                            </span>
                            {step.details && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {step.details}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Message Content Bubble */}
                <div
                  style={{
                    background: isUser ? 'var(--gradient-brand)' : 'var(--bg-surface-elevated)',
                    border: isUser ? 'none' : '1px solid var(--border-subtle)',
                    borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '1rem 1.25rem',
                    color: '#fff',
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  <div style={{ fontSize: '0.9rem', lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {msg.content || (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                        <span className="pulse-glow" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6366f1' }}></span>
                        Executing career tool & synthesizing answer...
                      </span>
                    )}
                  </div>

                  {!isUser && steps && steps.some((s) => s.details?.includes('wf_') || s.title?.includes('workflow')) && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '10px',
                        padding: '6px 12px',
                        background: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        color: '#a5b4fc',
                      }}
                    >
                      <WorkflowIcon className="w-4 h-4" />
                      <span>Autonomous Workflow checkpoint saved. Open <strong>Workflows</strong> tab to inspect real-time steps.</span>
                    </div>
                  )}

                  {!isUser && msg.content && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '8px',
                        paddingTop: '6px',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldCheckIcon className="w-3 h-3" />
                        <span>Grounded in verified records • Tool Orchestration Active</span>
                      </div>
                      <button
                        onClick={() => speakText(msg.content)}
                        className="btn btn-ghost"
                        style={{ padding: '2px 8px', fontSize: '0.68rem', gap: '4px' }}
                        title="Listen to Farhan AI response"
                      >
                        <VolumeIcon className="w-3 h-3" />
                        <span>Listen</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {messages.length <= 2 && (
          <PromptChips onSelectPrompt={(p) => handleSend(p)} disabled={isStreaming} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div
        style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-subtle)',
          background: 'rgba(10, 14, 23, 0.95)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {errorMessage && (
          <div className="badge badge-warning" style={{ width: '100%', marginBottom: '0.75rem', padding: '6px 12px' }}>
            {errorMessage}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '8px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '8px 12px',
          }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? '🎙 Listening to your voice...' : "Ask anything or run career tools (e.g., 'Find opportunities suitable for me', 'Analyze my skill gap')..."}
            disabled={isStreaming}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              fontFamily: 'inherit',
              resize: 'none',
              maxHeight: '120px',
              padding: '4px 0',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isVoiceSupported && (
              <button
                type="button"
                onClick={toggleListening}
                title={isListening ? 'Listening... click to stop' : 'Voice Speech-to-Text'}
                className={`btn ${isListening ? 'btn-primary' : 'btn-ghost'}`}
                style={{
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  color: isListening ? '#f43f5e' : undefined,
                }}
              >
                <MicIcon isListening={isListening} />
              </button>
            )}

            <button onClick={handleClear} title="Clear conversation" className="btn btn-ghost" style={{ padding: '6px' }}>
              <TrashIcon />
            </button>

            <button
              onClick={() => handleSend()}
              disabled={isStreaming || !input.trim()}
              className="btn btn-primary"
              style={{ padding: '8px 14px', opacity: isStreaming || !input.trim() ? 0.5 : 1 }}
            >
              <SendIcon />
              <span>{isStreaming ? 'Thinking...' : 'Send'}</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span>Shift + Enter for new line • Automatic Tool Orchestration Active</span>
          <span>Stage 2 — AI Career Operating System</span>
        </div>
      </div>
    </div>
  );
}
