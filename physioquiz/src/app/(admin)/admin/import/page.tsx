'use client';

import { useState } from 'react';

export default function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">Import Word</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Importez un fichier .docx standardisé pour ajouter des questions
      </p>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 shadow-md">
        {/* Upload area */}
        <div className="rounded-xl border-2 border-dashed border-neutral-300 p-8 text-center transition-colors hover:border-primary/50">
          <input
            type="file"
            accept=".docx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="sr-only"
            id="docx-upload"
          />
          <label htmlFor="docx-upload" className="cursor-pointer">
            <p className="text-3xl">📄</p>
            <p className="mt-2 text-sm font-semibold text-neutral-700">
              {file ? file.name : 'Cliquez pour sélectionner un fichier .docx'}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              Format standardisé uniquement (sortie du script de prétraitement)
            </p>
          </label>
        </div>

        {file && (
          <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-sm font-medium text-neutral-700">Fichier sélectionné</p>
            <p className="mt-1 text-xs text-neutral-500">
              {file.name} · {(file.size / 1024).toFixed(1)} Ko
            </p>
            <p className="mt-4 text-xs text-warning">
              L&apos;import automatique via Edge Function sera disponible prochainement.
              En attendant, utilisez le script Python : <code className="rounded bg-neutral-200 px-1 py-0.5 font-mono text-[10px]">python scripts/import_to_db.py</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
