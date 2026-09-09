// src/lib/notifications/types.ts

export type NotificationType = 'INFO' | 'SUCCESS' | 'WARNING' | 'APPROVAL_REQUIRED' | 'ERROR';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}
