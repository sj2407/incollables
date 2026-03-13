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
    selectedBg: 'bg-warning text-white',
  },
  {
    label: 'Hésitant',
    value: CONFIDENCE_VALUES.HESITANT,
    selectedBg: 'bg-info text-white',
  },
  {
    label: 'Sûr',
    value: CONFIDENCE_VALUES.SURE,
    selectedBg: 'bg-secondary-500 text-white',
  },
] as const;

export default memo(function ConfidenceSelector({
  value,
  onChange,
  disabled,
}: ConfidenceSelectorProps) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-neutral-500">
        Confiance (optionnel) :
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Niveau de confiance">
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onChange(opt.value)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={`min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                isSelected
                  ? opt.selectedBg
                  : 'text-neutral-500 hover:bg-neutral-100'
              } ${disabled ? 'cursor-default opacity-60' : ''}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
});
