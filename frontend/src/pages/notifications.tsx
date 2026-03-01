import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { notificationsAPI } from '@/lib/api';
import { Card, Button, Loading, Badge, EmptyState } from '@/components/ui';
import {
  Bell, Check, CheckCheck, Trash2, Brain, Award, Map, MessageSquare, Settings, Info
} from 'lucide-react';
import toast from 'react-hot-toast';

const typeIcons: Record<string, any> = {
  quiz: Brain,
  certificate: Award,
  roadmap: Map,
  chat: MessageSquare,
  system: Settings,
};

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    loadNotifications();
  }, [user, authLoading]);

  const loadNotifications = async () => {
    try {
      const res = await notificationsAPI.list();
      setNotifications(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationsAPI.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  if (authLoading || loading) return <Loading text="Loading notifications..." />;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" icon={<CheckCheck className="w-4 h-4" />} onClick={handleMarkAllRead}>
            Mark All Read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-8 h-8 text-primary-500" />}
          title="No Notifications"
          description="You're all caught up! Notifications about quizzes, certificates, and updates will appear here."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const Icon = typeIcons[n.notification_type] || Info;
            return (
              <Card
                key={n.id}
                className={`${!n.is_read ? 'border-l-4 border-l-primary-500 bg-primary-50/30' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    !n.is_read ? 'bg-primary-100' : 'bg-gray-100'
                  }`}>
                    <Icon className={`w-5 h-5 ${!n.is_read ? 'text-primary-500' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${!n.is_read ? 'text-gray-800' : 'text-gray-600'}`}>
                      {n.title}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.is_read && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="p-1.5 rounded-lg hover:bg-primary-100 transition-smooth"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4 text-primary-500" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="p-1.5 rounded-lg hover:bg-red-100 transition-smooth"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
