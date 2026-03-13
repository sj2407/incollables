'use client';

import { useEffect } from 'react';

export default function StudentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center" role="alert">
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-md sm:p-8">
        <p className="text-lg font-bold text-neutral-900">
          Une erreur est survenue
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Un problème technique nous empêche d&apos;afficher cette page.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 min-h-[44px] rounded-lg bg-primary-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
