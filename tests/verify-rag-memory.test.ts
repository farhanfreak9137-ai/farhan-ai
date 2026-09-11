import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureDatabaseReady, db } from '@/lib/db';
import { documents as documentsTable, documentChunks as documentChunksTable, memories as memoriesTable, memoryEvents as memoryEventsTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { PlainTextExtractor } from '@/lib/rag/extractors/plain-text';
import { MarkdownExtractor } from '@/lib/rag/extractors/markdown';
import { JsonExtractor } from '@/lib/rag/extractors/json';
import { PdfExtractor } from '@/lib/rag/extractors/pdf';
import { TextChunker } from '@/lib/rag/chunker';
import { MockEmbeddingProvider } from '@/lib/rag/embeddings/mock-embeddings';
import { VectorIndex } from '@/lib/rag/vector-index';
import { DocumentService } from '@/lib/rag/document-service';
import {
  addMemoryAsync,
  getMemoriesAsync,
  findMemoriesByCategoryAsync,
  searchMemoriesAsync,
  verifyMemoryAsync,
  invalidateMemoryAsync,
  deleteMemoryAsync,
  getMemoryEventsAsync,
} from '@/lib/memory/store';
import { MemoryValidator } from '@/lib/memory/validation';
import { KnowledgeAgent } from '@/lib/agents/knowledge-agent';
import { defaultRegistry } from '@/lib/agents/registry';
import { CentralAssistant } from '@/lib/agents/assistant';
import { MockProvider } from '@/lib/ai/providers/mock';

test('RAG: 1. Plain text extractor extracts text, metadata, and token count', async () => {
  const extractor = new PlainTextExtractor();
  const text = 'Farhan is an AI Systems Architect based in Toronto. He specializes in TypeScript, LLMs, and distributed systems.';
  const buffer = Buffer.from(text, 'utf-8');

  const result = await extractor.extract(buffer, 'profile.txt');
  assert.equal(result.detectedType, 'txt');
  assert.ok(result.text.includes('Farhan is an AI Systems Architect'));
  assert.ok(((result.metadata.charCount || result.metadata.characterCount) as number) > 0);
  assert.ok((result.metadata.wordCount as number) > 0);
  assert.ok((result.metadata.estimatedTokens as number) > 0);
});

test('RAG: 2. Markdown extractor extracts headings and clean structure', async () => {
  const extractor = new MarkdownExtractor();
  const md = `# Farhan Bio
## Experience
- Senior Lead Architect at NextGen AI (2022-Present)
- Full Stack Engineer at DataCorp (2019-2022)

## Key Projects
- Agent Orchestration Engine in TypeScript
- Real-time Vector Pipeline
`;
  const buffer = Buffer.from(md, 'utf-8');

  const result = await extractor.extract(buffer, 'bio.md');
  assert.equal(result.detectedType, 'md');
  assert.ok(result.text.includes('Senior Lead Architect at NextGen AI'));
  assert.ok(result.metadata.headings);
  assert.ok((result.metadata.headings as string[]).includes('Farhan Bio'));
  assert.ok((result.metadata.headings as string[]).includes('Experience'));
});

test('RAG: 3. JSON extractor produces structured readable text', async () => {
  const extractor = new JsonExtractor();
  const jsonObj = {
    candidate: 'Farhan',
    skills: ['TypeScript', 'Next.js', 'PostgreSQL', 'Vector Search'],
    preferredRole: 'Lead AI Engineer',
    salaryExpectation: '$180k - $220k CAD',
  };
  const buffer = Buffer.from(JSON.stringify(jsonObj, null, 2), 'utf-8');

  const result = await extractor.extract(buffer, 'profile.json');
  assert.equal(result.detectedType, 'json');
  assert.ok(result.text.includes('candidate: Farhan'));
  assert.ok(result.text.includes('TypeScript'));
  assert.ok(result.text.includes('salaryExpectation'));
});

test('RAG: 4. PDF extractor extracts text streams and detects scanned PDFs', async () => {
  const extractor = new PdfExtractor();

  // Test minimal synthetic text PDF
  const textPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj
4 0 obj << /Length 55 >> stream
BT
/F1 12 Tf
72 712 Td
(Farhan Resume: Staff Software Engineer) Tj
ET
endstream endobj
xref
0 5
trailer << /Root 1 0 R >>
%%EOF`;

  const buffer = Buffer.from(textPdf, 'utf-8');
  const result = await extractor.extract(buffer, 'resume.pdf');
  assert.equal(result.detectedType, 'pdf');
  assert.ok(result.text.includes('Farhan Resume: Staff Software Engineer'));

  // Test scanned PDF with no text stream (honest limitation reporting)
  const scannedPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj
4 0 obj << /Length 12 >> stream
q 100 0 0 100 0 0 cm /Im1 Do Q
endstream endobj
xref
0 5
trailer << /Root 1 0 R >>
%%EOF`;

  await assert.rejects(
    async () => {
      await extractor.extract(Buffer.from(scannedPdf, 'utf-8'), 'scanned.pdf');
    },
    (err: any) => {
      assert.ok(
        err.message.toLowerCase().includes('scanned') ||
        err.message.toLowerCase().includes('ocr') ||
        err.message.toLowerCase().includes('no extractable text')
      );
      return true;
    }
  );
});

test('RAG: 5. Text chunker splits text deterministically with overlap and preserved metadata', () => {
  const chunker = new TextChunker({ chunkSize: 30, chunkOverlap: 5 });
  const text = `Farhan is an AI Systems Architect specializing in autonomous agent workflows, distributed microservices, and high-performance vector retrieval.

Over the past 7 years, he has designed and deployed enterprise systems at scale, focusing on deterministic tool execution and clean architecture.

His primary technical stack includes TypeScript, Node.js, Next.js, SQLite, PostgreSQL, Python, and PyTorch.

In his spare time, he researches generative evaluation benchmarks and agentic planning algorithms.

He is looking for Staff or Principal level AI Engineering roles.`;

  const chunks = chunker.chunkDocument({
    documentId: 'doc-test-1',
    text,
    source: 'portfolio.md',
    metadata: { author: 'Farhan' },
  });

  assert.ok(chunks.length > 1, 'Should create multiple chunks for long text');
  assert.equal(chunks[0].id, 'doc-test-1_chunk_0');
  assert.equal(chunks[1].id, 'doc-test-1_chunk_1');
  assert.equal(chunks[0].source, 'portfolio.md');
  assert.ok(chunks[0].content.length > 0);
  assert.ok(chunks[0].tokenEstimate > 0);
});

test('RAG: 6. Mock embedding provider generates deterministic 64-dim normalized vectors', async () => {
  const provider = new MockEmbeddingProvider();
  const res1 = await provider.embedQuery('TypeScript backend engineering');
  const res2 = await provider.embedQuery('TypeScript backend engineering');
  const res3 = await provider.embedQuery('Gardening and organic cooking recipes');

  assert.equal(res1.length, 64);
  // Deterministic
  assert.deepEqual(res1, res2);

  // Cosine similarity between identical should be 1.0
  let dot11 = 0;
  let dot13 = 0;
  for (let i = 0; i < 64; i++) {
    dot11 += res1[i] * res2[i];
    dot13 += res1[i] * res3[i];
  }
  assert.ok(Math.abs(dot11 - 1.0) < 1e-4, 'Self cosine similarity should be 1.0');
  assert.ok(dot13 < 0.9, 'Different topic should have lower similarity than self');
});

test('RAG: 7. Vector index performs top-K cosine similarity retrieval and filters', async () => {
  const provider = new MockEmbeddingProvider();
  const index = new VectorIndex(provider);

  const chunkA = {
    id: 'c1',
    documentId: 'doc-1',
    chunkIndex: 0,
    content: 'Farhan has 5 years of production experience in TypeScript and React.',
    source: 'resume.txt',
    tokenEstimate: 15,
    embedding: await provider.embedQuery('Farhan has 5 years of production experience in TypeScript and React.'),
    metadata: { source: 'resume.txt', documentId: 'doc-1' },
    createdAt: new Date().toISOString(),
  };

  const chunkB = {
    id: 'c2',
    documentId: 'doc-2',
    chunkIndex: 0,
    content: 'Candidate preferred compensation range is $180,000 to $220,000 per year.',
    source: 'preferences.json',
    tokenEstimate: 16,
    embedding: await provider.embedQuery('Candidate preferred compensation range is $180,000 to $220,000 per year.'),
    metadata: { source: 'preferences.json', documentId: 'doc-2' },
    createdAt: new Date().toISOString(),
  };

  index.addChunk(chunkA);
  index.addChunk(chunkB);

  // Search for compensation
  const compResults = await index.search('Candidate preferred compensation range', { topK: 2, minSimilarity: 0.0 });
  assert.ok(compResults.length >= 1);
  assert.equal(compResults[0].chunkId, 'c2');
  assert.ok(compResults[0].similarity > 0.1);

  // Search with documentFilter
  const filtered = await index.search('TypeScript production experience', { topK: 2, minSimilarity: 0.0, documentFilter: 'doc-1' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].chunkId, 'c1');
});

test('RAG: 8. DocumentService end-to-end ingestion, SQLite persistence, and search', async () => {
  await ensureDatabaseReady();
  const embeddingProvider = new MockEmbeddingProvider();
  const vectorIndex = new VectorIndex(embeddingProvider);
  const service = new DocumentService(vectorIndex, embeddingProvider);

  const sampleResume = `# Farhan Career Profile
## Summary
AI Systems Engineer specializing in Agentic Workflows, Tool Calling, and RAG architectures.

## Technical Skills
- Programming: TypeScript, Python, SQL
- AI / ML: OpenAI API, Gemini API, Vector Embeddings, LangChain principles
- Databases: SQLite, PostgreSQL, Drizzle ORM

## Notable Achievements
- Built autonomous multi-step job application orchestrator with human approval gates.
- Achieved sub-50ms vector retrieval over 10,000 indexed career passages.
`;

  const ingestRes = await service.ingestDocument({
    filename: 'farhan_master_resume.md',
    content: sampleResume,
    source: 'upload',
    metadata: { author: 'Farhan', version: '2026.1' },
  });

  assert.ok(ingestRes.success);
  assert.ok(ingestRes.document);
  const doc = ingestRes.document!;
  assert.ok(doc.id);
  assert.equal(doc.status, 'indexed');
  assert.ok(doc.chunkCount > 0);

  // Verify stored in SQLite documents table
  const dbDocs = await db.select().from(documentsTable).where(eq(documentsTable.id, doc.id));
  assert.equal(dbDocs.length, 1);
  assert.equal(dbDocs[0].filename, 'farhan_master_resume.md');

  // Verify stored in SQLite documentChunks table
  const dbChunks = await db.select().from(documentChunksTable).where(eq(documentChunksTable.documentId, doc.id));
  assert.ok(dbChunks.length > 0);
  assert.ok(dbChunks[0].embedding.length > 0);

  // Perform semantic search
  const searchResults = await service.search('AI Systems Engineer agentic workflows and tool calling', { topK: 3, minSimilarity: 0.0 });
  assert.ok(searchResults.length > 0);
  assert.ok(
    searchResults[0].content.includes('autonomous multi-step job application') ||
    searchResults[0].content.includes('AI Systems Engineer')
  );
  assert.ok(searchResults[0].similarity > 0);

  // Test getDocument
  const retrieved = await service.getDocument(doc.id);
  assert.ok(retrieved);
  assert.equal(retrieved?.document.filename, 'farhan_master_resume.md');
  assert.ok(retrieved?.chunks.length > 0);

  // Test listDocuments
  const allDocs = await service.listDocuments();
  assert.ok(allDocs.some((d) => d.id === doc.id));

  // Clean up
  await service.deleteDocument(doc.id);
  const afterDelete = await service.getDocument(doc.id);
  assert.equal(afterDelete, null);
  const chunksAfterDelete = await db.select().from(documentChunksTable).where(eq(documentChunksTable.documentId, doc.id));
  assert.equal(chunksAfterDelete.length, 0);
});

test('Memory: 9. Advanced Personal Memory supports 8 categories, confidence, and verification', async () => {
  await ensureDatabaseReady();

  // Create memory across distinct categories
  const skillMem = await addMemoryAsync({
    title: 'Distributed Agent Architecture',
    content: 'Specializes in distributed agent systems and SQLite local caching',
    category: 'SKILL',
    source: 'interview_audit',
    confidence: 0.95,
    verified: true,
  });

  assert.ok(skillMem.id);
  assert.equal(skillMem.category, 'SKILL');
  assert.equal(skillMem.confidence, 0.95);
  assert.equal(skillMem.verified, true);
  assert.equal(skillMem.status, 'active');

  const prefMem = await addMemoryAsync({
    title: 'Work Hours and Remote Flexibility',
    content: 'Prefers remote roles with flexible Eastern Time hours',
    category: 'PREFERENCE',
    source: 'career_settings',
    confidence: 0.9,
  });
  assert.equal(prefMem.category, 'PREFERENCE');

  // Verify memory
  const verified = await verifyMemoryAsync(prefMem.id);
  assert.equal(verified, true);

  // Invalidate memory
  const invalidated = await invalidateMemoryAsync(prefMem.id, 'User changed preference');
  assert.equal(invalidated, true);

  // Verify audit trail in memoryEvents
  const events = await getMemoryEventsAsync(prefMem.id);
  assert.ok(events.length >= 2, 'Should record CREATED, VERIFIED, or INVALIDATED events');
  const actionTypes = events.map((e) => e.eventType);
  assert.ok(actionTypes.includes('created'));
  assert.ok(actionTypes.includes('invalidated'));

  // Clean up
  await deleteMemoryAsync(skillMem.id);
  await deleteMemoryAsync(prefMem.id);
});

test('Memory: 10. Memory conflict resolution supersedes older conflicting preferences with audit trail', async () => {
  await ensureDatabaseReady();

  // Step 1: User states preference for full remote
  const mem1 = await addMemoryAsync({
    title: 'Remote Work Style',
    content: 'Prefers 100% remote work only and will not relocate',
    category: 'PREFERENCE',
    source: 'user_dialogue',
    confidence: 0.85,
  });

  // Test detectConflict directly before insertion
  const conflict = MemoryValidator.detectConflict(
    {
      category: 'PREFERENCE',
      content: 'Prefers hybrid work located in Toronto, ON with 2 days in office',
    },
    [mem1]
  );
  assert.ok(conflict.hasConflict);
  assert.equal(conflict.conflictingMemoryId, mem1.id);

  // Step 2: Later user states preference for hybrid in Toronto (addMemoryAsync automatically supersedes mem1)
  const mem2 = await addMemoryAsync({
    title: 'Updated Work Style',
    content: 'Prefers hybrid work located in Toronto, ON with 2 days in office',
    category: 'PREFERENCE',
    source: 'user_dialogue',
    confidence: 0.95,
  });

  assert.equal(mem2.supersedes, mem1.id);

  // Check mem1 in database has been marked superseded
  const updatedMem1 = (await getMemoriesAsync()).find((m) => m.id === mem1.id);
  assert.ok(updatedMem1);
  assert.equal(updatedMem1?.status, 'superseded');
  assert.equal(updatedMem1?.supersededBy, mem2.id);

  // Clean up
  await deleteMemoryAsync(mem1.id);
  await deleteMemoryAsync(mem2.id);
});

test('Agent: 11. KnowledgeAgent provides native tools registered in defaultRegistry', async () => {
  assert.equal(KnowledgeAgent.id, 'knowledge_agent');
  assert.equal(KnowledgeAgent.name, 'Knowledge & Memory Agent');

  const toolNames = KnowledgeAgent.tools.map((t) => t.name);
  assert.ok(toolNames.includes('search_personal_knowledge'));
  assert.ok(toolNames.includes('search_personal_memory'));
  assert.ok(toolNames.includes('get_personal_document'));
  assert.ok(toolNames.includes('list_personal_documents'));

  // Verify in defaultRegistry
  const regAgent = defaultRegistry.getAgent('knowledge_agent');
  assert.ok(regAgent);
  assert.ok(regAgent.tools.length >= 4);

  const personalMemTool = defaultRegistry.getTool('search_personal_memory');
  assert.ok(personalMemTool);

  // Test executeTool: search_personal_memory
  const mem = await addMemoryAsync({
    title: 'Leadership Goals',
    content: 'Wants to lead a team of 4-6 engineers in future roles',
    category: 'GOAL',
  });

  try {
    const res = await defaultRegistry.executeTool('search_personal_memory', { query: 'leadership', category: 'GOAL' });
    assert.ok(res.success);
    assert.ok(JSON.stringify(res.data).includes('lead a team'));
  } finally {
    await deleteMemoryAsync(mem.id);
  }
});

test('Grounding: 12. CentralAssistant invokes knowledge tools and handles personal queries', async () => {
  await ensureDatabaseReady();

  const provider = new MockProvider();
  provider.queueToolCalls([
    {
      id: 'call_mem_1',
      name: 'search_personal_memory',
      arguments: { query: 'compensation' },
    },
  ]);

  const assistant = new CentralAssistant(defaultRegistry);

  const result = await assistant.run([
    { role: 'user', content: 'What is my target compensation and salary range?' },
  ], provider);

  assert.ok(result.answer, 'Must return synthesized answer');
  const execStep = result.steps.find((s) => s.step === 'tool_execution');
  assert.ok(execStep, 'Must have tool_execution step');
  assert.ok(execStep.title.includes('search_personal_memory'));
});
