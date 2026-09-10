'use client';

import React, { useState, useEffect } from 'react';
import { executeStartMockInterview, executeEvaluateInterviewAnswer } from '@/lib/tools/client';
import { SparklesIcon, BrainIcon, MicIcon, VolumeIcon } from './Icons';
import { useVoiceInput, speakText, stopSpeaking } from '@/lib/voice/speech';

export function MockInterviewRoom() {
  const [category, setCategory] = useState<'ai_systems' | 'technical_architecture' | 'behavioral_star'>('ai_systems');
  const [currentQuestion, setCurrentQuestion] = useState<{
    question: string;
    scenario?: string;
    rubricExpectations?: string[];
  } | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [evaluation, setEvaluation] = useState<{
    overallScore: number;
    clarityScore: number;
    technicalDepthScore: number;
    strengths: string[];
    improvements: string[];
    feedbackSummary: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);

  const { isListening, toggleListening, isSupported: isVoiceSupported } = useVoiceInput((transcript) => {
    setUserAnswer((prev) => (prev ? `${prev} ${transcript}` : transcript));
  });

  const handleStartQuestion = async () => {
    setLoading(true);
    setEvaluation(null);
    setUserAnswer('');
    stopSpeaking();

    const res = await executeStartMockInterview({ category });
    if (res.success && res.data) {
      const q = res.data as any;
      setCurrentQuestion(q);
      if (voiceMode) {
        speakText(q.question);
      }
    }
    setLoading(false);
  };

  const handleEvaluateAnswer = async () => {
    if (!currentQuestion || !userAnswer.trim()) return;
    setLoading(true);

    const res = await executeEvaluateInterviewAnswer({
      question: currentQuestion.question,
      userAnswer,
    });

    if (res.success && res.data) {
      const evalData = res.data as any;
      setEvaluation(evalData);
      if (voiceMode && evalData.feedbackSummary) {
        speakText(`You scored ${evalData.overallScore} out of 10. ${evalData.feedbackSummary}`);
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ flex: 1, height: '100%', overflowY: 'auto', padding: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#fff' }}>
              Voice & Technical Mock Interview Simulator
            </h2>
            <span className="badge badge-primary">Stage 3 Voice</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Practice challenging Senior/Staff AI and Architecture interview questions with voice speech-to-text and instant STAR rubric feedback.
          </p>
        </div>

        {/* Voice Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => {
              setVoiceMode(!voiceMode);
              if (voiceMode) stopSpeaking();
            }}
            className={`btn ${voiceMode ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            <MicIcon isListening={voiceMode} />
            <span>Voice Mode: {voiceMode ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Category Toolbar */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setCategory('ai_systems')}
            className={`btn ${category === 'ai_systems' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            AI Systems & Agentics
          </button>
          <button
            onClick={() => setCategory('technical_architecture')}
            className={`btn ${category === 'technical_architecture' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            Full-Stack Architecture
          </button>
          <button
            onClick={() => setCategory('behavioral_star')}
            className={`btn ${category === 'behavioral_star' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            Behavioral (STAR Method)
          </button>
        </div>

        <button
          onClick={handleStartQuestion}
          disabled={loading}
          className="btn btn-primary"
          style={{ padding: '8px 18px', fontSize: '0.825rem' }}
        >
          <SparklesIcon />
          <span>{currentQuestion ? 'Next Question' : 'Start Mock Question'}</span>
        </button>
      </div>

      {/* Question Card */}
      {currentQuestion && (
        <div className="glass-panel animate-fade-in" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span className="badge badge-primary">Senior/Staff Question</span>
            <button
              onClick={() => speakText(currentQuestion.question)}
              className="btn btn-ghost"
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              title="Speak Question Aloud"
            >
              <VolumeIcon />
              <span>Read Aloud</span>
            </button>
          </div>

          <h3 style={{ fontSize: '1.15rem', fontWeight: '600', color: '#fff', lineHeight: '1.5', marginBottom: '8px' }}>
            {currentQuestion.question}
          </h3>
          {currentQuestion.scenario && (
            <p style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', marginBottom: '1.25rem' }}>
              🎯 Objective: {currentQuestion.scenario}
            </p>
          )}

          {/* Answer Input Area */}
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Your Answer (Speak via microphone or type):
              </label>

              {isVoiceSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`btn ${isListening ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 12px', fontSize: '0.75rem', color: isListening ? '#f43f5e' : undefined }}
                >
                  <MicIcon isListening={isListening} />
                  <span>{isListening ? 'Listening...' : 'Voice Dictate'}</span>
                </button>
              )}
            </div>

            <textarea
              rows={6}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder={isListening ? '🎙 Listening to your voice... speak your answer' : 'Outline your approach, technical trade-offs, and quantified results...'}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--bg-main)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                lineHeight: '1.6',
                resize: 'vertical',
                marginBottom: '1rem',
              }}
            />

            <button
              onClick={handleEvaluateAnswer}
              disabled={loading || !userAnswer.trim()}
              className="btn btn-primary"
              style={{ padding: '8px 20px', fontSize: '0.85rem' }}
            >
              <BrainIcon className="w-4 h-4" />
              <span>{loading ? 'Evaluating Response...' : 'Submit for AI Evaluation'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Evaluation Feedback */}
      {evaluation && (
        <div className="glass-panel animate-fade-in" style={{ padding: '1.75rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#fff' }}>
                Interview Evaluation & Feedback
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {evaluation.feedbackSummary}
              </p>
            </div>
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#6ee7b7' }}>
                {evaluation.overallScore}/10
              </div>
              <span style={{ fontSize: '0.68rem', color: '#a7f3d0' }}>STAR Rating</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '600', color: '#6ee7b7', marginBottom: '8px' }}>
                ✓ Key Strengths
              </h4>
              <ul style={{ paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {evaluation.strengths.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '600', color: '#fcd34d', marginBottom: '8px' }}>
                ✦ Areas for Improvement
              </h4>
              <ul style={{ paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {evaluation.improvements.map((imp, idx) => (
                  <li key={idx}>{imp}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
