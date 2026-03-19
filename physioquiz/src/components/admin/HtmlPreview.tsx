'use client';

import DOMPurify from 'isomorphic-dompurify';

interface HtmlPreviewProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  id: string;
}

export default function HtmlPreview({ value, onChange, label, id }: HtmlPreviewProps) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-neutral-700">{label}</label>
      <div className="mt-1 grid grid-cols-1 gap-3 md:grid-cols-2">
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="HTML de l'explication..."
        />
        <div className="glass-card-inner p-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Aperçu</p>
          {value ? (
            <div
              className="prose prose-sm max-w-none text-neutral-700"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value) }}
            />
          ) : (
            <p className="text-xs text-neutral-400">Aucun contenu</p>
          )}
        </div>
      </div>
    </div>
  );
}
