import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import Spinner from '../ui/Spinner';
import { Menu, X } from 'lucide-react';

const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading, error, fetchUser, initialized } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialized) {
      fetchUser();
    }
  }, [initialized, fetchUser]);

  useEffect(() => {
    if (initialized && !loading && !user) {
      navigate('/login');
    }
  }, [initialized, loading, user, navigate]);

  if (!initialized || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login page
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Sidebar is always rendered in desktop view */}
      <div className="hidden md:block">
        <Sidebar
          isOpen={true} // Always open on desktop
          onToggle={() => {}} // No toggle needed on desktop
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </main>

        {/* Mobile navigation toggle button */}
        <div className="fixed bottom-20 right-4 z-[55] md:hidden">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 bg-white rounded-md shadow-md"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile navigation sidebar */}
        <div className="md:hidden">
          <Sidebar
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
          />
        </div>

        {/* Mobile specific navigation */}
        <MobileNav />
      </div>
    </div>
  );
};

export default MainLayout;
