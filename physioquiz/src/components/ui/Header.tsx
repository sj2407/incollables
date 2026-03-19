'use client';

import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export default function Header() {
  const { profile, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-primary/10 bg-background-light/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/practice" className="text-xl font-bold tracking-tight text-primary md:text-2xl">
          Les Incollables
        </Link>

        <div className="flex items-center gap-4">
          {profile && (
            <>
              <span className="hidden text-sm text-neutral-500 sm:inline">
                {profile.full_name}
              </span>
              {profile.role === 'admin' && (
                <Link
                  href="/admin"
                  className="min-h-[44px] inline-flex items-center rounded-2xl bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-100"
                >
                  Admin
                </Link>
              )}
              <button
                type="button"
                onClick={signOut}
                aria-label="Se déconnecter"
                className="min-h-[44px] rounded-2xl px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
              >
                Déconnexion
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
