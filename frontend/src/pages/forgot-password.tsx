import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { authAPI } from '@/lib/api';
import { Input, Button } from '@/components/ui';
import { Brain, Mail, Lock, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authAPI.forgotPassword(email);
      toast.success('If your email is registered, a reset code has been sent.');
      // In dev mode, we get the token back
      if (res.data.reset_token) {
        setResetToken(res.data.reset_token);
      }
      setStep('reset');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authAPI.resetPassword({
        token: resetToken,
        otp: otp,
        new_password: newPassword,
      });
      toast.success('Password reset successfully! You can now login.');
      router.push('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
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
          <h1 className="text-2xl font-bold text-gray-800">
            {step === 'email' ? 'Forgot Password' : 'Reset Password'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {step === 'email'
              ? 'Enter your email to receive a reset code'
              : 'Enter the code and your new password'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-primary-100 shadow-sm p-8">
          {step === 'email' ? (
            <form onSubmit={handleRequestReset} className="space-y-5">
              <Input
                label="Email Address"
                type="email"
                placeholder="Enter your registered email"
                icon={<Mail className="w-4 h-4" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" loading={loading} className="w-full" size="lg">
                Send Reset Code
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <Input
                label="Reset Token"
                placeholder="Paste your reset token"
                icon={<KeyRound className="w-4 h-4" />}
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                required
              />
              <Input
                label="OTP Code (if received by email)"
                placeholder="6-digit code"
                icon={<KeyRound className="w-4 h-4" />}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
              />
              <Input
                label="New Password"
                type="password"
                placeholder="At least 6 characters"
                icon={<Lock className="w-4 h-4" />}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
              <Input
                label="Confirm Password"
                type="password"
                placeholder="Repeat your new password"
                icon={<Lock className="w-4 h-4" />}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <Button type="submit" loading={loading} className="w-full" size="lg">
                Reset Password
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Remember your password?{' '}
          <Link href="/login" className="text-primary-500 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
