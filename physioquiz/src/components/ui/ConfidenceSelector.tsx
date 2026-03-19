'use client';

import { CoinVertical, Scales, SealCheck } from '@phosphor-icons/react';
import { CONFIDENCE_VALUES } from '@/types';
import { memo } from 'react';

interface ConfidenceSelectorProps {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled: boolean;
}

const options: readonly {
  label: string;
  value: number;
  icon: React.ReactNode;
  selectedBg: string;
  selectedText: string;
  selectedIcon: string;
}[] = [
  {
    label: 'Je devine',
    value: CONFIDENCE_VALUES.GUESS,
    icon: <CoinVertical size={16} weight="fill" className="rotate-45" />,
    selectedBg: 'bg-amber-50',
    selectedText: 'text-warning',
    selectedIcon: 'text-warning',
  },
  {
    label: 'Hésitant',
    value: CONFIDENCE_VALUES.HESITANT,
    icon: <Scales size={16} />,
    selectedBg: 'bg-sky-50',
    selectedText: 'text-medical-teal',
    selectedIcon: 'text-medical-teal',
  },
  {
    label: 'Sûr',
    value: CONFIDENCE_VALUES.SURE,
    icon: <SealCheck size={16} weight="fill" />,
    selectedBg: 'bg-teal-50',
    selectedText: 'text-teal-600',
    selectedIcon: 'text-teal-600',
  },
];

export default memo(function ConfidenceSelector({
  value,
  onChange,
  disabled,
}: ConfidenceSelectorProps) {
  return (
    <div>
      <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-widest text-neutral-400">
        Niveau de confiance
      </p>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Niveau de confiance">
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onChange(opt.value)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 transition-all ${
                isSelected
                  ? `${opt.selectedBg} ${opt.selectedText}`
                  : 'text-neutral-500 hover:bg-white/50'
              } ${disabled ? 'cursor-default opacity-60' : ''}`}
            >
              <span className="text-[10px] font-bold uppercase">
                {opt.label}
              </span>
              <span className={`flex items-center ${isSelected ? opt.selectedIcon : 'text-neutral-400'}`}>
                {opt.icon}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
