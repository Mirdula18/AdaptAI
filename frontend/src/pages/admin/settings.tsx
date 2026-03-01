import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { licenseAPI, quizzesAPI } from '@/lib/api';
import { Card, Button, Input, Badge, Loading } from '@/components/ui';
import { Settings, Key, Brain, Server, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseStatus, setLicenseStatus] = useState<any>(null);
  const [llmStatus, setLlmStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role !== 'admin') router.push('/dashboard');
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [licRes, llmRes] = await Promise.all([
        licenseAPI.status(),
        quizzesAPI.llmStatus(),
      ]);
      setLicenseStatus(licRes.data);
      setLlmStatus(llmRes.data);
    } catch {}
    finally { setLoading(false); }
  };

  const handleActivate = async () => {
    try {
      await licenseAPI.activate({ license_key: licenseKey });
      toast.success('License activated!');
      setLicenseKey('');
      loadData();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Activation failed'); }
  };

  const handleDeactivate = async () => {
    try {
      await licenseAPI.deactivate();
      toast.success('License deactivated');
      loadData();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  if (loading) return <Loading />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary-500" /> Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">Platform configuration and status</p>
      </div>

      {/* LLM Status */}
      <Card>
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary-500" /> LLM Service Status
        </h3>
        <div className="flex items-center gap-3 mb-3">
          {llmStatus?.status === 'online' ? (
            <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1 inline" /> Online</Badge>
          ) : (
            <Badge variant="danger"><XCircle className="w-3 h-3 mr-1 inline" /> Offline</Badge>
          )}
        </div>
        {llmStatus?.models?.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Available Models:</p>
            <div className="flex flex-wrap gap-2">
              {llmStatus.models.map((m: string) => (
                <Badge key={m} variant="primary">{m}</Badge>
              ))}
            </div>
          </div>
        )}
        {llmStatus?.status !== 'online' && (
          <p className="text-sm text-gray-500 mt-3">
            Start Ollama with: <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">ollama serve</code> then pull a model like <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">ollama pull gemma:2b</code>
          </p>
        )}
      </Card>

      {/* License */}
      <Card>
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-primary-500" /> License Management
        </h3>
        {licenseStatus?.is_licensed ? (
          <div>
            <Badge variant="success" className="mb-3">Licensed</Badge>
            <p className="text-sm text-gray-500">
              Activated: {new Date(licenseStatus.activation.activated_at).toLocaleDateString()}
            </p>
            {licenseStatus.activation.expires_at && (
              <p className="text-sm text-gray-500">
                Expires: {new Date(licenseStatus.activation.expires_at).toLocaleDateString()}
              </p>
            )}
            <Button variant="danger" size="sm" className="mt-4" onClick={handleDeactivate}>Deactivate License</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Activate your AdaptIQ license:</p>
            <div className="flex gap-2">
              <Input placeholder="Enter license key" value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)} />
              <Button onClick={handleActivate} disabled={!licenseKey.trim()}>Activate</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Platform Info */}
      <Card>
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-primary-500" /> Platform Info
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500">Platform</span>
            <span className="font-medium">AdaptIQ by ACADEX AI</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500">Version</span>
            <span className="font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500">Backend</span>
            <span className="font-medium">Flask + SQLite</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500">Frontend</span>
            <span className="font-medium">Next.js + Tailwind CSS</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">LLM Runtime</span>
            <span className="font-medium">Ollama (Local)</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
