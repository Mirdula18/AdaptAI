import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { authAPI, certificatesAPI } from '@/lib/api';
import { Card, Button, Loading, Badge, Input, TextArea, Modal } from '@/components/ui';
import {
  User, Mail, Calendar, Trophy, BookOpen, Brain, Map, Award,
  Flame, Edit3, Download, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, loading: authLoading, updateUser } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', bio: '', avatar_url: '' });
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' });
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    loadProfile();
  }, [user, authLoading]);

  const loadProfile = async () => {
    try {
      const res = await authAPI.getProfile();
      setProfile(res.data);
      setForm({
        full_name: res.data.full_name || '',
        email: res.data.email || '',
        bio: res.data.bio || '',
        avatar_url: res.data.avatar_url || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateUser(form);
      toast.success('Profile updated!');
      setEditMode(false);
      loadProfile();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.password !== passwordForm.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      await updateUser({ password: passwordForm.password });
      toast.success('Password changed!');
      setShowPasswordModal(false);
      setPasswordForm({ password: '', confirm: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    }
  };

  const handleDownloadCert = async (certId: string) => {
    try {
      const res = await certificatesAPI.download(certId);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate_${certId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download certificate');
    }
  };

  if (authLoading || loading) return <Loading text="Loading profile..." />;
  if (!profile) return null;

  // Build streak calendar (last 90 days)
  const streakDates = new Set(profile.streak_dates || []);
  const today = new Date();
  const calendarDays: { date: string; active: boolean }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    calendarDays.push({ date: key, active: streakDates.has(key) });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>

      {/* Profile Header */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="w-20 h-20 bg-primary-500 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full rounded-2xl object-cover" />
            ) : (
              profile.full_name?.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1">
            {editMode ? (
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <Input label="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                <TextArea label="Bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Tell us about yourself..." />
                <Input label="Avatar URL" value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://..." />
                <div className="flex gap-2">
                  <Button type="submit" size="sm">Save Changes</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditMode(false)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-xl font-bold text-gray-800">{profile.full_name}</h2>
                  <Badge variant={profile.role === 'admin' ? 'danger' : profile.role === 'instructor' ? 'primary' : 'success'}>
                    {profile.role}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 flex items-center gap-1"><Mail className="w-4 h-4" />{profile.email}</p>
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1"><User className="w-4 h-4" />@{profile.username}</p>
                {profile.bio && <p className="text-sm text-gray-600 mt-3">{profile.bio}</p>}
                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />Joined {new Date(profile.created_at).toLocaleDateString()}
                </p>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="secondary" icon={<Edit3 className="w-4 h-4" />} onClick={() => setEditMode(true)}>
                    Edit Profile
                  </Button>
                  <Button size="sm" variant="ghost" icon={<Shield className="w-4 h-4" />} onClick={() => setShowPasswordModal(true)}>
                    Change Password
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card hover>
          <div className="text-center">
            <Brain className="w-6 h-6 text-primary-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{profile.quiz_stats?.total_attempts || 0}</p>
            <p className="text-xs text-gray-500">Quizzes Taken</p>
          </div>
        </Card>
        <Card hover>
          <div className="text-center">
            <Trophy className="w-6 h-6 text-amber-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{profile.quiz_stats?.avg_score || 0}%</p>
            <p className="text-xs text-gray-500">Avg Score</p>
          </div>
        </Card>
        <Card hover>
          <div className="text-center">
            <BookOpen className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{profile.enrolled_courses?.length || 0}</p>
            <p className="text-xs text-gray-500">Courses</p>
          </div>
        </Card>
        <Card hover>
          <div className="text-center">
            <Award className="w-6 h-6 text-purple-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{profile.certificates?.length || 0}</p>
            <p className="text-xs text-gray-500">Certificates</p>
          </div>
        </Card>
      </div>

      {/* Streak Calendar */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-orange-500" />
          <h3 className="font-semibold text-gray-800">Learning Streak</h3>
        </div>
        <div className="flex flex-wrap gap-1">
          {calendarDays.map((day) => (
            <div
              key={day.date}
              title={day.date}
              className={`w-3.5 h-3.5 rounded-sm ${
                day.active ? 'bg-primary-500' : 'bg-gray-100'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-gray-100" /> No activity</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-primary-500" /> Active</span>
          <span>Last 90 days</span>
        </div>
      </Card>

      {/* Certificates */}
      {profile.certificates?.length > 0 && (
        <Card>
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-primary-500" /> Certificates
          </h3>
          <div className="space-y-3">
            {profile.certificates.map((cert: any) => (
              <div key={cert.id} className="flex items-center justify-between p-3 bg-surface-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-700">Certificate #{cert.certificate_number}</p>
                  <p className="text-xs text-gray-400">Score: {cert.score}% • {new Date(cert.issued_at).toLocaleDateString()}</p>
                </div>
                <Button variant="ghost" size="sm" icon={<Download className="w-4 h-4" />}
                  onClick={() => handleDownloadCert(cert.id)}>
                  Download
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Active Roadmaps */}
      {profile.active_roadmaps?.length > 0 && (
        <Card>
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Map className="w-5 h-5 text-primary-500" /> Active Roadmaps
          </h3>
          <div className="space-y-2">
            {profile.active_roadmaps.map((r: any) => (
              <a key={r.id} href={`/roadmaps/${r.id}`} className="flex items-center justify-between p-3 bg-surface-50 rounded-xl hover:bg-primary-50 transition-smooth">
                <div>
                  <p className="text-sm font-medium text-gray-700">{r.title}</p>
                  <p className="text-xs text-gray-400">{r.duration_weeks} weeks</p>
                </div>
                <Badge variant="primary">In Progress</Badge>
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* Change Password Modal */}
      <Modal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="Change Password" size="sm">
        <form onSubmit={handleChangePassword} className="space-y-4">
          <Input label="New Password" type="password" value={passwordForm.password}
            onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
            required minLength={6} placeholder="At least 6 characters" />
          <Input label="Confirm Password" type="password" value={passwordForm.confirm}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
            required placeholder="Repeat password" />
          <Button type="submit" className="w-full">Update Password</Button>
        </form>
      </Modal>
    </div>
  );
}
