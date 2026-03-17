'use client';

import Modal from './Modal';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmModalProps) {
  return (
    <Modal onClose={onCancel} title={title} maxWidth="max-w-sm">
      <p className="text-sm text-neutral-600">{message}</p>
      {children}
      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`min-h-[44px] rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg ${
            danger
              ? 'bg-error shadow-error/25 hover:bg-red-700'
              : 'bg-primary shadow-primary/25 hover:bg-primary/90'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
