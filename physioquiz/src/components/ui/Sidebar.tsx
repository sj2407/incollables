'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const studentNav: NavItem[] = [
  { href: '/learn', label: 'Apprendre', icon: '📖' },
  { href: '/practice', label: "S'entraîner", icon: '🎯' },
  { href: '/stats', label: 'Mes résultats', icon: '📊' },
];

const adminNav: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: '🏠' },
  { href: '/admin/topics', label: 'Topics', icon: '📁' },
  { href: '/admin/questions', label: 'Questions', icon: '❓' },
  { href: '/admin/import', label: 'Import', icon: '📥' },
  { href: '/admin/stats', label: 'Stats', icon: '📊' },
];

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;

  return (
    <Link
      href={item.href}
      aria-label={item.label}
      title={item.label}
      className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-primary-50 text-primary-600'
          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
      }`}
    >
      <span className="text-base">{item.icon}</span>
      <span className="hidden md:inline">{item.label}</span>
    </Link>
  );
}

export function DesktopSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const nav = isAdmin ? adminNav : studentNav;

  return (
    <aside className="hidden w-56 shrink-0 border-r border-neutral-200 bg-white md:block">
      <nav className="flex flex-col gap-1 p-4">
        {nav.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>
    </aside>
  );
}

export function MobileBottomNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const nav = isAdmin ? adminNav.slice(0, 4) : studentNav;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white md:hidden">
      <div className="flex items-center justify-around py-2">
        {nav.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </div>
    </nav>
  );
}
