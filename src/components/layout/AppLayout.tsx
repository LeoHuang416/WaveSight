import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar, { MobileHeader } from './Sidebar';
import ShortcutHelp from '@/components/common/ShortcutHelp';
import { useHotkeys } from '@/hooks/useHotkeys';

const NAV = [
  { href: '/', label: '总览' },
  { href: '/import', label: '导入' },
  { href: '/cleaning', label: '清洗' },
  { href: '/analysis', label: '分析' },
  { href: '/charts', label: '图表' },
  { href: '/history', label: '历史' },
  { href: '/settings', label: '设置' },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const navigate = useNavigate();

  // React-router HashRouter: jump to top on navigation
  useEffect(() => {
    if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
  }, []);

  useHotkeys([
    ...NAV.map((item, i) => ({ combo: `alt+${i + 1}`, callback: () => navigate(item.href) })),
    { combo: 'shift+/', callback: () => setHelpOpen(true) },
    { combo: '/', callback: () => setHelpOpen(true) },
  ]);

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

      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
