import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { certificatesAPI } from '@/lib/api';
import { Card, Loading, Button, Badge } from '@/components/ui';
import { Award, Download, Calendar, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CertificatesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    loadCertificates();
  }, [user, authLoading]);

  const loadCertificates = async () => {
    try {
      const res = await certificatesAPI.list();
      setCertificates(Array.isArray(res.data) ? res.data : res.data.certificates || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (certId: string, courseName: string) => {
    try {
      const res = await certificatesAPI.download(certId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Certificate_${courseName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Certificate downloaded!');
    } catch (err) {
      toast.error('Failed to download certificate');
    }
  };

  if (authLoading || loading) return <Loading text="Loading certificates..." />;
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{user?.role === 'admin' || user?.role === 'instructor' ? 'All Certificates' : 'My Certificates'}</h1>
        <p className="text-sm text-gray-500 mt-1">Certificates earned from completing course final exams</p>
      </div>

      {certificates.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Certificates Yet</h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
              Complete final exams in your enrolled courses to earn certificates. Keep learning and you'll earn your first one soon!
            </p>
            <Button onClick={() => router.push('/courses')}>Browse Courses</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {certificates.map((cert) => (
            <Card key={cert.id} className="relative overflow-hidden">
              {/* Decorative ribbon */}
              <div className="absolute top-0 right-0 w-20 h-20 overflow-hidden">
                <div className="absolute top-3 right-[-20px] w-[100px] bg-primary-500 text-white text-xs font-bold text-center py-1 transform rotate-45">
                  Earned
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary-50 rounded-xl">
                  <Award className="w-8 h-8 text-primary-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">{cert.course_name || cert.course_title || 'Unknown Course'}</h3>
                  <p className="text-sm text-gray-500 mt-1">{cert.certificate_type === 'completion' ? 'Course Completion' : 'Achievement'}</p>
                  {cert.user_name && <p className="text-xs text-gray-400">{cert.user_name}</p>}
                  
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(cert.issued_at).toLocaleDateString()}</span>
                    </div>
                    {cert.score && (
                      <Badge variant="success">Score: {cert.score}%</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400 font-mono">ID: {cert.id.slice(0, 8)}...</span>
                <Button
                  size="sm"
                  icon={<Download className="w-4 h-4" />}
                  onClick={() => handleDownload(cert.id, cert.course_name)}
                >
                  Download PDF
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
