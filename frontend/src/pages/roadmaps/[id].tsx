import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { roadmapsAPI, quizzesAPI } from '@/lib/api';
import { Card, Loading, Badge, Button } from '@/components/ui';
import { ArrowLeft, Calendar, Target, BookOpen, Clock, CheckCircle, ChevronDown, ChevronUp, Sparkles, Brain, Lock, Shield, Award } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function RoadmapDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [roadmap, setRoadmap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completedWeeks, setCompletedWeeks] = useState<Set<number>>(new Set());
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [finalQuiz, setFinalQuiz] = useState<any>(null);

  useEffect(() => { if (id) loadRoadmap(); }, [id]);

  useEffect(() => {
    // Load saved completed weeks from localStorage
    if (id) {
      const saved = localStorage.getItem(`roadmap_progress_${id}`);
      if (saved) setCompletedWeeks(new Set(JSON.parse(saved)));
    }
  }, [id]);

  const loadRoadmap = async () => {
    try {
      const res = await roadmapsAPI.get(id as string);
      setRoadmap(res.data);
      // Auto-expand first incomplete week
      const plan = res.data.plan || [];
      const saved = localStorage.getItem(`roadmap_progress_${id}`);
      const completed = saved ? new Set(JSON.parse(saved)) : new Set();
      const firstIncomplete = plan.findIndex((w: any) => !completed.has(w.week));
      setExpandedWeek(firstIncomplete >= 0 ? firstIncomplete : null);

      // Load final quiz for this course
      if (res.data.course_id) {
        try {
          const quizRes = await quizzesAPI.getFinalExam(res.data.course_id);
          setFinalQuiz(quizRes.data);
        } catch { /* No final quiz yet */ }
      }
    } catch { toast.error('Failed to load roadmap'); }
    finally { setLoading(false); }
  };

  const toggleWeekComplete = (weekNum: number) => {
    setCompletedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekNum)) next.delete(weekNum);
      else next.add(weekNum);
      localStorage.setItem(`roadmap_progress_${id}`, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const handleGenerateQuiz = async () => {
    setGeneratingQuiz(true);
    try {
      const res = await roadmapsAPI.generateQuiz(id as string);
      toast.success('Personalized quiz generated!');
      router.push(`/quizzes/${res.data.id}`);
    } catch (err: any) {
      // If quiz was actually created, navigate to it
      if (err.response?.data?.id) {
        toast.success('Personalized quiz generated!');
        router.push(`/quizzes/${err.response.data.id}`);
        return;
      }
      const errorMsg = err.response?.data?.error || 'Failed to generate quiz';
      if (errorMsg.toLowerCase().includes('ollama') || errorMsg.toLowerCase().includes('connection')) {
        toast.error('AI service is not available. Please ensure Ollama is running and try again.');
      } else {
        toast.error(errorMsg);
      }
    } finally { setGeneratingQuiz(false); }
  };

  if (loading) return <Loading />;
  if (!roadmap) return <div>Roadmap not found</div>;

  const plan = roadmap.plan || [];
  const progressPct = plan.length > 0 ? Math.round((completedWeeks.size / plan.length) * 100) : 0;
  // Calculate current week based on creation date
  const createdDate = new Date(roadmap.created_at);
  const now = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const currentWeekIdx = Math.floor((now.getTime() - createdDate.getTime()) / msPerWeek);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/roadmaps" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-500">
        <ArrowLeft className="w-4 h-4" /> Back to Roadmaps
      </Link>

      {/* Header */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <Badge variant={roadmap.is_active ? 'success' : 'gray'}>{roadmap.is_active ? 'Active' : 'Archived'}</Badge>
            <h1 className="text-2xl font-bold text-gray-800 mt-2">{roadmap.title}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{roadmap.duration_weeks} weeks</span>
              {roadmap.course_title && (
                <Link href={`/courses/${roadmap.course_id}`} className="flex items-center gap-1 text-primary-500 hover:text-primary-700">
                  <BookOpen className="w-4 h-4" />{roadmap.course_title}
                </Link>
              )}
              <span>Created {new Date(roadmap.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {plan.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-500">Overall Progress</span>
              <span className="font-semibold text-primary-600">{progressPct}% ({completedWeeks.size}/{plan.length} weeks)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-primary-500 h-3 rounded-full transition-all duration-700 ease-out" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {/* Generate Personalized Quiz (when all weeks done) */}
        {progressPct === 100 && (
          <div className="mt-4 bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-xl">
                <Brain className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="font-semibold text-primary-800">All Weeks Completed!</p>
                <p className="text-xs text-primary-600">Generate a personalized quiz based on your learning journey.</p>
              </div>
            </div>
            <Button onClick={handleGenerateQuiz} loading={generatingQuiz} icon={<Sparkles className="w-4 h-4" />}>
              Generate Quiz
            </Button>
          </div>
        )}
      </Card>

      {/* Visual Timeline */}
      {plan.length > 0 && (
        <div className="relative px-4">
          <div className="flex items-center justify-between">
            {plan.map((week: any, idx: number) => {
              const isCompleted = completedWeeks.has(week.week);
              const isCurrent = idx === currentWeekIdx;
              return (
                <div key={idx} className="flex flex-col items-center relative z-10">
                  <button
                    onClick={() => toggleWeekComplete(week.week)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 ${
                      isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : isCurrent
                        ? 'bg-primary-500 border-primary-500 text-white ring-4 ring-primary-100'
                        : 'bg-white border-gray-300 text-gray-400 hover:border-primary-300'
                    }`}
                  >
                    {isCompleted ? <CheckCircle className="w-5 h-5" /> : `W${week.week}`}
                  </button>
                  <span className={`text-xs mt-1 ${isCurrent ? 'text-primary-600 font-semibold' : 'text-gray-400'}`}>
                    {isCurrent ? 'Now' : ''}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Connecting line */}
          <div className="absolute top-5 left-9 right-9 h-0.5 bg-gray-200 -z-0" />
          <div className="absolute top-5 left-9 h-0.5 bg-primary-500 -z-0 transition-all duration-700"
            style={{ width: `${plan.length > 1 ? (completedWeeks.size / (plan.length - 1)) * 100 : 0}%`, maxWidth: 'calc(100% - 4.5rem)' }} />
        </div>
      )}

      {/* Weekly Plan */}
      <div className="space-y-4">
        {plan.map((week: any, idx: number) => {
          const isCompleted = completedWeeks.has(week.week);
          const isCurrent = idx === currentWeekIdx;
          const isExpanded = expandedWeek === idx;

          return (
            <Card key={idx} className={`relative overflow-hidden transition-all duration-300 ${
              isCompleted ? 'border-l-4 border-l-green-400 opacity-80' : 
              isCurrent ? 'border-l-4 border-l-primary-500 ring-2 ring-primary-100' : 
              'border-l-4 border-l-gray-200'
            }`}>
              <div className="pl-2">
                {/* Clickable header */}
                <button className="w-full text-left" onClick={() => setExpandedWeek(isExpanded ? null : idx)}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isCompleted ? 'bg-green-100' : isCurrent ? 'bg-primary-100' : 'bg-gray-100'
                      }`}>
                        {isCompleted ? <CheckCircle className="w-5 h-5 text-green-600" /> : (
                          <span className={`text-sm font-bold ${isCurrent ? 'text-primary-600' : 'text-gray-400'}`}>W{week.week}</span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`font-semibold ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{week.focus}</h3>
                          {isCurrent && <Badge variant="primary" className="text-xs">Current Week</Badge>}
                          {isCompleted && <Badge variant="success" className="text-xs">Done</Badge>}
                        </div>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> ~{week.hours || 5} hours estimated
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleWeekComplete(week.week); }}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-smooth ${
                          isCompleted ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-primary-50 hover:text-primary-600'
                        }`}
                      >
                        {isCompleted ? 'Completed ✓' : 'Mark Done'}
                      </button>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>
                </button>

                {/* Expandable content */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-3 animate-fadeIn">
                    {/* Goals */}
                    {week.goals && (
                      <div className="flex items-start gap-2 bg-green-50 p-3 rounded-xl">
                        <Target className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-green-700">{week.goals}</p>
                      </div>
                    )}

                    {/* Topics */}
                    {week.topics?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Topics to Cover</p>
                        <div className="flex flex-wrap gap-2">
                          {week.topics.map((topic: string, tIdx: number) => (
                            <span key={tIdx} className="px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-xs font-medium">{topic}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resources */}
                    {week.resources?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Suggested Resources</p>
                        <div className="flex flex-wrap gap-2">
                          {week.resources.map((res: string, rIdx: number) => (
                            <span key={rIdx} className="flex items-center gap-1 px-3 py-1 bg-gray-50 text-gray-500 rounded-full text-xs">
                              <BookOpen className="w-3 h-3" /> {res}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Final Quiz Section */}
      {finalQuiz && (
        <Card className={`border-2 ${
          finalQuiz.already_passed ? 'border-green-200 bg-green-50/50' :
          progressPct === 100 ? 'border-primary-200 bg-primary-50/30' :
          'border-gray-200 bg-gray-50/50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${
                finalQuiz.already_passed ? 'bg-green-100' :
                progressPct === 100 ? 'bg-primary-100' :
                'bg-gray-100'
              }`}>
                {finalQuiz.already_passed ? (
                  <Award className="w-6 h-6 text-green-600" />
                ) : progressPct === 100 ? (
                  <Shield className="w-6 h-6 text-primary-600" />
                ) : (
                  <Lock className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div>
                <h3 className={`font-semibold ${
                  finalQuiz.already_passed ? 'text-green-800' :
                  progressPct === 100 ? 'text-primary-800' :
                  'text-gray-500'
                }`}>
                  {finalQuiz.title || 'Final Exam'}
                </h3>
                <p className={`text-sm ${
                  finalQuiz.already_passed ? 'text-green-600' :
                  progressPct === 100 ? 'text-primary-600' :
                  'text-gray-400'
                }`}>
                  {finalQuiz.already_passed
                    ? 'Congratulations! You passed the final exam.'
                    : progressPct === 100
                    ? 'All weeks completed — you can now take the final exam!'
                    : `Complete all ${plan.length} weeks to unlock the final exam.`}
                </p>
              </div>
            </div>
            <div>
              {finalQuiz.already_passed ? (
                <Link href="/certificates">
                  <Button variant="secondary" icon={<Award className="w-4 h-4" />}>View Certificate</Button>
                </Link>
              ) : progressPct === 100 ? (
                <Link href={`/quizzes/${finalQuiz.id}`}>
                  <Button icon={<Shield className="w-4 h-4" />}>Take Final Exam</Button>
                </Link>
              ) : (
                <Button disabled className="opacity-50 cursor-not-allowed" icon={<Lock className="w-4 h-4" />}>
                  Locked
                </Button>
              )}
            </div>
          </div>
          {/* Progress hint for locked state */}
          {!finalQuiz.already_passed && progressPct < 100 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className="bg-primary-400 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="whitespace-nowrap">{progressPct}% complete</span>
              </div>
            </div>
          )}
        </Card>
      )}

      {plan.length === 0 && (
        <Card className="text-center py-8">
          <p className="text-gray-400">No plan data available.</p>
        </Card>
      )}
    </div>
  );
}
