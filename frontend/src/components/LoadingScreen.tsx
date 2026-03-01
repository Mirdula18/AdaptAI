import React from 'react';
import { Brain } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] bg-surface-50 flex flex-col items-center justify-center">
      <div className="relative mb-6">
        <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center animate-pulse">
          <Brain className="w-8 h-8 text-white" />
        </div>
        <div className="absolute -inset-2 border-2 border-primary-300 rounded-3xl animate-ping opacity-30" />
      </div>
      <p className="text-xl font-bold gradient-text mb-2">AdaptIQ</p>
      <div className="flex items-center gap-1.5 mt-2">
        <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
