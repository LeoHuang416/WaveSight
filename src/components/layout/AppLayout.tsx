import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar, { MobileHeader } from './Sidebar';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

  // React-router HashRouter: jump to top on navigation
  useEffect(() => {
    if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-slate-200">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-pink-500/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-grid opacity-50" />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>

      {/* Mobile header */}
      <MobileHeader />

      {/* Main content */}
      <main
        className={`transition-all duration-300 min-h-screen ${
          collapsed ? 'lg:ml-16' : 'lg:ml-56'
        }`}
      >
        <div className="lg:pt-0 pt-14">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
