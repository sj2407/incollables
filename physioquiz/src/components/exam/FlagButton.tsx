'use client';

import { Flag } from '@phosphor-icons/react';
import { memo } from 'react';

interface FlagButtonProps {
  isFlagged: boolean;
  onToggle: () => void;
}

export default memo(function FlagButton({ isFlagged, onToggle }: FlagButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isFlagged}
      aria-label={isFlagged ? 'Retirer le marquage' : 'Marquer pour revue'}
      className={`flex min-h-[44px] items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${
        isFlagged
          ? 'border-warning bg-amber-50 text-warning border'
          : 'glass-btn-secondary text-neutral-500 hover:border-warning hover:bg-amber-50 hover:text-warning'
      }`}
    >
      <Flag size={16} weight={isFlagged ? 'fill' : 'regular'} aria-hidden="true" />
      {isFlagged ? 'Marquée' : 'Marquer'}
    </button>
  );
});
