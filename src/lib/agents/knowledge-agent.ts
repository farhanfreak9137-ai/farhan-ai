import { z } from 'zod';
import { Agent, AgentTool } from './types';
import { defaultDocumentService } from '../rag/document-service';
import { searchMemoriesAsync, MemoryCategorySchema } from '../memory';

export const KnowledgeAgent: Agent = {
  id: 'knowledge_agent',
  name: 'Knowledge & Memory Agent',
  description:
    "Manages Farhan's persistent personal knowledge base, ingested documents (CV, portfolio, case studies), and durable personal memories.",
  capabilities: [
    'semantic_document_retrieval',
    'personal_memory_retrieval',
    'document_inspection',
    'knowledge_management',
  ],
  tools: [
    {
      name: 'search_personal_knowledge',
      description:
        "Perform semantic vector retrieval across Farhan's personal documents, CV attachments, case studies, project notes, and portfolio to answer questions with verified private material and citations.",
      agentId: 'knowledge_agent',
      inputSchema: z.object({
        query: z.string().min(1).describe('The search query or question to retrieve personal knowledge for'),
        topK: z.number().int().min(1).max(10).optional().default(4).describe('Maximum number of relevant chunks to retrieve'),
        documentFilter: z.string().optional().describe('Optional document ID to restrict search to'),
        sourceFilter: z.string().optional().describe('Optional source filter (e.g. user_upload, cv_import)'),
        minSimilarity: z.number().min(0).max(1).optional().default(0.2).describe('Minimum cosine similarity threshold'),
      }),
      execute: async (input) => {
        try {
          const results = await defaultDocumentService.search(input.query, {
            topK: input.topK,
            documentFilter: input.documentFilter,
            sourceFilter: input.sourceFilter,
            minSimilarity: input.minSimilarity,
          });

          return {
            toolName: 'search_personal_knowledge',
            success: true,
            data: {
              query: input.query,
              results,
              count: results.length,
              retrievedAt: new Date().toISOString(),
            },
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Knowledge retrieval failed';
          return {
            toolName: 'search_personal_knowledge',
            success: false,
            error: msg,
          };
        }
      },
    },
    {
      name: 'search_personal_memory',
      description:
        "Search Farhan's persistent long-term memories, verified career preferences, target milestones, engineering philosophy, and interview takeaways.",
      agentId: 'knowledge_agent',
      inputSchema: z.object({
        query: z.string().min(1).describe('The memory topic or query to search for'),
        category: MemoryCategorySchema.optional().describe('Optional memory category (FACT, PREFERENCE, GOAL, PROJECT, SKILL, EXPERIENCE, CAREER_EVENT, CONVERSATION)'),
        verifiedOnly: z.boolean().optional().describe('If true, only returns memories explicitly verified by Farhan'),
        minConfidence: z.number().min(0).max(1).optional().describe('Minimum confidence threshold (0.0 to 1.0)'),
        topK: z.number().int().min(1).max(10).optional().default(5).describe('Maximum memories to return'),
      }),
      execute: async (input) => {
        try {
          const memories = await searchMemoriesAsync(input.query, {
            category: input.category,
            verifiedOnly: input.verifiedOnly,
            minConfidence: input.minConfidence,
            topK: input.topK,
          });

          return {
            toolName: 'search_personal_memory',
            success: true,
            data: {
              query: input.query,
              memories,
              count: memories.length,
              retrievedAt: new Date().toISOString(),
            },
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Memory retrieval failed';
          return {
            toolName: 'search_personal_memory',
            success: false,
            error: msg,
          };
        }
      },
    },
    {
      name: 'get_personal_document',
      description:
        "Retrieve metadata, content, and chunk breakdown for an ingested document in Farhan's knowledge base by ID.",
      agentId: 'knowledge_agent',
      inputSchema: z.object({
        documentId: z.string().min(1).describe('The unique ID of the document to inspect'),
      }),
      execute: async (input) => {
        try {
          const result = await defaultDocumentService.getDocument(input.documentId);
          if (!result) {
            return {
              toolName: 'get_personal_document',
              success: false,
              error: `Document with ID '${input.documentId}' not found.`,
            };
          }

          return {
            toolName: 'get_personal_document',
            success: true,
            data: {
              document: result.document,
              chunks: result.chunks,
              totalChunks: result.chunks.length,
            },
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to retrieve document';
          return {
            toolName: 'get_personal_document',
            success: false,
            error: msg,
          };
        }
      },
    },
    {
      name: 'list_personal_documents',
      description:
        "List all ingested documents in Farhan's knowledge base along with their status, file size, and chunk counts.",
      agentId: 'knowledge_agent',
      inputSchema: z.object({
        type: z.string().optional().describe('Filter by document type (e.g. cv, md, txt, pdf)'),
        status: z.string().optional().describe('Filter by indexing status (e.g. indexed, unindexed)'),
      }),
      execute: async (input) => {
        try {
          const documents = await defaultDocumentService.listDocuments(input);
          return {
            toolName: 'list_personal_documents',
            success: true,
            data: {
              documents,
              total: documents.length,
            },
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to list documents';
          return {
            toolName: 'list_personal_documents',
            success: false,
            error: msg,
          };
        }
      },
    },
    {
      name: 'summarize_local_document',
      description: "Reads and extracts text from any local PDF, DOCX, Markdown, or text file on Farhan's PC and provides structured study notes, key formulas, takeaways, and chapter summaries.",
      agentId: 'knowledge_agent',
      inputSchema: z.object({
        filePath: z.string().describe('Path to local document (e.g. "%DOWNLOADS%/notes.pdf" or "C:/Users/.../assignment.pdf")'),
        focusArea: z.string().optional().describe('Specific focus area (e.g. "key formulas", "exam review", "architecture highlights")'),
      }),
      execute: async (input) => {
        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          const os = await import('os');
          
          let expanded = input.filePath
            .replace(/%USERPROFILE%/gi, os.homedir())
            .replace(/%DOWNLOADS%/gi, path.join(os.homedir(), 'Downloads'))
            .replace(/%DOCUMENTS%/gi, path.join(os.homedir(), 'Documents'))
            .replace(/%DESKTOP%/gi, path.join(os.homedir(), 'Desktop'));
          expanded = path.normalize(expanded);

          const buffer = await fs.readFile(expanded);
          const ext = path.extname(expanded).toLowerCase();

          let textContent = '';
          if (ext === '.pdf') {
            const { PdfExtractor } = await import('../rag/extractors/pdf');
            const extractor = new PdfExtractor();
            const extracted = await extractor.extract(buffer, path.basename(expanded));
            textContent = extracted.text;
          } else {
            textContent = buffer.toString('utf-8');
          }

          const wordCount = textContent.split(/\s+/).filter(Boolean).length;
          const snippet = textContent.slice(0, 3000);

          return {
            toolName: 'summarize_local_document',
            success: true,
            data: {
              filePath: expanded,
              fileType: ext,
              totalWords: wordCount,
              sampleText: snippet,
              focusArea: input.focusArea || 'General overview',
              summaryInstructions: 'Document text extracted successfully. Synthesize comprehensive bulleted takeaways, definitions, and formulas.',
            },
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            toolName: 'summarize_local_document',
            success: false,
            error: `Failed summarizing document: ${msg}`,
          };
        }
      },
    },
  ],
};
