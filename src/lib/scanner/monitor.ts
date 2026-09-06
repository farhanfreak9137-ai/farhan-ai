import { OpportunityItem } from '@/types/tools';
import { executeDiscoverOpportunities } from '../tools/registry';
import { db, ensureDatabaseReady } from '@/lib/db';
import { monitoredAlerts } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export interface MonitoredAlert {
  id: string;
  opportunity: OpportunityItem;
  detectedAt: string;
  status: 'new' | 'viewed' | 'dismissed';
}

let cachedAlerts: MonitoredAlert[] = [
  {
    id: 'alert-1',
    opportunity: {
      id: 'opp-auto-1',
      title: 'Principal Agentic Systems Architect',
      company: 'Aether Cognitive Labs',
      location: 'Remote (Worldwide)',
      workModel: 'remote',
      salaryRange: '$170,000 - $220,000 USD',
      matchScore: 96,
      matchReason: 'Direct match for TypeScript, LLM Orchestration, and Autonomous Agent Architecture.',
      requiredSkills: ['TypeScript', 'LLM Orchestration', 'Multi-Model Fallbacks', 'PostgreSQL'],
      description: 'Lead engineering for self-healing agent pipelines and enterprise autonomous developer tools.',
      postedAt: 'Just now',
    },
    detectedAt: new Date().toISOString(),
    status: 'new',
  },
];

let isAlertsLoaded = false;
let alertsLoadPromise: Promise<void> | null = null;

function mapRowToAlert(r: typeof monitoredAlerts.$inferSelect): MonitoredAlert {
  let oppData: any = {};
  try {
    oppData = typeof r.opportunityData === 'string' ? JSON.parse(r.opportunityData) : r.opportunityData;
  } catch (e) {
    console.error('Failed to parse opportunityData JSON:', e);
  }

  return {
    id: r.id,
    opportunity: oppData,
    detectedAt: r.detectedAt,
    status: r.status as 'new' | 'viewed' | 'dismissed',
  };
}

/**
 * Ensures cached alerts are synchronized from SQLite database without race conditions.
 */
export async function ensureAlertsLoaded(): Promise<void> {
  if (isAlertsLoaded) return;
  if (!alertsLoadPromise) {
    alertsLoadPromise = (async () => {
      try {
        await ensureDatabaseReady();
        const rows = await db.select().from(monitoredAlerts).orderBy(desc(monitoredAlerts.detectedAt));
        if (rows.length > 0) {
          cachedAlerts = rows.map(mapRowToAlert);
        }
      } catch (err) {
        console.error('Error rehydrating alerts from SQLite:', err);
      } finally {
        isAlertsLoaded = true;
      }
    })();
  }
  return alertsLoadPromise;
}

export function getMonitoredAlerts(): MonitoredAlert[] {
  return [...cachedAlerts];
}

export function getMonitoredAlertsSync(): MonitoredAlert[] {
  return [...cachedAlerts];
}

export async function getMonitoredAlertsAsync(): Promise<MonitoredAlert[]> {
  await ensureAlertsLoaded();
  return getMonitoredAlerts();
}

/**
 * Runs a background opportunity scan against live criteria and persists new alerts to SQLite.
 */
export async function runOpportunityScan(minMatchThreshold = 85): Promise<{
  newAlertsCount: number;
  alerts: MonitoredAlert[];
}> {
  await ensureAlertsLoaded();
  const currentAlerts = [...cachedAlerts];

  const result = await executeDiscoverOpportunities({ workModel: 'remote' });
  const opps: OpportunityItem[] = (result.data as any)?.opportunities || [];

  const qualified = opps.filter((o) => o.matchScore >= minMatchThreshold);
  let newlyAdded = 0;

  for (const q of qualified) {
    const exists = currentAlerts.some((a) => a.opportunity.id === q.id || a.opportunity.title === q.title);
    if (!exists) {
      const newAlertId = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();

      const newAlert: MonitoredAlert = {
        id: newAlertId,
        opportunity: q,
        detectedAt: now,
        status: 'new',
      };

      cachedAlerts.unshift(newAlert);

      await db
        .insert(monitoredAlerts)
        .values({
          id: newAlertId,
          opportunityId: q.id,
          opportunityData: q,
          status: 'new',
          detectedAt: now,
        })
        .catch((err) => {
          console.error('Failed to persist monitored alert to SQLite:', err);
        });

      newlyAdded++;
    }
  }

  return {
    newAlertsCount: newlyAdded,
    alerts: [...cachedAlerts],
  };
}

export function dismissAlert(id: string): boolean {
  const idx = cachedAlerts.findIndex((a) => a.id === id);
  if (idx !== -1) {
    cachedAlerts[idx] = { ...cachedAlerts[idx], status: 'dismissed' };

    ensureDatabaseReady()
      .then(async () => {
        await db.update(monitoredAlerts).set({ status: 'dismissed' }).where(eq(monitoredAlerts.id, id));
      })
      .catch((err) => {
        console.error('Failed to update dismissed alert in SQLite:', err);
      });

    return true;
  }
  return false;
}

export async function dismissAlertAsync(id: string): Promise<boolean> {
  await ensureAlertsLoaded();
  const before = await db.select().from(monitoredAlerts).where(eq(monitoredAlerts.id, id));
  if (before.length === 0) return false;

  await db.update(monitoredAlerts).set({ status: 'dismissed' }).where(eq(monitoredAlerts.id, id));
  cachedAlerts = cachedAlerts.map((a) => (a.id === id ? { ...a, status: 'dismissed' as const } : a));
  return true;
}
