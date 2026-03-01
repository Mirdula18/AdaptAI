import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { quizzesAPI } from '@/lib/api';
import { Card, Loading, Button, Badge } from '@/components/ui';
import { CheckCircle, XCircle, Clock, Brain, User, BookOpen, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ApprovalsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [pendingQuizzes, setPendingQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (user.role === 'student') { router.push('/dashboard'); return; }
    loadPending();
  }, [user, authLoading]);

  const loadPending = async () => {
    try {
      const res = await quizzesAPI.pending();
      setPendingQuizzes(res.data.quizzes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (quizId: string, action: 'approve' | 'reject') => {
    setProcessing(quizId);
    try {
      await quizzesAPI.approve(quizId, action);
      toast.success(`Quiz ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      setPendingQuizzes(prev => prev.filter(q => q.id !== quizId));
    } catch (err: any) {
      toast.error(err.response?.data?.error || `Failed to ${action} quiz`);
    } finally {
      setProcessing(null);
    }
  };

  if (authLoading || loading) return <Loading text="Loading pending quizzes..." />;
  if (!user || user.role === 'student') return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quiz Approvals</h1>
          <p className="text-sm text-gray-500 mt-1">Review and approve student-generated quizzes</p>
        </div>
        {pendingQuizzes.length > 0 && (
          <Badge variant="warning" className="text-sm px-3 py-1">
            {pendingQuizzes.length} pending
          </Badge>
        )}
      </div>

      {pendingQuizzes.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">All Caught Up!</h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              There are no quizzes pending approval right now. Student-generated quizzes will appear here for your review.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingQuizzes.map((quiz) => (
            <Card key={quiz.id} className="border-l-4 border-l-amber-400">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-5 h-5 text-primary-500" />
                    <h3 className="font-semibold text-gray-800">{quiz.title}</h3>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4" />
                      <span>{quiz.course_name || 'No course'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      <span>by {quiz.created_by_name || 'Student'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(quiz.created_at).toLocaleDateString()}</span>
                    </div>
                    <Badge variant="default">{quiz.question_count || 0} questions</Badge>
                    {quiz.difficulty && <Badge variant="info">{quiz.difficulty}</Badge>}
                    {quiz.is_final_exam && <Badge variant="warning">Final Exam</Badge>}
                  </div>

                  {quiz.questions && quiz.questions.length > 0 && (
                    <div className="mt-3 bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">Preview (first 2 questions):</p>
                      {quiz.questions.slice(0, 2).map((q: any, idx: number) => (
                        <p key={idx} className="text-sm text-gray-600 truncate">
                          {idx + 1}. {q.question_text}
                        </p>
                      ))}
                      {quiz.questions.length > 2 && (
                        <p className="text-xs text-gray-400 mt-1">+{quiz.questions.length - 2} more questions</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 lg:flex-col">
                  <Button
                    onClick={() => handleApproval(quiz.id, 'approve')}
                    icon={<CheckCircle className="w-4 h-4" />}
                    size="sm"
                    disabled={processing === quiz.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                  <Button
                    onClick={() => handleApproval(quiz.id, 'reject')}
                    variant="secondary"
                    icon={<XCircle className="w-4 h-4" />}
                    size="sm"
                    disabled={processing === quiz.id}
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => router.push(`/quizzes/${quiz.id}`)}
                    variant="secondary"
                    size="sm"
                    disabled={processing === quiz.id}
                  >
                    View
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-amber-50 border border-amber-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800 text-sm">About Quiz Approvals</h4>
            <p className="text-xs text-amber-700 mt-1">
              When students generate quizzes using AI, they are submitted for review. Approved quizzes become available for all students to take.
              Rejected quizzes are hidden. You can view quiz details before making a decision.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
