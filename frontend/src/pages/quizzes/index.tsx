import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { quizzesAPI, coursesAPI } from '@/lib/api';
import { Card, Button, Loading, EmptyState, Badge, Modal, Input, Select } from '@/components/ui';
import { Brain, Plus, Sparkles, Clock, CheckCircle, Trophy, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';

export default function QuizzesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genForm, setGenForm] = useState({
    topic: '', num_questions: '5', difficulty: 'medium', course_id: '',
  });

  useEffect(() => { loadQuizzes(); loadCourses(); loadAttempts(); }, []);

  useEffect(() => {
    if (router.query.course_id) {
      setGenForm(f => ({ ...f, course_id: router.query.course_id as string }));
      setShowGenerate(true);
    }
  }, [router.query]);

  const loadQuizzes = async () => {
    try {
      const res = await quizzesAPI.list({ per_page: 50 });
      setQuizzes(res.data.items || []);
    } catch { toast.error('Failed to load quizzes'); }
    finally { setLoading(false); }
  };

  const loadAttempts = async () => {
    try {
      const res = await quizzesAPI.myAttempts({ per_page: 100 });
      const items = res.data.items || res.data || [];
      const byQuiz: Record<string, any> = {};
      items.forEach((a: any) => {
        if (!byQuiz[a.quiz_id] || a.score > byQuiz[a.quiz_id].score) {
          byQuiz[a.quiz_id] = a;
        }
      });
      setAttempts(byQuiz);
    } catch {}
  };

  const loadCourses = async () => {
    try {
      const res = await coursesAPI.list({ per_page: 100 });
      setCourses(res.data.items || []);
    } catch {}
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genForm.topic.trim()) { toast.error('Topic is required'); return; }
    setGenerating(true);
    try {
      const res = await quizzesAPI.generate({
        topic: genForm.topic,
        num_questions: parseInt(genForm.num_questions),
        difficulty: genForm.difficulty,
        course_id: genForm.course_id || undefined,
      });
      toast.success(`Quiz generated with ${res.data.num_questions} questions!`);
      setShowGenerate(false);
      setGenForm({ topic: '', num_questions: '5', difficulty: 'medium', course_id: '' });
      loadQuizzes();
      router.push(`/quizzes/${res.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to generate quiz. Is Ollama running?');
    } finally { setGenerating(false); }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quizzes</h1>
          <p className="text-sm text-gray-500 mt-1">AI-generated quizzes to test your knowledge</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'instructor') && (
          <Button icon={<Sparkles className="w-4 h-4" />} onClick={() => setShowGenerate(true)}>
            Generate AI Quiz
          </Button>
        )}
      </div>

      {quizzes.length === 0 ? (
        <EmptyState
          icon={<Brain className="w-8 h-8 text-primary-500" />}
          title="No quizzes yet"
          description="Use AI to generate quizzes for any topic."
          action={
            (user?.role === 'admin' || user?.role === 'instructor') ? (
              <Button onClick={() => setShowGenerate(true)} icon={<Sparkles className="w-4 h-4" />}>Generate Quiz</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map((quiz) => {
            const attempt = attempts[quiz.id];
            const scoreColor = attempt ? (attempt.score >= 80 ? 'text-green-600' : attempt.score >= 70 ? 'text-amber-600' : 'text-red-600') : '';
            return (
            <Card key={quiz.id} hover>
              <div className="flex items-start justify-between mb-3">
                <Badge variant={quiz.is_active ? 'success' : 'gray'}>{quiz.is_active ? 'Active' : 'Inactive'}</Badge>
                <div className="flex items-center gap-2">
                  {attempt && (
                    <div className={`flex items-center gap-1 text-xs font-bold ${scoreColor}`}>
                      <Trophy className="w-3.5 h-3.5" />
                      {attempt.score}%
                    </div>
                  )}
                  <Badge variant="primary">{quiz.difficulty}</Badge>
                </div>
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{quiz.title}</h3>
              <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
                <span className="flex items-center gap-1"><Brain className="w-3.5 h-3.5" />{quiz.num_questions} questions</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{new Date(quiz.created_at).toLocaleDateString()}</span>
              </div>
              {attempt ? (
                <div className="space-y-2">
                  <div className={`text-center py-1.5 rounded-lg text-xs font-semibold ${attempt.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {attempt.passed ? 'Passed ✓' : 'Not Passed'}
                  </div>
                  <Link href={`/quizzes/${quiz.id}`}>
                    <Button variant="secondary" size="sm" className="w-full" icon={<RefreshCw className="w-3.5 h-3.5" />}>
                      Retry Quiz
                    </Button>
                  </Link>
                </div>
              ) : (
                <Link href={`/quizzes/${quiz.id}`}>
                  <Button variant="secondary" size="sm" className="w-full">
                    {user?.role === 'student' ? 'Take Quiz' : 'View Quiz'}
                  </Button>
                </Link>
              )}
            </Card>
            );
          })}
        </div>
      )}

      {/* Generate Quiz Modal */}
      <Modal isOpen={showGenerate} onClose={() => setShowGenerate(false)} title="Generate AI Quiz" size="md">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="bg-primary-50 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-primary-500" />
              <span className="text-sm font-semibold text-primary-700">AI-Powered Generation</span>
            </div>
            <p className="text-xs text-primary-600">Our local LLM will generate unique questions based on your topic. Ensure Ollama is running.</p>
          </div>
          <Input label="Topic *" placeholder="e.g. Python Data Structures" value={genForm.topic}
            onChange={(e) => setGenForm({ ...genForm, topic: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Questions" value={genForm.num_questions}
              onChange={(e) => setGenForm({ ...genForm, num_questions: e.target.value })}
              options={[
                { value: '5', label: '5 Questions' },
                { value: '7', label: '7 Questions' },
                { value: '10', label: '10 Questions' },
              ]}
            />
            <Select label="Difficulty" value={genForm.difficulty}
              onChange={(e) => setGenForm({ ...genForm, difficulty: e.target.value })}
              options={[
                { value: 'easy', label: 'Easy' },
                { value: 'medium', label: 'Medium' },
                { value: 'hard', label: 'Hard' },
              ]}
            />
          </div>
          {courses.length > 0 && (
            <Select label="Course (optional)" value={genForm.course_id}
              onChange={(e) => setGenForm({ ...genForm, course_id: e.target.value })}
              options={[
                { value: '', label: 'None / Standalone' },
                ...courses.map(c => ({ value: c.id, label: c.title })),
              ]}
            />
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowGenerate(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={generating} className="flex-1" icon={<Sparkles className="w-4 h-4" />}>
              {generating ? 'Generating...' : 'Generate Quiz'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
