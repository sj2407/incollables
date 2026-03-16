'use client';

import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [university, setUniversity] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // If email confirmation is required, user.identities will be empty
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setSuccess(true);
      setLoading(false);
      return;
    }

    // If auto-confirmed, update profile and redirect
    if (data.user) {
      await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          university: university || null,
          year_of_study: yearOfStudy ? parseInt(yearOfStudy, 10) : null,
        })
        .eq('id', data.user.id);

      router.push('/practice');
      router.refresh();
      return;
    }

    // Email confirmation required
    setSuccess(true);
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-neutral-50 px-4 py-8">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-md sm:p-8">
        <h1 className="mb-2 text-center text-2xl font-bold text-neutral-900">Les Incollables</h1>
        <p className="mb-8 text-center text-sm text-neutral-500">Cr&eacute;ez votre compte</p>

        {success && (
          <div role="alert" className="mb-6 rounded-lg bg-secondary-50 p-4 text-sm text-secondary-600">
            Un email de confirmation a &eacute;t&eacute; envoy&eacute; &agrave; <strong>{email}</strong>.
            V&eacute;rifiez votre bo&icirc;te de r&eacute;ception pour activer votre compte.
          </div>
        )}

        {!success && <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-neutral-700">
              Nom complet *
            </label>
            <input
              id="fullName"
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="Votre nom"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-neutral-700">
              Email *
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-neutral-700">
              Mot de passe *
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="Minimum 6 caract&egrave;res"
            />
          </div>

          <div>
            <label
              htmlFor="university"
              className="mb-1 block text-sm font-medium text-neutral-700"
            >
              Universit&eacute;
            </label>
            <input
              id="university"
              type="text"
              autoComplete="organization"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="Facult&eacute; de m&eacute;decine de..."
            />
          </div>

          <div>
            <label
              htmlFor="yearOfStudy"
              className="mb-1 block text-sm font-medium text-neutral-700"
            >
              Ann&eacute;e d&apos;&eacute;tude
            </label>
            <select
              id="yearOfStudy"
              value={yearOfStudy}
              onChange={(e) => setYearOfStudy(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-4 py-3 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">S&eacute;lectionnez</option>
              <option value="1">1&egrave;re ann&eacute;e</option>
              <option value="2">2&egrave;me ann&eacute;e</option>
              <option value="3">3&egrave;me ann&eacute;e</option>
              <option value="4">4&egrave;me ann&eacute;e</option>
              <option value="5">5&egrave;me ann&eacute;e</option>
              <option value="6">6&egrave;me ann&eacute;e</option>
              <option value="7">7&egrave;me ann&eacute;e</option>
            </select>
          </div>

          {error && (
            <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="min-h-[44px] w-full rounded-lg bg-primary-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
          >
            {loading ? 'Inscription...' : "S'inscrire"}
          </button>
        </form>}

        <p className="mt-6 text-center text-sm text-neutral-500">
          D&eacute;j&agrave; un compte ?{' '}
          <Link href="/login" className="font-medium text-primary-500 hover:text-primary-600">
            Connectez-vous
          </Link>
        </p>
      </div>
    </div>
  );
}
