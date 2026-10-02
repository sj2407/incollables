'use client';

import React, { useCallback } from 'react';
import type { ICellRendererParams } from 'ag-grid-community';

type SaveField = (
  id: string,
  field: string,
  oldValue: string | null,
  newValue: string | null,
) => Promise<{ success: boolean; error?: string }>;

interface ToggleRendererConfig<TRow> {
  getId: (row: TRow) => string;
  saveField: SaveField;
}

function useBooleanToggle<TRow>(
  props: ICellRendererParams<TRow>,
  field: string,
  { getId, saveField }: ToggleRendererConfig<TRow>,
) {
  const value = props.value as boolean;
  const id = props.data ? getId(props.data) : undefined;
  const onDraftChanged = (props.context as { onDraftChanged?: () => void })?.onDraftChanged;

  const handleToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!id) return;
    const newValue = !value;
    const result = await saveField(id, field, String(value), String(newValue));
    if (result.success && props.node) {
      props.node.setDataValue(field, newValue);
      onDraftChanged?.();
    }
  }, [value, id, field, saveField, props.node, onDraftChanged]);

  return { value, handleToggle };
}

/** Builds the `is_active` / `needs_review` toggle cell renderers for an admin grid row type. */
export function createToggleRenderers<TRow>(config: ToggleRendererConfig<TRow>) {
  function ActiveToggleRenderer(props: ICellRendererParams<TRow>) {
    const { value: active, handleToggle } = useBooleanToggle(props, 'is_active', config);
    return (
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={active ? 'Désactiver' : 'Activer'}
        className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center"
        onClick={handleToggle}
      >
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          active ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-500'
        }`}>
          {active ? 'Actif' : 'Inactif'}
        </span>
      </button>
    );
  }

  function ReviewToggleRenderer(props: ICellRendererParams<TRow>) {
    const { value: needsReview, handleToggle } = useBooleanToggle(props, 'needs_review', config);
    return (
      <button
        type="button"
        aria-label={needsReview ? 'Marquer comme vérifié' : 'Marquer à vérifier'}
        className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center"
        onClick={handleToggle}
      >
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          needsReview ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
        }`}>
          {needsReview ? 'À vérifier' : 'Vérifié'}
        </span>
      </button>
    );
  }

  return { ActiveToggleRenderer, ReviewToggleRenderer };
}
