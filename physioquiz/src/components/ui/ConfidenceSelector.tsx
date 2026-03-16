'use client';

import { CONFIDENCE_VALUES } from '@/types';
import { memo } from 'react';

interface ConfidenceSelectorProps {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled: boolean;
}

const options = [
  {
    label: 'Je devine',
    value: CONFIDENCE_VALUES.GUESS,
    icon: '?',
  },
  {
    label: 'Hésitant',
    value: CONFIDENCE_VALUES.HESITANT,
    icon: '~',
  },
  {
    label: 'Sûr',
    value: CONFIDENCE_VALUES.SURE,
    icon: '✓',
  },
] as const;

export default memo(function ConfidenceSelector({
  value,
  onChange,
  disabled,
}: ConfidenceSelectorProps) {
  return (
    <div>
      <p className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-neutral-400">
        Niveau de confiance
      </p>
      <div className="grid grid-cols-3 gap-3" role="group" aria-label="Niveau de confiance">
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onChange(opt.value)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={`flex min-h-[44px] flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-neutral-200 text-neutral-500 hover:border-primary/40 hover:bg-primary/5'
              } ${disabled ? 'cursor-default opacity-60' : ''}`}
            >
              <span className={`text-lg ${isSelected ? 'text-primary' : 'text-neutral-400'}`}>
                {opt.icon}
              </span>
              <span className="text-[10px] font-bold uppercase">
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
