import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { roadmapsAPI, quizzesAPI, coursesAPI } from '@/lib/api';
import { Card, Button, Loading, EmptyState, Badge, Modal, Input, Select } from '@/components/ui';
import { Map, Sparkles, Calendar, BookOpen, Target, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function RoadmapsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [roadmaps, setRoadmaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [courses, setCourses] = useState<any[]>([]);
  const [genForm, setGenForm] = useState({
    course_id: '', quiz_attempt_id: '', duration_weeks: '6',
  });

  useEffect(() => {
    loadRoadmaps();
    loadCourses();
  }, []);

  // Handle quiz_attempt_id from URL (e.g. redirected from quiz results)
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.quiz_attempt_id) {
      setGenForm(f => ({ ...f, quiz_attempt_id: router.query.quiz_attempt_id as string }));
      setShowGenerate(true);
    }
  }, [router.isReady, router.query.quiz_attempt_id]);

  const loadRoadmaps = async () => {
    try {
      const res = await roadmapsAPI.list({ per_page: 50 });
      setRoadmaps(res.data.items || []);
    } catch { toast.error('Failed to load roadmaps'); }
    finally { setLoading(false); }
  };

  const loadCourses = async () => {
    try {
      const res = await coursesAPI.list({ per_page: 100 });
      setCourses(res.data.items || []);
    } catch {}
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genForm.course_id && !genForm.quiz_attempt_id) {
      toast.error('Select a course or provide a quiz attempt');
      return;
    }
    setGenerating(true);
    try {
      const data: any = { duration_weeks: parseInt(genForm.duration_weeks) };
      if (genForm.course_id) data.course_id = genForm.course_id;
      if (genForm.quiz_attempt_id) data.quiz_attempt_id = genForm.quiz_attempt_id;

      const res = await roadmapsAPI.generate(data);
      toast.success('Roadmap generated!');
      setShowGenerate(false);
      router.push(`/roadmaps/${res.data.id}`);
    } catch (err: any) {
      // If the roadmap was actually created, redirect to it
      if (err.response?.data?.id) {
        toast.success('Roadmap generated!');
        setShowGenerate(false);
        router.push(`/roadmaps/${err.response.data.id}`);
        return;
      }
      // Check if a roadmap now exists for this course before showing error
      const errorMsg = err.response?.data?.error || 'Failed to generate roadmap';
      if (errorMsg.toLowerCase().includes('ollama') || errorMsg.toLowerCase().includes('connection')) {
        toast.error('AI service is not available. Please ensure Ollama is running and try again.');
      } else {
        toast.error(errorMsg);
      }
    } finally { setGenerating(false); }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Learning Roadmaps</h1>
          <p className="text-sm text-gray-500 mt-1">Personalized learning plans powered by AI</p>
        </div>
        <Button icon={<Sparkles className="w-4 h-4" />} onClick={() => setShowGenerate(true)}>
          Generate Roadmap
        </Button>
      </div>

      {roadmaps.length === 0 ? (
        <EmptyState
          icon={<Map className="w-8 h-8 text-primary-500" />}
          title="No roadmaps yet"
          description="Take a quiz first, then generate a personalized learning roadmap."
          action={<Button onClick={() => setShowGenerate(true)} icon={<Sparkles className="w-4 h-4" />}>Generate Roadmap</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {roadmaps.map((rm) => (
            <Card key={rm.id} hover>
              <div className="flex items-start justify-between mb-3">
                <Badge variant={rm.is_active ? 'success' : 'gray'}>{rm.is_active ? 'Active' : 'Archived'}</Badge>
                <span className="text-xs text-gray-400">{new Date(rm.created_at).toLocaleDateString()}</span>
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{rm.title}</h3>
              <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{rm.duration_weeks} weeks</span>
              </div>
              <Link href={`/roadmaps/${rm.id}`}>
                <Button variant="secondary" size="sm" className="w-full" icon={<ArrowRight className="w-4 h-4" />}>View Plan</Button>
              </Link>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Learning Roadmap" size="md">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="bg-primary-50 rounded-xl p-4 mb-2">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-primary-500" />
              <span className="text-sm font-semibold text-primary-700">AI-Generated Plan</span>
            </div>
            <p className="text-xs text-primary-600">Based on your quiz performance, the AI will create a personalized weekly learning plan.</p>
          </div>

          {courses.length > 0 && (
            <Select label="Course" value={genForm.course_id}
              onChange={(e) => setGenForm({ ...genForm, course_id: e.target.value })}
              options={[{ value: '', label: 'Select a course' }, ...courses.map(c => ({ value: c.id, label: c.title }))]}
            />
          )}

          <Input label="Quiz Attempt ID (optional)" placeholder="Auto-filled from quiz results"
            value={genForm.quiz_attempt_id}
            onChange={(e) => setGenForm({ ...genForm, quiz_attempt_id: e.target.value })} />

          <Select label="Duration" value={genForm.duration_weeks}
            onChange={(e) => setGenForm({ ...genForm, duration_weeks: e.target.value })}
            options={[
              { value: '4', label: '4 Weeks' },
              { value: '6', label: '6 Weeks' },
              { value: '8', label: '8 Weeks' },
              { value: '10', label: '10 Weeks' },
              { value: '12', label: '12 Weeks' },
            ]}
          />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowGenerate(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={generating} className="flex-1" icon={<Sparkles className="w-4 h-4" />}>Generate</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
