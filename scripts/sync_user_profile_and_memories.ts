import fs from 'fs';
import path from 'path';

// Parse .env.local without external dotenv dependency
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

import { db, ensureDatabaseReady } from '../src/lib/db';
import { profiles, memories, memoryEvents } from '../src/lib/db/schema';
import { defaultProfile } from '../src/data/defaultProfile';
import { DocumentService } from '../src/lib/rag/document-service';
import { buildSystemPromptAsync } from '../src/lib/ai/prompts';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

async function syncProfileAndMemories() {
  console.log('====================================================');
  console.log('🔄 SYNCING MD FARHAN HOSSAIN PROFILE & KNOWLEDGE BASE');
  console.log('====================================================\n');

  await ensureDatabaseReady();

  // 1. Update SQLite profiles table
  console.log('--- 1. Updating SQLite Profile (profiles table) ---');
  await db
    .insert(profiles)
    .values({
      id: 'main',
      data: defaultProfile as any,
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        data: defaultProfile as any,
        updatedAt: new Date().toISOString(),
      },
    });
  console.log('✅ SQLite profiles table updated with Md Farhan Hossain credentials.');

  // 2. Clear old mock memories and seed authentic verified memories
  console.log('--- 2. Seeding Verified Personal Memories ---');
  await db.delete(memories);
  await db.delete(memoryEvents);

  const realMemories = [
    {
      id: 'mem-identity-1',
      category: 'FACT',
      title: 'Identity & Professional Summary',
      content:
        'Md Farhan Hossain is a self-taught Software Developer and AI Builder based in Dhaka, Bangladesh (Phone: +880 1346-859137, Email: farhan.sajid1896@gmail.com, GitHub: https://github.com/farhanfreak9137-ai, Portfolio: https://portfolio-two-chi-dgvbedq05m.vercel.app/). Began programming in March 2026, progressing rapidly from foundational HTML/CSS into modern web development, AI/LLM engineering, automation, computer vision, local RAG systems, and multi-provider AI orchestration through intensive independent learning. Dedicates ~6 hours daily to programming and builds/uses full production applications.',
      source: 'verified_cv',
      confidence: 1.0,
      verified: true,
      status: 'active',
    },
    {
      id: 'mem-edu-1',
      category: 'FACT',
      title: 'Education — Higher Secondary & Secondary',
      content:
        'Currently pursuing Higher Secondary Certificate (HSC) in Science stream at Pallabi Government College (2nd Year — Expected 2027). Completed 1st Year HSC Science at Milestone College (2024–2025). Graduated Secondary School Certificate (SSC) in Science from MDC Model School & College in 2025 with GPA 4.11 / 5.0.',
      source: 'verified_cv',
      confidence: 1.0,
      verified: true,
      status: 'active',
    },
    {
      id: 'mem-exp-1',
      category: 'EXPERIENCE',
      title: 'Work Experience — Shwapno POS Cashier',
      content:
        'Full-time Checkout Assistant / POS Cashier at Shwapno from July 30, 2025 to December 20, 2025 in Dhaka. Operated POS checkout systems, handled customer transactions with accuracy and professionalism in a fast-paced retail environment. Developed strong operational discipline, customer interaction skills, and time management before stepping down to focus heavily on academics and software engineering.',
      source: 'verified_cv',
      confidence: 1.0,
      verified: true,
      status: 'active',
    },
    {
      id: 'mem-proj-auren',
      category: 'PROJECT',
      title: 'Project — Auren (Personal Career OS & Desktop Copilot)',
      content:
        'Creator & Lead Architect of Auren, a local-first personal AI career operating system and desktop agent orchestrator. Features a 58-tool central assistant orchestrator with dynamic registration, a 4-tier AI failover engine rotating across 3 Gemini API keys and Groq Cloud LPUs (qwen/qwen3.8-27b), intent-based tool pruning (-65% prompt tokens), an offline Windows fast-path (<20ms) for OS and app control, human-in-the-loop approval boundaries, local RAG vector search, and audited Playwright browser automation with SSRF safeguards.',
      source: 'verified_cv',
      confidence: 1.0,
      verified: true,
      status: 'active',
    },
    {
      id: 'mem-proj-atlas',
      category: 'PROJECT',
      title: 'Project — Atlas (AI Operating System & Digital Discipline)',
      content:
        'Lead Developer of Atlas, a cross-platform life tracking and personal discipline platform. Includes a custom native Android Capacitor plugin with UsageStatsManager and system overlays for screen-time restrictions, a WebRTC computer-vision push-up repetition counter using Canvas luminance analysis, 15 Zustand domain stores, multi-provider persistence (LocalStorage + Supabase PostgreSQL + Firebase Cloud Firestore), and context-ingested personal AI assistance.',
      source: 'verified_cv',
      confidence: 1.0,
      verified: true,
      status: 'active',
    },
    {
      id: 'mem-proj-hsc',
      category: 'PROJECT',
      title: 'Project — HSC AI Study Intelligence System',
      content:
        'Creator of an evidence-based study prioritization and exam simulation platform for Bangladesh HSC Science students. Engineered a dynamic topic-priority algorithm combining historical board-question recurrence with student weakness data, multi-model AI provider with Gemini and OpenRouter fallbacks, Bengali/LaTeX preprocessing pipeline for responsive KaTeX rendering, NCTB-style question synthesis, all-board question bank, timed simulator, and a diagnostic "Mistake Vault" distinguishing conceptual gaps from calculation mistakes.',
      source: 'verified_cv',
      confidence: 1.0,
      verified: true,
      status: 'active',
    },
    {
      id: 'mem-proj-gym',
      category: 'PROJECT',
      title: 'Project — Gym Tracker & Personal AI Chatbot',
      content:
        'Built Gym Tracker, an offline-first workout logging and analytics application with custom splits, touch-optimized logging, background-resilient rest timer, and SVG volume analytics. Also developed Personal AI Chatbot in April 2026 as the first major AI application exploring conversational state and personalized AI behavior.',
      source: 'verified_cv',
      confidence: 1.0,
      verified: true,
      status: 'active',
    },
    {
      id: 'mem-skills-1',
      category: 'SKILL',
      title: 'Core Technical Stack & Engineering Capabilities',
      content:
        'Languages: TypeScript, JavaScript (ESNext), Python, Java, HTML5, CSS3, SQL. Frameworks & Web: React 19, Next.js 16 (App Router & Turbopack), Vite, Tailwind CSS (v3 & v4), Zustand, Framer Motion, KaTeX, Node.js, REST APIs. AI/ML: Multi-Model AI Orchestration, Google Gemini SDK, Groq Cloud LPUs, OpenAI APIs, OpenRouter, Ollama, RAG vector similarity search, tool calling, structured outputs (Zod), human-in-the-loop workflows, computer vision (WebRTC/Canvas). Systems: SQLite & Drizzle ORM, Supabase, Firebase Firestore, Playwright browser automation, Windows PowerShell/CMD, Win32 API, Capacitor & native Android integration.',
      source: 'verified_cv',
      confidence: 1.0,
      verified: true,
      status: 'active',
    },
    {
      id: 'mem-pref-1',
      category: 'PREFERENCE',
      title: 'Career Preferences & Languages',
      content:
        'Target Roles: AI Engineer, Software Engineer, Cloud Engineer, Full-Stack Developer, AI-powered Application Developer, Intelligent Automation Developer. Work model: Remote (Worldwide, US/EU/Asia timezones) or Dhaka, Bangladesh. Values: Self-directed learning, building full practical applications rather than isolated tutorials, extreme persistence with unfamiliar tech, safety-conscious agent boundaries, craftsmanship. Languages: Bengali (Native), English (Fluent), Hindi (Fluent). Notice period: 14 days.',
      source: 'verified_cv',
      confidence: 1.0,
      verified: true,
      status: 'active',
    },
  ];

  for (const m of realMemories) {
    await db.insert(memories).values({
      id: m.id,
      category: m.category,
      title: m.title,
      content: m.content,
      source: m.source,
      confidence: m.confidence,
      verified: m.verified,
      status: m.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.insert(memoryEvents).values({
      id: randomUUID(),
      memoryId: m.id,
      eventType: 'created',
      details: JSON.stringify({ action: 'seed_verified_cv_memory' }),
      createdAt: new Date().toISOString(),
    });
  }

  console.log(`✅ Seeded ${realMemories.length} verified memories into SQLite.\n`);

  // 3. Ingest CV into RAG Document Store
  console.log('--- 3. Ingesting CV into Local RAG Vector Store ---');
  try {
    const docService = new DocumentService();
    const cvContent = defaultProfile.documents[0].content;
    const ingestRes = await docService.ingestDocument({
      filename: 'md_farhan_hossain_cv.md',
      content: cvContent,
      title: 'Md Farhan Hossain — Verified Resume & Career Document',
      type: 'cv',
      source: 'official_cv_upload',
      metadata: { author: 'Md Farhan Hossain', verified: true, date: '2026-09-12' },
    });
    console.log(`✅ CV successfully ingested into RAG store: ${ingestRes.chunksCreated} vector chunks created.`);
  } catch (ragErr: any) {
    console.warn('⚠️ RAG ingestion note:', ragErr.message);
  }

  // 4. Test System Prompt Output
  console.log('\n--- 4. Verifying System Prompt Grounding ---');
  const systemPrompt = await buildSystemPromptAsync();
  const includesFarhan = systemPrompt.includes('Md Farhan Hossain');
  const includesShwapno = systemPrompt.includes('Shwapno');
  const includesPallabi = systemPrompt.includes('Pallabi Government College');
  const includesAtlas = systemPrompt.includes('Atlas');

  console.log(`Prompt includes "Md Farhan Hossain": ${includesFarhan ? '✅ YES' : '❌ NO'}`);
  console.log(`Prompt includes "Pallabi Government College": ${includesPallabi ? '✅ YES' : '❌ NO'}`);
  console.log(`Prompt includes "Shwapno": ${includesShwapno ? '✅ YES' : '❌ NO'}`);
  console.log(`Prompt includes "Atlas": ${includesAtlas ? '✅ YES' : '❌ NO'}`);

  console.log('\n====================================================');
  console.log('🎉 PROFILE & KNOWLEDGE BASE SYNC COMPLETE!');
  console.log('====================================================');
}

syncProfileAndMemories().catch(console.error);
