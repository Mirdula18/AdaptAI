import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { analyticsAPI, quizzesAPI } from '@/lib/api';
import { Card, Loading, Badge } from '@/components/ui';
import { BarChart3, Trophy, TrendingUp, Brain } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import toast from 'react-hot-toast';

export default function ProgressPage() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [progRes, lbRes, attRes] = await Promise.all([
        analyticsAPI.studentProgress(),
        analyticsAPI.leaderboard(),
        quizzesAPI.myAttempts({ per_page: 20 }),
      ]);
      setProgress(progRes.data);
      setLeaderboard(lbRes.data);
      setAttempts(attRes.data.items || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <Loading />;

  const chartData = attempts.map((a: any, idx: number) => ({
    attempt: idx + 1,
    score: a.score,
    date: new Date(a.started_at).toLocaleDateString(),
  })).reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">My Progress</h1>
        <p className="text-sm text-gray-500 mt-1">Track your learning journey</p>
      </div>

      {/* Score Chart */}
      {chartData.length > 0 && (
        <Card>
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-500" /> Score History
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #EAE6FD', fontSize: '13px' }}
              />
              <Line type="monotone" dataKey="score" stroke="#6C63FF" strokeWidth={2.5} dot={{ fill: '#6C63FF', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Attempts */}
        <Card>
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary-500" /> Recent Attempts
          </h3>
          {attempts.length > 0 ? (
            <div className="space-y-2">
              {attempts.slice(0, 10).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-surface-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Score: {a.score}% ({a.correct_answers}/{a.total_questions})
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(a.started_at).toLocaleString()}
                      {a.duration_seconds && ` • ${Math.floor(a.duration_seconds / 60)}m ${a.duration_seconds % 60}s`}
                    </p>
                  </div>
                  <Badge variant={a.score >= 80 ? 'success' : a.score >= 60 ? 'warning' : 'danger'}>
                    {a.score}%
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No attempts yet</p>
          )}
        </Card>

        {/* Leaderboard */}
        <Card>
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" /> Leaderboard
          </h3>
          {leaderboard.length > 0 ? (
            <div className="space-y-2">
              {leaderboard.map((l: any, idx: number) => (
                <div key={l.user_id} className="flex items-center justify-between p-3 bg-surface-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      idx === 0 ? 'bg-amber-100 text-amber-600' :
                      idx === 1 ? 'bg-gray-100 text-gray-600' :
                      idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-primary-50 text-primary-600'
                    }`}>
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {l.full_name} {l.user_id === user?.id && <Badge variant="primary">You</Badge>}
                      </p>
                      <p className="text-xs text-gray-400">{l.attempts} attempts</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-primary-600">{l.avg_score}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No data yet</p>
          )}
        </Card>
      </div>
    </div>
  );
}
