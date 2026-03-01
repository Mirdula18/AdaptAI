import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { adminAPI } from '@/lib/api';
import { Card, Loading, Badge, DataTable } from '@/components/ui';
import { Shield, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AuditLogsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (user && user.role !== 'admin') router.push('/dashboard');
    loadLogs();
  }, [user, filter]);

  const loadLogs = async () => {
    try {
      const params: any = { per_page: 100 };
      if (filter) params.resource_type = filter;
      const res = await adminAPI.auditLogs(params);
      setLogs(res.data.items || []);
    } catch { toast.error('Failed to load audit logs'); }
    finally { setLoading(false); }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary-500" /> Audit Logs
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track all platform actions</p>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm">
          <option value="">All Resources</option>
          <option value="user">Users</option>
          <option value="course">Courses</option>
          <option value="quiz">Quizzes</option>
          <option value="material">Materials</option>
          <option value="roadmap">Roadmaps</option>
          <option value="license">License</option>
        </select>
      </div>

      <DataTable
        columns={[
          {
            key: 'timestamp', title: 'Time',
            render: (log: any) => <span className="text-xs">{new Date(log.timestamp).toLocaleString()}</span>,
          },
          { key: 'username', title: 'User', render: (log: any) => log.username || 'System' },
          {
            key: 'action', title: 'Action',
            render: (log: any) => <Badge variant="primary">{log.action}</Badge>,
          },
          { key: 'resource_type', title: 'Resource', render: (log: any) => <span className="capitalize">{log.resource_type || '—'}</span> },
          { key: 'details', title: 'Details', render: (log: any) => <span className="text-xs text-gray-500 truncate max-w-[200px] block">{log.details || '—'}</span> },
          { key: 'ip_address', title: 'IP', render: (log: any) => <span className="text-xs text-gray-400">{log.ip_address || '—'}</span> },
        ]}
        data={logs}
      />
    </div>
  );
}
