'use client';

import React, { useCallback } from 'react';
import { useGridFilter } from 'ag-grid-react';
import type { IDoesFilterPassParams } from 'ag-grid-community';

export function SelectFilter(props: {
  model: { value: string } | null;
  onModelChange: (model: { value: string } | null) => void;
  options: { value: string; label: string }[];
  colDef: { field?: string };
}) {
  const value = props.model?.value ?? '';
  const field = props.colDef.field ?? '';

  const doesFilterPass = useCallback(
    (params: IDoesFilterPassParams) => {
      if (!value) return true;
      return String((params.data as Record<string, unknown>)[field]) === value;
    },
    [value, field],
  );

  useGridFilter({ doesFilterPass });

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    props.onModelChange(v ? { value: v } : null);
  };
  return (
    <div className="p-2">
      <select value={value} onChange={onChange} className="h-8 w-full rounded-lg border border-neutral-300 px-2 text-xs">
        <option value="">Tous</option>
        {props.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
