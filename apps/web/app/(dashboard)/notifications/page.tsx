'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { Badge } from '@linea/ui/components/badge';
import { Skeleton } from '@linea/ui/components/skeleton';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const { getToken } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const data = await api.get<Notification[]>('/notifications');
      setNotifications(data);
    } catch {
      // endpoint not yet available — show empty state
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function markAllRead() {
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* ignore */ }
  }

  async function markRead(id: string) {
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    } catch { /* ignore */ }
  }

  async function deleteNotif(id: string) {
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch { /* ignore */ }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Notifications</h1>
          {unreadCount > 0 && <Badge>{unreadCount} unread</Badge>}
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={() => void markAllRead()}>
            Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notifications.</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={['flex gap-3 px-4 py-3 transition-colors', !n.read ? 'bg-muted/30' : ''].join(' ')}
            >
              {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
              {n.read && <span className="mt-1.5 size-2 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className={['text-sm', !n.read ? 'font-medium' : ''].join(' ')}>{n.title}</p>
                {n.body && <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>}
                <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {!n.read && (
                  <Button size="sm" variant="ghost" onClick={() => void markRead(n.id)}>
                    Read
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => void deleteNotif(n.id)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
