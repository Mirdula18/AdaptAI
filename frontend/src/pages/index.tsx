import React from 'react';
import Link from 'next/link';
import { Brain, BookOpen, Map, BarChart3, Shield, Zap, ArrowRight, Award, MessageSquare, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';

const features = [
  { icon: Brain, title: 'AI-Powered Quizzes', desc: 'Intelligent quiz generation tailored to your learning path using local LLM.', color: 'bg-purple-100 text-purple-600' },
  { icon: Map, title: 'Personalized Roadmaps', desc: 'Get a custom learning plan based on your performance and goals.', color: 'bg-blue-100 text-blue-600' },
  { icon: BookOpen, title: 'Rich Course Content', desc: 'Access PDFs, videos, and curated materials all in one place.', color: 'bg-green-100 text-green-600' },
  { icon: BarChart3, title: 'Progress Analytics', desc: 'Track your improvement with detailed charts and performance insights.', color: 'bg-amber-100 text-amber-600' },
  { icon: Shield, title: 'Fully Offline', desc: 'Works completely offline with local AI — your data never leaves your machine.', color: 'bg-red-100 text-red-600' },
  { icon: Zap, title: 'Adaptive Learning', desc: 'The platform adapts to your skill level and adjusts difficulty dynamically.', color: 'bg-cyan-100 text-cyan-600' },
  { icon: Award, title: 'Certificates', desc: 'Earn and download PDF certificates after passing final course assessments.', color: 'bg-pink-100 text-pink-600' },
  { icon: MessageSquare, title: 'AI Tutor Chatbot', desc: 'Get instant help from your personal AI tutor available 24/7.', color: 'bg-indigo-100 text-indigo-600' },
];

const stats = [
  { value: '100%', label: 'Offline' },
  { value: 'AI', label: 'Powered' },
  { value: '∞', label: 'Quizzes' },
  { value: 'Free', label: 'Forever' },
];

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (user) router.push('/dashboard');
  }, [user, router]);

  return (
    <div className="min-h-screen bg-surface-50 overflow-hidden">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 sm:px-12 py-5 bg-white/80 backdrop-blur-md border-b border-primary-100 sticky top-0 z-30">
        <div className="flex items-center space-x-2">
          <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold gradient-text">AdaptIQ</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-primary-500 transition-smooth">
            Sign In
          </Link>
          <Link href="/register" className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-xl hover:bg-primary-600 transition-smooth shadow-md shadow-primary-500/20">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-6 sm:px-12 py-20 sm:py-32 text-center max-w-5xl mx-auto">
        {/* Decorative blobs */}
        <div className="absolute top-10 left-10 w-72 h-72 bg-primary-200 rounded-full blur-3xl opacity-20 animate-pulse" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-200 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="relative z-10">
          <div className="inline-flex items-center space-x-2 bg-primary-100 text-primary-700 text-xs font-medium px-4 py-1.5 rounded-full mb-6 animate-fadeIn">
            <Zap className="w-3.5 h-3.5" />
            <span>AI-Powered • Offline-First • Adaptive • Free</span>
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 leading-tight mb-6 animate-fadeIn" style={{ animationDelay: '100ms' }}>
            Learn Smarter with{' '}
            <span className="gradient-text">AdaptIQ</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10 animate-fadeIn" style={{ animationDelay: '200ms' }}>
            An AI-powered adaptive learning platform that generates personalized quizzes,
            learning roadmaps, and tracks your progress — all running locally and offline.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fadeIn" style={{ animationDelay: '300ms' }}>
            <Link href="/register" className="flex items-center space-x-2 px-8 py-3.5 bg-primary-500 text-white font-semibold rounded-2xl hover:bg-primary-600 transition-smooth shadow-lg shadow-primary-500/30 text-base group">
              <span>Start Learning Free</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/login" className="px-8 py-3.5 bg-white text-primary-600 font-semibold rounded-2xl hover:bg-primary-50 transition-smooth border border-primary-200 text-base">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Banner */}
      <section className="px-6 sm:px-12 py-8 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div key={i} className="text-center p-4 bg-white rounded-2xl border border-primary-100 card-hover">
              <p className="text-3xl font-extrabold gradient-text">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 sm:px-12 py-20 max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-800 mb-4">Everything You Need to Excel</h2>
        <p className="text-center text-gray-500 mb-12 max-w-xl mx-auto">Built from the ground up for intelligent, personalized learning experiences.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <div key={i} className="bg-white rounded-2xl border border-primary-100 p-6 card-hover" style={{ animationDelay: `${i * 50}ms` }}>
              <div className={`w-12 h-12 ${f.color.split(' ')[0]} rounded-2xl flex items-center justify-center mb-4`}>
                <f.icon className={`w-6 h-6 ${f.color.split(' ')[1]}`} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 sm:px-12 py-20 bg-white border-y border-primary-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Enroll in Courses', desc: 'Browse courses created by instructors and enroll in the ones that match your goals.' },
              { step: '02', title: 'Take AI Quizzes', desc: 'The AI generates quizzes tailored to your learning level, then provides personalized roadmaps.' },
              { step: '03', title: 'Earn Certificates', desc: 'Pass the final assessment and earn a downloadable PDF certificate for your achievement.' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white text-xl font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-800 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 sm:px-12 py-20 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Ready to Start Learning?</h2>
          <p className="text-gray-500 mb-8">Join AdaptIQ today and experience AI-powered personalized education.</p>
          <Link href="/register" className="inline-flex items-center space-x-2 px-8 py-3.5 bg-primary-500 text-white font-semibold rounded-2xl hover:bg-primary-600 transition-smooth shadow-lg shadow-primary-500/30 text-base group">
            <span>Create Free Account</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 sm:px-12 py-8 border-t border-primary-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold gradient-text">AdaptIQ</span>
          </div>
          <p className="text-sm text-gray-400">© 2026 AdaptIQ by ACADEX AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
