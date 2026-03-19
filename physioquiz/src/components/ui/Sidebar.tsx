'use client';

import { BookOpenText, Target, ChartBar, House, Database, UploadSimple } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

function NavLink({ item }: { item: NavItem }) {
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
      <span className="flex items-center">{item.icon}</span>
      <span className="hidden md:inline">{item.label}</span>
    </Link>
  );
}

export function DesktopSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const nav = isAdmin ? adminNav : studentNav;

  return (
    <aside className="hidden w-56 shrink-0 border-r border-white/40 bg-white/70 backdrop-blur-xl md:block">
      <nav className="flex flex-col gap-1 p-4">
        {nav.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>
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
        background: 'rgba(255, 255, 255, 0.82)',
        WebkitBackdropFilter: 'blur(20px)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.8)',
        boxShadow: '0 -2px 16px rgba(0, 0, 0, 0.04), 0 0 40px rgba(255, 255, 255, 0.9), inset 0 1px 0 rgba(255, 255, 255, 1)',
      }}
    >
      <div className="flex h-[49px] items-center justify-around">
        {nav.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </div>
    </nav>
  );
}
