import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Upload, Sparkles, BarChart3, PieChart,
  History, Settings, ChevronLeft, ChevronRight, Menu, X, FlaskConical, Database,
} from 'lucide-react';
import { useDataStore } from '@/stores/useDataStore';

const NAV = [
  { href: '/', label: '总览', icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: '/import', label: '导入', icon: <Upload className="h-4 w-4" /> },
  { href: '/cleaning', label: '清洗', icon: <Sparkles className="h-4 w-4" /> },
  { href: '/analysis', label: '分析', icon: <BarChart3 className="h-4 w-4" /> },
  { href: '/charts', label: '图表', icon: <PieChart className="h-4 w-4" /> },
  { href: '/history', label: '历史', icon: <History className="h-4 w-4" /> },
  { href: '/settings', label: '设置', icon: <Settings className="h-4 w-4" /> },
];

function Logo() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent flex-shrink-0">
      <FlaskConical className="h-4 w-4 text-white" />
    </div>
  );
}

function DatasetPill() {
  const currentDataset = useDataStore((s) => s.currentDataset);
  return (
    <div className="px-2 pb-2">
      <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 bg-[var(--bg-glass)] border-[var(--border-thin)] min-w-0">
        <Database className="h-3.5 w-3.5 text-accent-text flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
            {currentDataset ? currentDataset.name : '未加载数据'}
          </p>
          {currentDataset && (
            <p className="text-[10px] text-[var(--color-text-tertiary)]">{currentDataset.rowCount}行 × {currentDataset.colCount}列</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-full flex-col border-r-[var(--border-thin)] bg-[var(--bg-sidebar)] backdrop-blur-2xl transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b-[var(--border-thin)] px-4">
        <div className="flex items-center gap-2.5">
          <Logo />
          {!collapsed && <span className="text-sm font-bold tracking-tight text-[var(--color-text-primary)]">WaveSight</span>}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {NAV.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              className={`nav-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Dataset + collapse toggle */}
      <div className="border-t-[var(--border-thin)]">
        {!collapsed && <DatasetPill />}
        <div className="p-2">
          <button
            onClick={onToggle}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-accent-light)] hover:text-[var(--color-text-secondary)]"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /> 收起</>}
          </button>
        </div>
      </div>
    </aside>
  );
}

export function MobileHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const currentDataset = useDataStore((s) => s.currentDataset);

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b-[var(--border-thin)] bg-[var(--bg-topbar)] backdrop-blur-xl px-4 lg:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <Logo />
          <span className="text-sm font-bold text-[var(--color-text-primary)] flex-shrink-0">WaveSight</span>
          {currentDataset && (
            <span className="tag text-[10px] text-accent-text border-accent-border bg-accent-light truncate">
              {currentDataset.name}
            </span>
          )}
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-lg p-2 text-[var(--color-text-tertiary)] hover:bg-[var(--color-accent-light)] hover:text-[var(--color-text-primary)] flex-shrink-0">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="fixed left-0 top-14 h-full w-52 bg-[var(--bg-sidebar)] border-r-[var(--border-thin)] p-4" onClick={(e) => e.stopPropagation()}>
            <nav className="space-y-1">
              {NAV.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <button
                    key={item.href}
                    onClick={() => { navigate(item.href); setMobileOpen(false); }}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}