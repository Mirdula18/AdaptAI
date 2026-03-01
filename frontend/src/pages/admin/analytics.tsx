import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { adminAPI } from '@/lib/api';
import { Card, Loading, Badge, Button } from '@/components/ui';
import { BarChart3, Download, TrendingUp, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';

const COLORS = ['#6C63FF', '#9680F2', '#B5A8F7', '#D4CCFB', '#EAE6FD'];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [quizStats, setQuizStats] = useState<any[]>([]);
  const [completionStats, setCompletionStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'instructor') router.push('/dashboard');
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [qRes, cRes] = await Promise.all([
        adminAPI.quizAnalytics(),
        adminAPI.completionStats(),
      ]);
      setQuizStats(qRes.data);
      setCompletionStats(cRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleExport = async () => {
    try {
      const res = await adminAPI.exportAttempts();
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'quiz_attempts.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch { toast.error('Export failed'); }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Quiz performance and course completion insights</p>
        </div>
        <Button variant="secondary" icon={<Download className="w-4 h-4" />} onClick={handleExport}>
          Export Attempts CSV
        </Button>
      </div>

      {/* Quiz Performance Chart */}
      {quizStats.length > 0 && (
        <Card>
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-500" /> Quiz Performance
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={quizStats.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="quiz_title" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #EAE6FD', fontSize: '13px' }} />
              <Bar dataKey="avg_score" fill="#6C63FF" radius={[6, 6, 0, 0]} name="Avg Score" />
              <Bar dataKey="max_score" fill="#B5A8F7" radius={[6, 6, 0, 0]} name="Max Score" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quiz Stats Table */}
        <Card>
          <h3 className="font-semibold text-gray-800 mb-4">Quiz Details</h3>
          {quizStats.length > 0 ? (
            <div className="space-y-3">
              {quizStats.map((q: any) => (
                <div key={q.quiz_id} className="flex items-center justify-between p-3 bg-surface-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{q.quiz_title}</p>
                    <p className="text-xs text-gray-400">{q.attempts} attempts</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={q.avg_score >= 60 ? 'success' : 'warning'}>Avg: {q.avg_score}%</Badge>
                    <p className="text-xs text-gray-400 mt-1">Range: {q.min_score}%-{q.max_score}%</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No quiz data yet</p>
          )}
        </Card>

        {/* Completion Stats */}
        <Card>
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-primary-500" /> Course Completion
          </h3>
          {completionStats.length > 0 ? (
            <div className="space-y-3">
              {completionStats.map((c: any) => (
                <div key={c.course_id} className="p-3 bg-surface-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">{c.course_title}</p>
                    <span className="text-xs text-gray-400">{c.enrolled} enrolled</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(c.completion_rate, 100)}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{c.completion_rate}% quiz participation</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No completion data yet</p>
          )}
        </Card>
      </div>
    </div>
  );
}
