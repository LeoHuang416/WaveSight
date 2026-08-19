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
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--color-text-primary)]">
      {/* Background grid (subtle) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-40" />
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
