import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { Input, Button } from '@/components/ui';
import { Brain, Mail, Lock, User } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (user) router.push('/dashboard');
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.username, form.password);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-6">
            <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold gradient-text">AdaptIQ</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Welcome Back</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your learning account</p>
        </div>

        <div className="bg-white rounded-2xl border border-primary-100 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Username or Email"
              placeholder="Enter your username or email"
              icon={<User className="w-4 h-4" />}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              icon={<Lock className="w-4 h-4" />}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Sign In
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/forgot-password" className="text-sm text-primary-500 hover:underline">
              Forgot your password?
            </Link>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Don't have an account?{' '}
          <Link href="/register" className="text-primary-500 font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
