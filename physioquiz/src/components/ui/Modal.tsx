'use client';

import { useCallback, useEffect, useRef } from 'react';
import { X } from '@phosphor-icons/react';

interface ModalProps {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
  ariaLabel?: string;
  maxWidth?: string;
}

export default function Modal({ children, onClose, title, ariaLabel, maxWidth = 'max-w-lg' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape key closes
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus panel on mount
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // Prevent body scroll while modal is open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? ariaLabel ?? 'Dialogue'}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-lg outline-none animate-fade-in`}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
            <h2 className="text-base font-bold text-neutral-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
