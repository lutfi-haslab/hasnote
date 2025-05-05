import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Book, Settings, Key } from 'lucide-react';

const MobileNav: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 md:hidden z-[55]">
      <div className="flex items-center justify-around h-16">
        <Link
          to="/"
          className={`flex flex-col items-center justify-center px-4 py-2 ${
            isActive('/') ? 'text-blue-600' : 'text-slate-600'
          }`}
        >
          <Home size={20} />
          <span className="text-xs mt-1">Home</span>
        </Link>

        <Link
          to="/pages"
          className={`flex flex-col items-center justify-center px-4 py-2 ${
            isActive('/pages') || isActive('/page')
              ? 'text-blue-600'
              : 'text-slate-600'
          }`}
        >
          <Book size={20} />
          <span className="text-xs mt-1">Pages</span>
        </Link>

        <Link
          to="/secret"
          className={`flex flex-col items-center justify-center px-4 py-2 ${
            isActive('/secret') ? 'text-blue-600' : 'text-slate-600'
          }`}
        >
          <Key size={20} />
          <span className="text-xs mt-1">Secret</span>
        </Link>

        <Link
          to="/settings"
          className={`flex flex-col items-center justify-center px-4 py-2 ${
            isActive('/settings') ? 'text-blue-600' : 'text-slate-600'
          }`}
        >
          <Settings size={20} />
          <span className="text-xs mt-1">Settings</span>
        </Link>
      </div>
    </nav>
  );
};

export default MobileNav;
