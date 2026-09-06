import { ApplicationItem, ApplicationStatus } from '@/types/tracker';
import { db, ensureDatabaseReady } from '@/lib/db';
import { applications } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

// Default initial records for instant synchronous access
let cachedApplications: ApplicationItem[] = [
  {
    id: 'app-1',
    company: 'Nexus Cognitive Lab',
    role: 'Senior AI Systems Engineer',
    location: 'Remote (Worldwide)',
    workModel: 'remote',
    status: 'interviewing',
    matchScore: 94,
    salaryRange: '$145,000 - $180,000 USD',
    notes: 'Completed initial architectural discussion. Next step: Deep dive on agent tool calling and error failovers.',
    proposalDraft: 'Tailored proposal highlighting 45% latency reduction and multi-provider failovers submitted.',
    appliedDate: '2026-09-08',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'app-2',
    company: 'Hyperion AI',
    role: 'Staff Agentic Systems Developer',
    location: 'Remote (Worldwide)',
    workModel: 'remote',
    status: 'saved',
    matchScore: 91,
    salaryRange: '$160,000 - $210,000 USD',
    notes: 'Identified strong alignment with Python, TypeScript, and RAG context injection.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'app-3',
    company: 'Apex Cloud Platforms',
    role: 'Full-Stack Software Architect',
    location: 'Remote (US/EU)',
    workModel: 'remote',
    status: 'applied',
    matchScore: 88,
    salaryRange: '$135,000 - $165,000 USD',
    notes: 'Submitted resume highlighting Next.js App Router migrations.',
    appliedDate: '2026-09-05',
    updatedAt: new Date().toISOString(),
  },
];

let isAppsLoaded = false;
let appsLoadPromise: Promise<void> | null = null;

function mapRowToItem(r: typeof applications.$inferSelect): ApplicationItem {
  return {
    id: r.id,
    company: r.company,
    role: r.role,
    location: r.location,
    workModel: r.workModel as 'remote' | 'hybrid' | 'on-site',
    status: r.status as ApplicationStatus,
    matchScore: r.matchScore,
    salaryRange: r.salaryRange ?? undefined,
    notes: r.notes ?? undefined,
    proposalDraft: r.proposalDraft ?? undefined,
    appliedDate: r.appliedDate ?? undefined,
    updatedAt: r.updatedAt,
  };
}

/**
 * Ensures cached applications are synchronized from SQLite database without race conditions.
 */
export async function ensureApplicationsLoaded(): Promise<void> {
  if (isAppsLoaded) return;
  if (!appsLoadPromise) {
    appsLoadPromise = (async () => {
      try {
        await ensureDatabaseReady();
        const rows = await db.select().from(applications).orderBy(desc(applications.updatedAt));
        if (rows.length > 0) {
          cachedApplications = rows.map(mapRowToItem);
        }
      } catch (err) {
        console.error('Error rehydrating applications from SQLite:', err);
      } finally {
        isAppsLoaded = true;
      }
    })();
  }
  return appsLoadPromise;
}

export function getApplications(): ApplicationItem[] {
  return [...cachedApplications];
}

export function getApplicationsSync(): ApplicationItem[] {
  return [...cachedApplications];
}

export async function getApplicationsAsync(): Promise<ApplicationItem[]> {
  await ensureApplicationsLoaded();
  return getApplications();
}

export function addApplication(app: Omit<ApplicationItem, 'id' | 'updatedAt'>): ApplicationItem {
  const newApp: ApplicationItem = {
    ...app,
    id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    updatedAt: new Date().toISOString(),
  };

  cachedApplications.unshift(newApp);

  ensureDatabaseReady()
    .then(async () => {
      await db.insert(applications).values({
        id: newApp.id,
        company: newApp.company,
        role: newApp.role,
        location: newApp.location,
        workModel: newApp.workModel,
        status: newApp.status,
        matchScore: newApp.matchScore,
        salaryRange: newApp.salaryRange ?? null,
        notes: newApp.notes ?? null,
        proposalDraft: newApp.proposalDraft ?? null,
        appliedDate: newApp.appliedDate ?? null,
        updatedAt: newApp.updatedAt,
      });
    })
    .catch((err) => {
      console.error('Failed to persist application to SQLite:', err);
    });

  return newApp;
}

export async function addApplicationAsync(
  app: Omit<ApplicationItem, 'id' | 'updatedAt'>
): Promise<ApplicationItem> {
  await ensureApplicationsLoaded();
  const newApp: ApplicationItem = {
    ...app,
    id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    updatedAt: new Date().toISOString(),
  };

  await db.insert(applications).values({
    id: newApp.id,
    company: newApp.company,
    role: newApp.role,
    location: newApp.location,
    workModel: newApp.workModel,
    status: newApp.status,
    matchScore: newApp.matchScore,
    salaryRange: newApp.salaryRange ?? null,
    notes: newApp.notes ?? null,
    proposalDraft: newApp.proposalDraft ?? null,
    appliedDate: newApp.appliedDate ?? null,
    updatedAt: newApp.updatedAt,
  });

  cachedApplications.unshift(newApp);
  return newApp;
}

export function updateApplicationStatus(id: string, status: ApplicationStatus): ApplicationItem | null {
  const index = cachedApplications.findIndex((a) => a.id === id);
  if (index === -1) return null;

  const updatedAt = new Date().toISOString();
  cachedApplications[index] = {
    ...cachedApplications[index],
    status,
    updatedAt,
  };

  const updated = cachedApplications[index];

  ensureDatabaseReady()
    .then(async () => {
      await db.update(applications).set({ status, updatedAt }).where(eq(applications.id, id));
    })
    .catch((err) => {
      console.error('Failed to update application in SQLite:', err);
    });

  return updated;
}

export async function updateApplicationStatusAsync(
  id: string,
  status: ApplicationStatus
): Promise<ApplicationItem | null> {
  await ensureApplicationsLoaded();
  const updatedAt = new Date().toISOString();

  await db.update(applications).set({ status, updatedAt }).where(eq(applications.id, id));

  const updatedRows = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
  if (updatedRows.length === 0) return null;

  const updated = mapRowToItem(updatedRows[0]);
  cachedApplications = cachedApplications.map((a) => (a.id === id ? updated : a));
  return updated;
}

export function deleteApplication(id: string): boolean {
  const initialLength = cachedApplications.length;
  cachedApplications = cachedApplications.filter((a) => a.id !== id);
  const deleted = cachedApplications.length < initialLength;

  if (deleted) {
    ensureDatabaseReady()
      .then(async () => {
        await db.delete(applications).where(eq(applications.id, id));
      })
      .catch((err) => {
        console.error('Failed to delete application from SQLite:', err);
      });
  }

  return deleted;
}

export async function deleteApplicationAsync(id: string): Promise<boolean> {
  await ensureApplicationsLoaded();
  const beforeCount = (await db.select().from(applications).where(eq(applications.id, id))).length;
  if (beforeCount === 0) return false;

  await db.delete(applications).where(eq(applications.id, id));
  cachedApplications = cachedApplications.filter((a) => a.id !== id);
  return true;
}
