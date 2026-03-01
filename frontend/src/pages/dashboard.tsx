import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { adminAPI, analyticsAPI, coursesAPI, quizzesAPI } from '@/lib/api';
import { StatCard, Card, Loading, Button, Badge } from '@/components/ui';
import { BookOpen, Users, Brain, BarChart3, Map, Trophy, ArrowRight, Plus, Flame, Award, CheckSquare } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    loadData();
  }, [user, authLoading]);

  const loadData = async () => {
    try {
      if (user?.role === 'admin' || user?.role === 'instructor') {
        const [dashRes, instrRes] = await Promise.all([
          adminAPI.dashboard(),
          analyticsAPI.instructorDashboard().catch(() => null),
        ]);
        setStats({ ...dashRes.data, ...(instrRes?.data || {}) });
      }
      if (user?.role === 'student') {
        const res = await analyticsAPI.studentProgress();
        setProgress(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) return <Loading text="Loading dashboard..." />;
  if (!user) return null;

  // Admin/Instructor Dashboard
  if (user.role === 'admin' || user.role === 'instructor') {
    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Welcome back, {user.full_name}</h1>
            <p className="text-sm text-gray-500 mt-1">Here's what's happening with your platform</p>
          </div>
          <div className="flex gap-3">
            <Link href="/courses">
              <Button variant="secondary" icon={<Plus className="w-4 h-4" />} size="sm">New Course</Button>
            </Link>
            <Link href="/quizzes">
              <Button icon={<Brain className="w-4 h-4" />} size="sm">Generate Quiz</Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard title="Total Students" value={stats.total_students} icon={<Users className="w-6 h-6 text-primary-500" />} />
              <StatCard title="Published Courses" value={stats.published_courses || stats.total_courses || 0} icon={<BookOpen className="w-6 h-6 text-primary-500" />} />
              <StatCard title="Total Quizzes" value={stats.total_quizzes} icon={<Brain className="w-6 h-6 text-primary-500" />} />
              <StatCard title="Avg. Score" value={`${stats.avg_quiz_score || stats.avg_score || 0}%`} icon={<BarChart3 className="w-6 h-6 text-primary-500" />} />
              <StatCard title="Pending Approvals" value={stats.pending_approvals || 0} icon={<CheckSquare className="w-6 h-6 text-amber-500" />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h3 className="font-semibold text-gray-800 mb-4">Platform Overview</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-500">Total Attempts</span>
                    <span className="font-semibold">{stats.total_attempts}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-500">Pass Rate</span>
                    <Badge variant={(stats.pass_rate || 0) >= 60 ? 'success' : 'warning'}>{stats.pass_rate || 0}%</Badge>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-500">Total Materials</span>
                    <span className="font-semibold">{stats.total_materials}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-500">Active Roadmaps</span>
                    <span className="font-semibold">{stats.total_roadmaps}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-500">Instructors</span>
                    <span className="font-semibold">{stats.total_instructors}</span>
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="font-semibold text-gray-800 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Link href="/courses" className="flex items-center justify-between p-3 rounded-xl hover:bg-primary-50 transition-smooth">
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-5 h-5 text-primary-500" />
                      <span className="text-sm font-medium">Manage Courses</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </Link>
                  <Link href="/approvals" className="flex items-center justify-between p-3 rounded-xl hover:bg-primary-50 transition-smooth">
                    <div className="flex items-center gap-3">
                      <CheckSquare className="w-5 h-5 text-amber-500" />
                      <span className="text-sm font-medium">Review Pending Quizzes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(stats.pending_approvals || 0) > 0 && (
                        <Badge variant="warning">{stats.pending_approvals}</Badge>
                      )}
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </Link>
                  <Link href="/materials" className="flex items-center justify-between p-3 rounded-xl hover:bg-primary-50 transition-smooth">
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-5 h-5 text-primary-500" />
                      <span className="text-sm font-medium">Upload Materials</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </Link>
                  <Link href="/admin/users" className="flex items-center justify-between p-3 rounded-xl hover:bg-primary-50 transition-smooth">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-primary-500" />
                      <span className="text-sm font-medium">View Users</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </Link>
                  <Link href="/admin/analytics" className="flex items-center justify-between p-3 rounded-xl hover:bg-primary-50 transition-smooth">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="w-5 h-5 text-primary-500" />
                      <span className="text-sm font-medium">View Analytics</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </Link>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    );
  }

  // Student Dashboard
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Welcome, {user.full_name}!</h1>
          <p className="text-sm text-gray-500 mt-1">Continue your learning journey</p>
        </div>
        {progress && progress.current_streak > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-xl">
            <Flame className="w-5 h-5 text-orange-500" />
            <span className="text-sm font-semibold text-orange-700">{progress.current_streak} day streak!</span>
          </div>
        )}
      </div>

      {progress && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard title="Quiz Attempts" value={progress.total_attempts} icon={<Brain className="w-6 h-6 text-primary-500" />} />
            <StatCard title="Avg. Score" value={`${progress.avg_score}%`} icon={<BarChart3 className="w-6 h-6 text-primary-500" />} />
            <StatCard title="Enrolled Courses" value={progress.enrolled_courses?.length || 0} icon={<BookOpen className="w-6 h-6 text-primary-500" />} />
            <StatCard title="Active Roadmaps" value={progress.active_roadmaps?.length || 0} icon={<Map className="w-6 h-6 text-primary-500" />} />
            <StatCard title="Certificates" value={progress.certificates_earned || 0} icon={<Award className="w-6 h-6 text-purple-500" />} />
          </div>

          {/* Streak Calendar Mini */}
          {progress.streak_dates?.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <h3 className="font-semibold text-gray-800">Activity Streak</h3>
                </div>
                <Link href="/profile" className="text-xs text-primary-500 font-medium">View Full Profile</Link>
              </div>
              <div className="flex flex-wrap gap-1">
                {(() => {
                  const streakSet = new Set(progress.streak_dates);
                  const today = new Date();
                  const days = [];
                  for (let i = 29; i >= 0; i--) {
                    const d = new Date(today);
                    d.setDate(d.getDate() - i);
                    const key = d.toISOString().split('T')[0];
                    days.push({ date: key, active: streakSet.has(key) });
                  }
                  return days.map((day) => (
                    <div key={day.date} title={day.date}
                      className={`w-4 h-4 rounded-sm ${day.active ? 'bg-primary-500' : 'bg-gray-100'}`} />
                  ));
                })()}
              </div>
              <p className="text-xs text-gray-400 mt-2">Last 30 days</p>
            </Card>
          )}

          {/* Score Trend Chart */}
          {progress.score_trend?.length > 0 && (
            <Card>
              <h3 className="font-semibold text-gray-800 mb-4">Score Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={progress.score_trend.map((s: number, i: number) => ({ attempt: i + 1, score: s }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="attempt" label={{ value: 'Attempt', position: 'insideBottom', offset: -5 }} />
                  <YAxis domain={[0, 100]} label={{ value: 'Score %', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#6C63FF" strokeWidth={2} dot={{ fill: '#6C63FF' }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Attempts */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">Recent Quiz Attempts</h3>
                <Link href="/quizzes" className="text-xs text-primary-500 font-medium">View All</Link>
              </div>
              {progress.recent_attempts?.length > 0 ? (
                <div className="space-y-3">
                  {progress.recent_attempts.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between p-3 bg-surface-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Quiz Attempt</p>
                        <p className="text-xs text-gray-400">{new Date(a.started_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.passed && <Award className="w-4 h-4 text-green-500" />}
                        <Badge variant={a.score >= 70 ? 'success' : 'warning'}>{a.score}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No attempts yet. Take a quiz to get started!</p>
              )}
            </Card>

            {/* Enrolled Courses */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">My Courses</h3>
                <Link href="/courses" className="text-xs text-primary-500 font-medium">Browse Courses</Link>
              </div>
              {progress.enrolled_courses?.length > 0 ? (
                <div className="space-y-3">
                  {progress.enrolled_courses.map((c: any) => (
                    <Link key={c.id} href={`/courses/${c.id}`} className="flex items-center justify-between p-3 bg-surface-50 rounded-xl hover:bg-primary-50 transition-smooth">
                      <div>
                        <p className="text-sm font-medium text-gray-700">{c.title}</p>
                        <p className="text-xs text-gray-400">{c.estimated_duration || 'Self-paced'}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No courses enrolled. Browse and enroll now!</p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
