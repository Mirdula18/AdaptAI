import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { coursesAPI } from '@/lib/api';
import { Card, Button, Loading, EmptyState, Badge, Modal, Input, TextArea, Select } from '@/components/ui';
import { BookOpen, Plus, Search, Clock, Users, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function CoursesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', estimated_duration: '', badge: '', is_published: false });
  const [submitting, setSubmitting] = useState(false);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());

  useEffect(() => { loadCourses(); }, []);

  const loadCourses = async () => {
    try {
      const res = await coursesAPI.list({ search, per_page: 50 });
      const items = res.data.items || [];
      setCourses(items);
      // Populate enrolled state from server data
      const enrolled = new Set<string>(items.filter((c: any) => c.is_enrolled).map((c: any) => c.id));
      setEnrolledIds(prev => {
        const merged = new Set(prev);
        enrolled.forEach(id => merged.add(id));
        return merged;
      });
    } catch { toast.error('Failed to load courses'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const timer = setTimeout(loadCourses, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await coursesAPI.create(form);
      toast.success('Course created!');
      setShowCreate(false);
      setForm({ title: '', description: '', estimated_duration: '', badge: '', is_published: false });
      loadCourses();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to create course'); }
    finally { setSubmitting(false); }
  };

  const handleEnroll = async (courseId: string) => {
    try {
      await coursesAPI.enroll(courseId);
      toast.success('Enrolled successfully!');
      setEnrolledIds(prev => new Set(prev).add(courseId));
    } catch (err: any) {
      if (err.response?.status === 409) {
        setEnrolledIds(prev => new Set(prev).add(courseId));
      }
      toast.error(err.response?.data?.error || 'Failed to enroll');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Courses</h1>
          <p className="text-sm text-gray-500 mt-1">
            {user?.role === 'student' ? 'Browse and enroll in courses' : 'Manage your courses'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {(user?.role === 'admin' || user?.role === 'instructor') && (
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>New Course</Button>
          )}
        </div>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-8 h-8 text-primary-500" />}
          title="No courses yet"
          description="Courses will appear here once they are created."
          action={
            (user?.role === 'admin' || user?.role === 'instructor') ? (
              <Button onClick={() => setShowCreate(true)} icon={<Plus className="w-4 h-4" />}>Create Course</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} hover className="flex flex-col">
              <div className="flex-1">
                <div className="flex items-start justify-between mb-3">
                  {user?.role !== 'student' && (
                    <Badge variant={course.is_published ? 'success' : 'gray'}>
                      {course.is_published ? 'Published' : 'Draft'}
                    </Badge>
                  )}
                  {course.badge && (
                    <Badge variant="primary">{course.badge}</Badge>
                  )}
                </div>
                <h3 className="font-semibold text-gray-800 mb-2">{course.title}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">{course.description || 'No description'}</p>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  {course.estimated_duration && (
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {course.estimated_duration}</span>
                  )}
                  {course.instructor_name && (
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {course.instructor_name}</span>
                  )}
                </div>
                {course.topics?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {course.topics.slice(0, 3).map((t: any) => (
                      <span key={t.id} className="px-2 py-0.5 bg-primary-50 text-primary-600 rounded-full text-xs">{t.name}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-50 flex gap-2">
                <Link href={`/courses/${course.id}`} className="flex-1">
                  <Button variant="secondary" size="sm" className="w-full" icon={<ArrowRight className="w-4 h-4" />}>View</Button>
                </Link>
                {user?.role === 'student' && (
                  enrolledIds.has(course.id) ? (
                    <Button size="sm" variant="secondary" disabled className="opacity-70">Enrolled</Button>
                  ) : (
                    <Button size="sm" onClick={() => handleEnroll(course.id)}>Enroll</Button>
                  )
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Course Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Course">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Course Title" placeholder="e.g. Introduction to Python" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <TextArea label="Description" placeholder="Describe what this course covers..." value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Estimated Duration" placeholder="e.g. 4 weeks" value={form.estimated_duration}
            onChange={(e) => setForm({ ...form, estimated_duration: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course Badge</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {['Web Development', 'Data Structures', 'Machine Learning', 'Database', 'Python', 'JavaScript', 'Algorithms', 'Cybersecurity'].map(b => (
                <button type="button" key={b} onClick={() => setForm({ ...form, badge: b })}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-smooth ${
                    form.badge === b ? 'bg-primary-500 text-white border-primary-500' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-primary-300'
                  }`}>{b}</button>
              ))}
            </div>
            <Input placeholder="Or enter a custom badge..." value={form.badge}
              onChange={(e) => setForm({ ...form, badge: e.target.value })} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
              className="w-4 h-4 text-primary-500 rounded" />
            <span className="text-sm text-gray-700">Publish immediately</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={submitting} className="flex-1">Create Course</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
