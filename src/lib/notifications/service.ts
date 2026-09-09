// src/lib/notifications/service.ts
import { db, ensureDatabaseReady } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { AppNotification, CreateNotificationInput } from './types';

export class NotificationService {
  /**
   * Creates and persists a notification in SQLite.
   */
  async createNotification(input: CreateNotificationInput): Promise<AppNotification> {
    await ensureDatabaseReady();
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    await db.insert(notifications).values({
      id,
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data || null,
      read: 0,
      createdAt,
    });

    return {
      id,
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data || null,
      read: false,
      createdAt,
    };
  }

  /**
   * Lists notifications, optionally filtering by unread and limiting count.
   */
  async listNotifications(options: { unreadOnly?: boolean; limit?: number } = {}): Promise<AppNotification[]> {
    await ensureDatabaseReady();
    const limit = Math.min(options.limit || 50, 100);

    let query = db.select().from(notifications);

    const rows = await query.orderBy(desc(notifications.createdAt)).limit(limit);

    let filtered = rows;
    if (options.unreadOnly) {
      filtered = rows.filter((r) => r.read === 0);
    }

    return filtered.map((r) => ({
      id: r.id,
      type: r.type as any,
      title: r.title,
      message: r.message,
      data: r.data as any,
      read: r.read === 1,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Marks a notification as read.
   */
  async markRead(id: string): Promise<boolean> {
    await ensureDatabaseReady();
    const res = await db
      .update(notifications)
      .set({ read: 1 })
      .where(eq(notifications.id, id));

    return true;
  }

  /**
   * Marks all notifications as read.
   */
  async markAllRead(): Promise<boolean> {
    await ensureDatabaseReady();
    await db.update(notifications).set({ read: 1 });
    return true;
  }
}

export const notificationService = new NotificationService();
