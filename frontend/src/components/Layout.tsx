import React, { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { notificationsAPI } from '@/lib/api';
import {
  LayoutDashboard, BookOpen, FileText, Brain, Map, Users,
  Shield, LogOut, Menu, X, ChevronDown, Bell, Settings, BarChart3,
  Award, User, CheckSquare
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const navigation = {
  student: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Courses', href: '/courses', icon: BookOpen },
    { name: 'Quizzes', href: '/quizzes', icon: Brain },
    { name: 'My Roadmaps', href: '/roadmaps', icon: Map },
    { name: 'Progress', href: '/progress', icon: BarChart3 },
    { name: 'Certificates', href: '/certificates', icon: Award },
  ],
  instructor: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Courses', href: '/courses', icon: BookOpen },
    { name: 'Materials', href: '/materials', icon: FileText },
    { name: 'Quizzes', href: '/quizzes', icon: Brain },
    { name: 'Approvals', href: '/approvals', icon: CheckSquare },
    { name: 'Roadmaps', href: '/roadmaps', icon: Map },
    { name: 'Students', href: '/admin/users', icon: Users },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  ],
  admin: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Courses', href: '/courses', icon: BookOpen },
    { name: 'Materials', href: '/materials', icon: FileText },
    { name: 'Quizzes', href: '/quizzes', icon: Brain },
    { name: 'Approvals', href: '/approvals', icon: CheckSquare },
    { name: 'Roadmaps', href: '/roadmaps', icon: Map },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { name: 'Audit Logs', href: '/admin/audit-logs', icon: Shield },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ],
};

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (user) loadUnreadCount();
    const interval = setInterval(() => {
      if (user) loadUnreadCount();
    }, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [user]);

  const loadUnreadCount = async () => {
    try {
      const res = await notificationsAPI.unreadCount();
      setUnreadCount(res.data.unread_count);
    } catch {}
  };

  if (!user) return <>{children}</>;

  const navItems = navigation[user.role] || navigation.student;

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-primary-100 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-primary-100">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">AdaptIQ</span>
          </Link>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const isActive = router.pathname === item.href || router.pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-smooth ${
                  isActive
                    ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30'
                    : 'text-gray-600 hover:bg-primary-50 hover:text-primary-600'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-primary-100">
          <button
            onClick={logout}
            className="flex items-center space-x-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-smooth"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-primary-100">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4">
            <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6 text-gray-600" />
            </button>

            <div className="flex-1 lg:flex-none" />

            <div className="flex items-center space-x-4">
              <Link href="/notifications" className="p-2 rounded-xl hover:bg-primary-50 transition-smooth relative">
                <Bell className="w-5 h-5 text-gray-500" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-primary-50 transition-smooth"
                >
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-semibold text-gray-800">{user.full_name}</p>
                    <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block" />
                </button>
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-primary-100 z-50 py-2 animate-fadeIn">
                      <Link href="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-primary-50 transition-smooth"
                        onClick={() => setProfileOpen(false)}>
                        <User className="w-4 h-4" /> My Profile
                      </Link>
                      <Link href="/notifications" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-primary-50 transition-smooth"
                        onClick={() => setProfileOpen(false)}>
                        <Bell className="w-4 h-4" /> Notifications
                        {unreadCount > 0 && <span className="ml-auto text-xs bg-red-100 text-red-600 px-1.5 rounded-full">{unreadCount}</span>}
                      </Link>
                      <div className="border-t border-gray-100 my-1" />
                      <button onClick={logout} className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 w-full transition-smooth">
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8 animate-fadeIn">
          {children}
        </main>
      </div>
    </div>
  );
}
