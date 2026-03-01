import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { quizzesAPI } from '@/lib/api';
import { Card, Button, Loading, Badge, Modal, Input, TextArea, Select } from '@/components/ui';
import { Brain, Clock, CheckCircle, XCircle, ArrowLeft, ArrowRight, Trophy, Shield, AlertTriangle, Award, Monitor, Pencil, Trash, Plus, Eye, Save, X } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

type Phase = 'preview' | 'taking' | 'results';

export default function QuizDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('preview');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [proctorWarning, setProctorWarning] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // CRUD state
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [questionForm, setQuestionForm] = useState({
    question_text: '', option_a: '', option_b: '', option_c: '', option_d: '',
    correct_answer: 'A', explanation: '', code_snippet: '',
  });
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => { if (id) loadQuiz(); }, [id]);

  // Timer
  useEffect(() => {
    if (phase !== 'taking') return;
    const interval = setInterval(() => {
      setTimeLeft(t => t + 1);
      if (quiz?.time_limit_minutes && !previewMode) {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            submitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, quiz, previewMode]);

  // Proctor Mode: tab switch detection
  useEffect(() => {
    if (phase !== 'taking' || !quiz?.proctor_mode || previewMode) return;
    const handleVisibility = () => {
      if (document.hidden) {
        setTabSwitchCount(prev => {
          const newCount = prev + 1;
          if (newCount >= 3) {
            setProctorWarning('You switched tabs 3 times. Your quiz will be auto-submitted.');
            setTimeout(() => submitQuiz(), 2000);
          } else {
            setProctorWarning(`Warning: Tab switch detected (${newCount}/3). Your quiz may be auto-submitted.`);
            setTimeout(() => setProctorWarning(''), 4000);
          }
          return newCount;
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [phase, quiz, previewMode]);

  // Proctor Mode: prevent copy/paste
  useEffect(() => {
    if (phase !== 'taking' || !quiz?.proctor_mode || previewMode) return;
    const prevent = (e: Event) => {
      e.preventDefault();
      setProctorWarning('Copy/paste is disabled in proctor mode.');
      setTimeout(() => setProctorWarning(''), 3000);
    };
    document.addEventListener('copy', prevent);
    document.addEventListener('paste', prevent);
    document.addEventListener('cut', prevent);
    return () => {
      document.removeEventListener('copy', prevent);
      document.removeEventListener('paste', prevent);
      document.removeEventListener('cut', prevent);
    };
  }, [phase, quiz, previewMode]);

  // Proctor Mode: right-click
  useEffect(() => {
    if (phase !== 'taking' || !quiz?.proctor_mode || previewMode) return;
    const prevent = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', prevent);
    return () => document.removeEventListener('contextmenu', prevent);
  }, [phase, quiz, previewMode]);

  const loadQuiz = async () => {
    try {
      const res = await quizzesAPI.get(id as string);
      setQuiz(res.data);
    } catch { toast.error('Failed to load quiz'); }
    finally { setLoading(false); }
  };

  const startQuiz = () => {
    setPhase('taking');
    setCurrentQ(0);
    setAnswers({});
    setTimeLeft(0);
    setTabSwitchCount(0);
    setProctorWarning('');
    setStartTime(Date.now());
    setPreviewMode(false);
    if (quiz?.time_limit_minutes) setCountdown(quiz.time_limit_minutes * 60);
    if (quiz?.proctor_mode) {
      try { document.documentElement.requestFullscreen?.(); } catch {}
    }
  };

  const startPreview = () => {
    setPhase('taking');
    setCurrentQ(0);
    setAnswers({});
    setTimeLeft(0);
    setPreviewMode(true);
    setStartTime(Date.now());
    if (quiz?.time_limit_minutes) setCountdown(quiz.time_limit_minutes * 60);
  };

  const selectAnswer = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const submitQuiz = async () => {
    if (previewMode) {
      setPhase('preview');
      setPreviewMode(false);
      toast.success('Preview ended');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    if (document.fullscreenElement) {
      try { document.exitFullscreen(); } catch {}
    }
    try {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      const res = await quizzesAPI.submitAttempt(id as string, { answers, duration_seconds: duration });
      setResult(res.data);
      setPhase('results');
      toast.success('Quiz submitted!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit');
    } finally { setSubmitting(false); }
  };

  // ── Question CRUD ─────────────────────────────────────────────
  const openEditQuestion = (q: any) => {
    setEditingQuestion(q);
    setQuestionForm({
      question_text: q.question_text, option_a: q.option_a, option_b: q.option_b,
      option_c: q.option_c, option_d: q.option_d, correct_answer: q.correct_answer,
      explanation: q.explanation || '', code_snippet: q.code_snippet || '',
    });
  };

  const openAddQuestion = () => {
    setShowAddQuestion(true);
    setQuestionForm({
      question_text: '', option_a: '', option_b: '', option_c: '', option_d: '',
      correct_answer: 'A', explanation: '', code_snippet: '',
    });
  };

  const handleSaveQuestion = async () => {
    if (!questionForm.question_text || !questionForm.option_a || !questionForm.option_b ||
        !questionForm.option_c || !questionForm.option_d) {
      toast.error('Fill in all required fields'); return;
    }
    setSaving(true);
    try {
      if (editingQuestion) {
        await quizzesAPI.editQuestion(id as string, editingQuestion.id, questionForm);
        toast.success('Question updated');
        setEditingQuestion(null);
      } else {
        await quizzesAPI.addQuestion(id as string, questionForm);
        toast.success('Question added');
        setShowAddQuestion(false);
      }
      loadQuiz();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Delete this question?')) return;
    try {
      await quizzesAPI.deleteQuestion(id as string, questionId);
      toast.success('Question deleted');
      loadQuiz();
    } catch { toast.error('Failed to delete'); }
  };

  const handleApprove = async (action: 'approve' | 'reject') => {
    try {
      await quizzesAPI.approve(id as string, action);
      toast.success(`Quiz ${action}d!`);
      loadQuiz();
    } catch { toast.error(`Failed to ${action}`); }
  };

  const handleDeleteQuiz = async () => {
    if (!confirm('Delete this entire quiz?')) return;
    try {
      await quizzesAPI.delete(id as string);
      toast.success('Quiz deleted');
      router.push('/quizzes');
    } catch { toast.error('Failed to delete quiz'); }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) return <Loading />;
  if (!quiz) return <div>Quiz not found</div>;

  const questions = quiz.questions || [];
  const isProctored = quiz.proctor_mode;
  const isTimed = quiz.time_limit_minutes > 0;
  const isFinalExam = quiz.is_final_exam;
  const isOwner = user?.role === 'admin' || user?.role === 'instructor';

  // ── Question Form Modal ────────────────────────────────────────
  const questionModal = (
    <Modal isOpen={!!editingQuestion || showAddQuestion}
      onClose={() => { setEditingQuestion(null); setShowAddQuestion(false); }}
      title={editingQuestion ? 'Edit Question' : 'Add Question'} size="lg">
      <div className="space-y-4">
        <TextArea label="Question Text *" placeholder="Enter the question..."
          value={questionForm.question_text}
          onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })} />
        <TextArea label="Code Snippet (optional)" placeholder="Add code if applicable..."
          value={questionForm.code_snippet}
          onChange={(e) => setQuestionForm({ ...questionForm, code_snippet: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Option A *" value={questionForm.option_a}
            onChange={(e) => setQuestionForm({ ...questionForm, option_a: e.target.value })} />
          <Input label="Option B *" value={questionForm.option_b}
            onChange={(e) => setQuestionForm({ ...questionForm, option_b: e.target.value })} />
          <Input label="Option C *" value={questionForm.option_c}
            onChange={(e) => setQuestionForm({ ...questionForm, option_c: e.target.value })} />
          <Input label="Option D *" value={questionForm.option_d}
            onChange={(e) => setQuestionForm({ ...questionForm, option_d: e.target.value })} />
        </div>
        <Select label="Correct Answer" value={questionForm.correct_answer}
          onChange={(e) => setQuestionForm({ ...questionForm, correct_answer: e.target.value })}
          options={[
            { value: 'A', label: 'A' }, { value: 'B', label: 'B' },
            { value: 'C', label: 'C' }, { value: 'D', label: 'D' },
          ]} />
        <TextArea label="Explanation" placeholder="Why is this the correct answer?"
          value={questionForm.explanation}
          onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })} />
        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={() => { setEditingQuestion(null); setShowAddQuestion(false); }} className="flex-1">Cancel</Button>
          <Button onClick={handleSaveQuestion} loading={saving} className="flex-1" icon={<Save className="w-4 h-4" />}>
            {editingQuestion ? 'Save Changes' : 'Add Question'}
          </Button>
        </div>
      </div>
    </Modal>
  );

  // ── Preview Phase ────────────────────────────────────────────────
  if (phase === 'preview') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/quizzes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-500">
          <ArrowLeft className="w-4 h-4" /> Back to Quizzes
        </Link>

        <Card className="text-center py-10">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isFinalExam ? 'bg-amber-100' : 'bg-primary-100'}`}>
            {isFinalExam ? <Shield className="w-8 h-8 text-amber-600" /> : <Brain className="w-8 h-8 text-primary-500" />}
          </div>
          <h1 className="text-2xl font-bold text-gray-800">{quiz.title}</h1>
          {isFinalExam && <Badge variant="warning" className="mt-2">Final Exam</Badge>}

          <div className="flex items-center justify-center gap-4 text-sm text-gray-500 mt-3">
            <span>{quiz.num_questions} questions</span>
            <span>•</span>
            <Badge variant="primary">{quiz.difficulty}</Badge>
            {isTimed && (<><span>•</span><span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {quiz.time_limit_minutes} min</span></>)}
          </div>

          {quiz.approval_status !== 'approved' && (
            <div className="mt-4">
              <Badge variant={quiz.approval_status === 'pending' ? 'warning' : 'danger'}>Status: {quiz.approval_status}</Badge>
            </div>
          )}

          <p className="text-gray-500 mt-4 max-w-md mx-auto">
            Answer all questions to the best of your ability. You can review and change answers before submitting.
          </p>

          {isProctored && (
            <div className="mt-6 mx-auto max-w-sm bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
              <div className="flex items-start gap-2">
                <Monitor className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Proctor Mode Enabled</p>
                  <ul className="text-xs text-amber-700 mt-1 space-y-1 list-disc list-inside">
                    <li>Quiz will enter fullscreen mode</li>
                    <li>Tab switching is monitored (3 max)</li>
                    <li>Copy/paste &amp; right-click disabled</li>
                    {isTimed && <li>Time limit: {quiz.time_limit_minutes} minutes</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-3 mt-8 flex-wrap">
            {isOwner && quiz.approval_status === 'pending' && (
              <>
                <Button variant="secondary" onClick={() => handleApprove('approve')}
                  icon={<CheckCircle className="w-4 h-4" />} className="border-green-200 text-green-600 hover:bg-green-50">Approve</Button>
                <Button variant="secondary" onClick={() => handleApprove('reject')}
                  icon={<XCircle className="w-4 h-4" />} className="border-red-200 text-red-600 hover:bg-red-50">Reject</Button>
              </>
            )}
            {isOwner && (
              <Button variant="secondary" onClick={startPreview} icon={<Eye className="w-4 h-4" />}>Preview Quiz</Button>
            )}
            {(quiz.approval_status === 'approved' || isOwner) && (
              <Button onClick={startQuiz} size="lg" icon={<ArrowRight className="w-5 h-5" />}>
                {isProctored ? 'Start Proctored Exam' : 'Start Quiz'}
              </Button>
            )}
          </div>

          {user?.role === 'admin' && (
            <div className="mt-4">
              <Button variant="danger" size="sm" onClick={handleDeleteQuiz} icon={<Trash className="w-4 h-4" />}>Delete Quiz</Button>
            </div>
          )}
        </Card>

        {/* Questions Management (Admin/Instructor) */}
        {isOwner && questions.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Questions ({questions.length})</h3>
              <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={openAddQuestion}>Add Question</Button>
            </div>
            <div className="space-y-3">
              {questions.map((q: any, idx: number) => (
                <div key={q.id} className="p-4 bg-surface-50 rounded-xl border border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 mb-1">
                        <span className="text-primary-500 font-bold mr-2">Q{idx + 1}.</span>{q.question_text}
                      </p>
                      {q.code_snippet && (
                        <pre className="bg-gray-900 text-green-400 p-2 rounded-lg text-xs mt-1 overflow-x-auto">{q.code_snippet}</pre>
                      )}
                      <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
                        {['A', 'B', 'C', 'D'].map(opt => {
                          const key = `option_${opt.toLowerCase()}`;
                          const isCorrect = q.correct_answer === opt;
                          return (
                            <div key={opt} className={`px-2 py-1 rounded ${isCorrect ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-500'}`}>
                              <span className="font-bold">{opt}.</span> {q[key]}
                            </div>
                          );
                        })}
                      </div>
                      {q.explanation && <p className="text-xs text-gray-400 mt-1 italic">💡 {q.explanation}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEditQuestion(q)} className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-smooth"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteQuestion(q.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-smooth"><Trash className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {questionModal}
      </div>
    );
  }

  // ── Taking Phase ─────────────────────────────────────────────────
  if (phase === 'taking' && questions.length > 0) {
    const q = questions[currentQ];
    const opts = [
      { key: 'A', text: q.option_a },
      { key: 'B', text: q.option_b },
      { key: 'C', text: q.option_c },
      { key: 'D', text: q.option_d },
    ];
    const selected = answers[q.id];
    const answeredCount = Object.keys(answers).length;

    return (
      <div ref={containerRef} className="max-w-3xl mx-auto space-y-6" style={{ userSelect: isProctored && !previewMode ? 'none' : 'auto' }}>
        {previewMode && (
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary-500" />
              <span className="text-sm font-medium text-primary-700">Preview Mode — Answers visible, no submission</span>
            </div>
            <Button size="sm" variant="secondary" onClick={() => { setPhase('preview'); setPreviewMode(false); }}>Exit Preview</Button>
          </div>
        )}

        {proctorWarning && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fadeIn">
            <AlertTriangle className="w-5 h-5" /><span className="text-sm font-medium">{proctorWarning}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Question {currentQ + 1} of {questions.length}</span>
          <div className="flex items-center gap-3">
            {isProctored && !previewMode && (
              <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-lg flex items-center gap-1"><Shield className="w-3 h-3" /> Proctored</span>
            )}
            {isTimed && countdown > 0 && !previewMode ? (
              <span className={`text-sm font-mono flex items-center gap-1 px-2 py-1 rounded-lg ${countdown < 60 ? 'bg-red-100 text-red-700 animate-pulse' : countdown < 300 ? 'bg-amber-100 text-amber-700' : 'text-gray-500'}`}>
                <Clock className="w-4 h-4" /> {formatTime(countdown)}
              </span>
            ) : (
              <span className="text-sm text-gray-500 flex items-center gap-1"><Clock className="w-4 h-4" /> {formatTime(timeLeft)}</span>
            )}
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-primary-500 h-2 rounded-full transition-all duration-500" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
        </div>

        <Card className="animate-fadeIn">
          {q.code_snippet && (
            <pre className="bg-gray-900 text-green-400 p-4 rounded-xl text-sm overflow-x-auto mb-4 font-mono"><code>{q.code_snippet}</code></pre>
          )}
          <h2 className="text-lg font-semibold text-gray-800 mb-6">{q.question_text}</h2>
          <div className="space-y-3">
            {opts.map((opt) => {
              const isCorrectAnswer = previewMode && q.correct_answer === opt.key;
              return (
                <button key={opt.key} onClick={() => selectAnswer(q.id, opt.key)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-smooth ${
                    isCorrectAnswer ? 'border-green-400 bg-green-50 text-green-700' :
                    selected === opt.key ? 'border-primary-500 bg-primary-50 text-primary-700' :
                    'border-gray-200 hover:border-primary-300 hover:bg-primary-50/50'
                  }`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                      isCorrectAnswer ? 'bg-green-500 text-white' :
                      selected === opt.key ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>{opt.key}</span>
                    <span className="text-sm">{opt.text}</span>
                    {isCorrectAnswer && <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />}
                  </div>
                </button>
              );
            })}
          </div>
          {previewMode && q.explanation && (
            <p className="text-xs text-gray-500 mt-4 bg-gray-50 p-3 rounded-lg"><span className="font-semibold">Explanation:</span> {q.explanation}</p>
          )}
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}
            icon={<ArrowLeft className="w-4 h-4" />}>Previous</Button>
          <div className="flex gap-1.5 flex-wrap justify-center max-w-xs">
            {questions.map((_: any, idx: number) => (
              <button key={idx} onClick={() => setCurrentQ(idx)}
                className={`w-3 h-3 rounded-full transition-smooth ${
                  idx === currentQ ? 'bg-primary-500 scale-125' : answers[questions[idx].id] ? 'bg-primary-300' : 'bg-gray-200'
                }`} />
            ))}
          </div>
          {currentQ < questions.length - 1 ? (
            <Button onClick={() => setCurrentQ(currentQ + 1)} icon={<ArrowRight className="w-4 h-4" />}>Next</Button>
          ) : previewMode ? (
            <Button onClick={() => { setPhase('preview'); setPreviewMode(false); }} icon={<X className="w-4 h-4" />}>End Preview</Button>
          ) : (
            <Button onClick={submitQuiz} loading={submitting} variant={answeredCount === questions.length ? 'primary' : 'secondary'}
              icon={<CheckCircle className="w-4 h-4" />}>Submit ({answeredCount}/{questions.length})</Button>
          )}
        </div>
      </div>
    );
  }

  // ── Results Phase ────────────────────────────────────────────────
  if (phase === 'results' && result) {
    const scoreColor = result.score >= 80 ? 'text-green-500' : result.score >= 70 ? 'text-amber-500' : 'text-red-500';
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="text-center py-8">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className={`w-10 h-10 ${scoreColor}`} />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Quiz Complete!</h1>
          <p className={`text-5xl font-extrabold mt-4 ${scoreColor}`}>{result.score}%</p>
          <p className="text-gray-500 mt-2">{result.correct_answers} of {result.total_questions} correct • Time: {formatTime(result.duration_seconds || 0)}</p>
          {result.passed ? (
            <Badge variant="success" className="mt-3 text-sm px-4 py-1">Passed ✓</Badge>
          ) : (
            <Badge variant="danger" className="mt-3 text-sm px-4 py-1">Not Passed — 70% required</Badge>
          )}
          {result.certificate && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 inline-flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">Certificate earned! Check your certificates page.</span>
            </div>
          )}
          <div className="flex justify-center gap-3 mt-6 flex-wrap">
            <Button variant="secondary" onClick={() => { setPhase('preview'); setResult(null); }} icon={<ArrowLeft className="w-4 h-4" />}>Retry Quiz</Button>
            <Link href={`/roadmaps?quiz_attempt_id=${result.id}`}><Button>Generate Learning Roadmap</Button></Link>
            {result.certificate && (
              <Link href="/certificates"><Button variant="secondary" icon={<Award className="w-4 h-4" />}>View Certificate</Button></Link>
            )}
          </div>
        </Card>

        <h2 className="text-xl font-bold text-gray-800">Review Answers</h2>
        <div className="space-y-4">
          {result.questions?.map((q: any, idx: number) => {
            const detail = result.answers_detail?.[idx];
            const isCorrect = detail?.is_correct;
            return (
              <Card key={q.id} className={`border-l-4 ${isCorrect ? 'border-l-green-400' : 'border-l-red-400'}`}>
                <div className="flex items-start gap-3">
                  {isCorrect ? <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" /> : <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />}
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 mb-2">{idx + 1}. {q.question_text}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      {['A', 'B', 'C', 'D'].map(opt => {
                        const optKey = `option_${opt.toLowerCase()}` as keyof typeof q;
                        const isAnswer = q.correct_answer === opt;
                        const isSelected = detail?.selected === opt;
                        return (
                          <div key={opt} className={`p-2 rounded-lg ${isAnswer ? 'bg-green-50 text-green-700 font-medium' : isSelected && !isCorrect ? 'bg-red-50 text-red-700' : 'text-gray-500'}`}>
                            <span className="font-bold mr-1">{opt}.</span> {q[optKey]}
                          </div>
                        );
                      })}
                    </div>
                    {q.explanation && (
                      <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded-lg"><span className="font-semibold">Explanation:</span> {q.explanation}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
