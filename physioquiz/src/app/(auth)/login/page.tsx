'use client';

import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push('/practice');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page-gradient px-4 py-8">
      <div className="w-full max-w-md glass-card p-6 sm:p-8">
        <h1 className="mb-2 text-center text-2xl font-bold text-neutral-900">Les Incollables</h1>
        <p className="mb-8 text-center text-sm text-neutral-500">
          Connectez-vous pour continuer
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-neutral-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full glass-input px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-neutral-700">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full glass-input px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Votre mot de passe"
            />
          </div>

          {error && (
            <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="min-h-[44px] w-full rounded-2xl bg-primary glass-btn py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Pas encore de compte ?{' '}
          <Link href="/register" className="font-medium text-primary hover:text-primary-700">
            Inscrivez-vous
          </Link>
        </p>
      </div>
    </div>
  );
}
