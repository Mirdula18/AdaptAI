import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import Chatbot from '@/components/Chatbot';
import LoadingScreen from '@/components/LoadingScreen';
import { Toaster } from 'react-hot-toast';
import { useRouter } from 'next/router';

const publicPages = ['/', '/login', '/register', '/forgot-password'];

function AppContent({ Component, pageProps }: { Component: any; pageProps: any }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const isPublic = publicPages.includes(router.pathname);

  if (loading) return <LoadingScreen />;

  // Show chatbot only for students, hide during quiz attempts
  const isQuizPage = /^\/quizzes\/[^/]+$/.test(router.pathname) || router.asPath.startsWith('/quizzes/') && router.asPath !== '/quizzes';
  const showChatbot = user && user.role === 'student' && !isQuizPage;

  return (
    <>
      {isPublic ? (
        <Component {...pageProps} />
      ) : (
        <Layout>
          <Component {...pageProps} />
        </Layout>
      )}
      {showChatbot && <Chatbot />}
    </>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#333', color: '#fff', borderRadius: '12px' },
        }}
      />
      <AppContent Component={Component} pageProps={pageProps} />
    </AuthProvider>
  );
}
