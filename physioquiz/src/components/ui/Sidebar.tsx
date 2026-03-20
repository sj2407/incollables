'use client';

import { BookOpenText, Target, ChartBar, House, Database, UploadSimple } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const studentNav: NavItem[] = [
  { href: '/learn', label: 'Apprendre', icon: <BookOpenText size={20} /> },
  { href: '/practice', label: "S'entraîner", icon: <Target size={20} /> },
  { href: '/stats', label: 'Mes résultats', icon: <ChartBar size={20} /> },
];

const adminNav: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: <House size={20} /> },
  { href: '/admin/questions', label: 'Base de données', icon: <Database size={20} /> },
  { href: '/admin/import', label: 'Import', icon: <UploadSimple size={20} /> },
];

const STORAGE_KEY = 'sidebar-width';
const DEFAULT_WIDTH = 224; // w-56
const MIN_WIDTH = 140;
const MAX_WIDTH_RATIO = 0.25; // 25% of viewport

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;

  return (
    <Link
      href={item.href}
      aria-label={item.label}
      title={item.label}
      className={`flex min-h-[44px] items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-primary-50 text-primary'
          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
      }`}
    >
      <span className="flex shrink-0 items-center">{item.icon}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

export function DesktopSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const nav = isAdmin ? adminNav : studentNav;
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Load persisted width
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = Number(saved);
      if (parsed >= MIN_WIDTH && parsed <= window.innerWidth * MAX_WIDTH_RATIO) {
        setWidth(parsed);
      }
    }
  }, []);

  const collapsed = width < 170;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      const newWidth = Math.min(Math.max(startWidth.current + delta, MIN_WIDTH), window.innerWidth * MAX_WIDTH_RATIO);
      setWidth(newWidth);
    }

    function handlePointerUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Persist
      localStorage.setItem(STORAGE_KEY, String(Math.round(width)));
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [width]);

  return (
    <aside
      className="relative hidden shrink-0 border-r border-white/30 bg-white/30 backdrop-blur-sm md:block"
      style={{ width }}
    >
      <nav className="flex flex-col gap-1 p-4">
        {nav.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>
      {/* Resize handle */}
      <div
        onPointerDown={handlePointerDown}
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/10 active:bg-primary/20 transition-colors"
        title="Redimensionner"
      />
    </aside>
  );
}

export function MobileBottomNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const nav = isAdmin ? adminNav : studentNav;

  return (
    <nav
      className="fixed z-50 md:hidden"
      style={{
        bottom: 'env(safe-area-inset-bottom, 8px)',
        left: 12,
        right: 12,
        borderRadius: 20,
        background: 'rgba(255, 255, 255, 0.35)',
        WebkitBackdropFilter: 'blur(20px)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.4)',
        boxShadow: '0 -2px 16px rgba(0, 0, 0, 0.04), 0 0 30px rgba(255, 255, 255, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
      }}
    >
      <div className="flex h-[49px] items-center justify-around">
        {nav.map((item) => (
          <NavLink key={item.href} item={item} collapsed={false} />
        ))}
      </div>
    </nav>
  );
}
