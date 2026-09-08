import { z } from 'zod';
import { Agent } from './types';
import { getMemories, addMemoryAsync } from '../memory/store';

export const MemoryAgent: Agent = {
  id: 'memory_agent',
  name: 'Memory Agent',
  description: "Manages Farhan's long-term contextual memory, career reflections, and interview notes in persistent storage.",
  capabilities: ['memory_retrieval', 'memory_storage', 'context_persistence'],
  tools: [
    {
      name: 'get_memories',
      description: "Retrieve Farhan's saved long-term career notes, negotiation goals, reflections, and interview feedback from the persistent database.",
      agentId: 'memory_agent',
      inputSchema: z.object({}),
      execute: async () => {
        const list = getMemories();
        return {
          toolName: 'get_memories',
          success: true,
          data: list,
        };
      },
    },
    {
      name: 'save_memory',
      description: "Save a new career reflection, interview note, goal, or preference into Farhan's persistent long-term memory.",
      agentId: 'memory_agent',
      inputSchema: z.object({
        title: z.string().min(1).describe('Brief memory title or subject'),
        content: z.string().min(1).describe('Detailed note, preference, or goal to remember'),
        category: z.enum(['interview_feedback', 'career_reflection', 'negotiation_goal', 'recruiter_note']).optional().default('career_reflection'),
      }),
      execute: async (input) => {
        const created = await addMemoryAsync({
          title: input.title,
          content: input.content,
          category: input.category || 'career_reflection',
        });
        return {
          toolName: 'save_memory',
          success: true,
          data: created,
        };
      },
    },
  ],
};

export const memoryAgent = MemoryAgent;

