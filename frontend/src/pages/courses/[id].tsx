import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { coursesAPI, materialsAPI, quizzesAPI, certificatesAPI } from '@/lib/api';
import { Card, Button, Loading, Badge, Modal, Input, TextArea } from '@/components/ui';
import { BookOpen, Brain, FileText, Download, Link as LinkIcon, ArrowLeft, Pencil, Trash, Users, Clock, Award, Shield, LogOut, Map, Trophy, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function CourseDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', estimated_duration: '', is_published: false });

  useEffect(() => {
    if (id) loadCourse();
  }, [id]);

  const loadCourse = async () => {
    try {
      const res = await coursesAPI.get(id as string);
      setCourse(res.data);
      setForm({
        title: res.data.title,
        description: res.data.description || '',
        estimated_duration: res.data.estimated_duration || '',
        is_published: res.data.is_published,
      });
    } catch { toast.error('Failed to load course'); }
    finally { setLoading(false); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await coursesAPI.update(id as string, form);
      toast.success('Course updated!');
      setEditMode(false);
      loadCourse();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to update'); }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this course?')) return;
    try {
      await coursesAPI.delete(id as string);
      toast.success('Course deleted');
      router.push('/courses');
    } catch { toast.error('Failed to delete'); }
  };

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      await coursesAPI.enroll(id as string);
      toast.success('Enrolled successfully!');
      loadCourse();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to enroll'); }
    finally { setEnrolling(false); }
  };

  const handleUnenroll = async () => {
    if (!confirm('Are you sure you want to unenroll from this course?')) return;
    setEnrolling(true);
    try {
      await coursesAPI.unenroll(id as string);
      toast.success('Unenrolled from course');
      loadCourse();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to unenroll'); }
    finally { setEnrolling(false); }
  };

  const handleDownloadCert = async () => {
    if (!course.certificate_id) return;
    try {
      const res = await certificatesAPI.download(course.certificate_id);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Certificate_${course.title.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Certificate downloaded!');
    } catch { toast.error('Failed to download certificate'); }
  };

  const handleDownloadMaterial = async (materialId: string, title: string) => {
    try {
      const res = await materialsAPI.download(materialId);
      const blob: Blob = res.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Extract filename from Content-Disposition header, fall back to title
      const disposition = res.headers['content-disposition'];
      let filename = title.replace(/\s+/g, '_');
      if (disposition) {
        const match = disposition.match(/filename[^;=\n]*=(['"]?)([^'"\n;]+)\1/);
        if (match?.[2]) filename = match[2];
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download started!');
    } catch { toast.error('Failed to download material'); }
  };

  if (loading) return <Loading />;
  if (!course) return <div>Course not found</div>;

  const isOwner = user?.role === 'admin' || (user?.role === 'instructor' && course.instructor_id === user.id);

  return (
    <div className="space-y-6">
      <Link href="/courses" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-500">
        <ArrowLeft className="w-4 h-4" /> Back to Courses
      </Link>

      {/* Course Header */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {user?.role !== 'student' && (
                <Badge variant={course.is_published ? 'success' : 'gray'}>
                  {course.is_published ? 'Published' : 'Draft'}
                </Badge>
              )}
              {course.badge && (
                <Badge variant="primary">{course.badge}</Badge>
              )}
            </div>
            {editMode ? (
              <form onSubmit={handleUpdate} className="space-y-3">
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <Input placeholder="Duration" value={form.estimated_duration} onChange={(e) => setForm({ ...form, estimated_duration: e.target.value })} />
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
                  <span className="text-sm">Published</span>
                </label>
                <div className="flex gap-2">
                  <Button type="submit" size="sm">Save</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditMode(false)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-800">{course.title}</h1>
                <p className="text-gray-500 mt-2">{course.description || 'No description provided.'}</p>
                <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
                  {course.estimated_duration && <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{course.estimated_duration}</span>}
                  {course.instructor_name && <span className="flex items-center gap-1"><Users className="w-4 h-4" />{course.instructor_name}</span>}
                  <span className="flex items-center gap-1"><Users className="w-4 h-4" />{course.enrolled_count} enrolled</span>
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {user?.role === 'student' && (
              course.is_enrolled ? (
                <Button variant="secondary" onClick={handleUnenroll} loading={enrolling}
                  icon={<LogOut className="w-4 h-4" />}
                  className="border-red-200 text-red-600 hover:bg-red-50">
                  Unenroll
                </Button>
              ) : (
                <Button onClick={handleEnroll} loading={enrolling}>Enroll</Button>
              )
            )}
            {isOwner && !editMode && (
              <>
                <Button variant="secondary" size="sm" icon={<Pencil className="w-4 h-4" />} onClick={() => setEditMode(true)}>Edit</Button>
                <Button variant="danger" size="sm" icon={<Trash className="w-4 h-4" />} onClick={handleDelete}>Delete</Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Topics */}
      {course.topics?.length > 0 && (
        <Card>
          <h3 className="font-semibold text-gray-800 mb-3">Topics</h3>
          <div className="flex flex-wrap gap-2">
            {course.topics.map((t: any) => (
              <span key={t.id} className="px-3 py-1.5 bg-primary-50 text-primary-600 rounded-xl text-sm font-medium">{t.name}</span>
            ))}
          </div>
        </Card>
      )}

      {/* Materials */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Learning Materials</h3>
          {isOwner && (
            <Link href="/materials">
              <Button variant="secondary" size="sm">Upload Materials</Button>
            </Link>
          )}
        </div>
        {course.materials?.length > 0 ? (
          <div className="space-y-2">
            {course.materials.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-surface-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-primary-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{m.title}</p>
                    <p className="text-xs text-gray-400 capitalize">{m.material_type}</p>
                  </div>
                </div>
                {m.external_url ? (
                  <a href={m.external_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" icon={<LinkIcon className="w-4 h-4" />}>Open</Button>
                  </a>
                ) : (
                  <Button variant="ghost" size="sm" icon={<Download className="w-4 h-4" />}
                    onClick={() => handleDownloadMaterial(m.id, m.title)}>Download</Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">No materials uploaded yet.</p>
        )}
      </Card>

      {/* Quizzes */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Quizzes</h3>
          {isOwner && (
            <Link href={`/quizzes?course_id=${course.id}`}>
              <Button size="sm" icon={<Brain className="w-4 h-4" />}>Generate Quiz</Button>
            </Link>
          )}
        </div>
        {course.quizzes?.length > 0 ? (
          <div className="space-y-2">
            {course.quizzes.map((q: any) => {
              const attempt = course.my_attempts?.[q.id];
              const scoreColor = attempt ? (attempt.score >= 80 ? 'text-green-600' : attempt.score >= 70 ? 'text-amber-600' : 'text-red-600') : '';
              return (
                <div key={q.id} className="flex items-center justify-between p-3 bg-surface-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Brain className="w-5 h-5 text-primary-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">{q.title}</p>
                      <p className="text-xs text-gray-400">{q.num_questions} questions • {q.difficulty}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {attempt && (
                      <div className={`flex items-center gap-1 text-xs font-bold ${scoreColor}`}>
                        <Trophy className="w-3.5 h-3.5" />
                        {attempt.score}%
                        {attempt.passed && <span className="text-green-600 ml-1">✓</span>}
                      </div>
                    )}
                    <Link href={`/quizzes/${q.id}`}>
                      <Badge variant="primary" className="cursor-pointer hover:opacity-80">
                        {attempt ? 'Retry' : 'Take Quiz'}
                      </Badge>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">No quizzes available yet.</p>
        )}
      </Card>

      {/* Roadmaps */}
      {course.roadmaps?.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Learning Roadmaps</h3>
          </div>
          <div className="space-y-2">
            {course.roadmaps.map((rm: any) => (
              <Link key={rm.id} href={`/roadmaps/${rm.id}`} className="flex items-center justify-between p-3 bg-surface-50 rounded-xl hover:bg-primary-50 transition-smooth">
                <div className="flex items-center gap-3">
                  <Map className="w-5 h-5 text-primary-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{rm.title}</p>
                    <p className="text-xs text-gray-400">{rm.duration_weeks} weeks</p>
                  </div>
                </div>
                <Badge variant={rm.is_active ? 'success' : 'gray'}>{rm.is_active ? 'Active' : 'Archived'}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Final Exam Section */}
      {user?.role === 'student' && course.is_enrolled && course.has_final_exam && (
        <Card className={`border-2 ${course.final_exam_passed ? 'border-green-200 bg-green-50/50' : 'border-primary-200 bg-primary-50/30'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${course.final_exam_passed ? 'bg-green-100' : 'bg-primary-100'}`}>
                <Shield className={`w-6 h-6 ${course.final_exam_passed ? 'text-green-600' : 'text-primary-600'}`} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Final Course Exam</h3>
                <p className="text-sm text-gray-500">
                  {course.final_exam_passed
                    ? 'You have passed the final exam!'
                    : 'Pass this exam to earn your course certificate.'
                  }
                </p>
              </div>
            </div>
            {course.final_exam_passed ? (
              <Badge variant="success" className="text-sm px-4 py-2">Passed ✓</Badge>
            ) : (
              <Link href={`/quizzes/${course.final_exam_id}`}>
                <Button icon={<Shield className="w-4 h-4" />}>Take Final Exam</Button>
              </Link>
            )}
          </div>
        </Card>
      )}

      {/* Certificate Section */}
      {user?.role === 'student' && course.certificate_id && (
        <Card className="border-2 border-amber-200 bg-amber-50/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 rounded-xl">
                <Award className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Certificate Earned!</h3>
                <p className="text-sm text-gray-500">You earned a certificate for completing this course.</p>
              </div>
            </div>
            <Button size="sm" icon={<Download className="w-4 h-4" />} onClick={handleDownloadCert}>
              Download Certificate
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
