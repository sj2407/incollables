'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact, useGridFilter } from 'ag-grid-react';
import {
  type ColDef,
  type CellValueChangedEvent,
  type ICellRendererParams,
  type IDoesFilterPassParams,
} from 'ag-grid-community';
import { saveMaterialField } from '@/lib/adminMaterialActions';
import type { AdminMaterialRow } from '@/types/admin';

/* ---------- save status indicator ---------- */

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function SaveIndicator({ status, errorMsg }: { status: SaveStatus; errorMsg: string | null }) {
  if (status === 'idle') return null;
  return (
    <div className="absolute right-4 top-2 z-10 flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-xs shadow-md animate-fade-in">
      {status === 'saving' && <span className="text-neutral-500">Enregistrement...</span>}
      {status === 'saved' && <span className="text-secondary-500">✓ Enregistré</span>}
      {status === 'error' && <span className="text-error">✗ {errorMsg ?? 'Erreur'}</span>}
    </div>
  );
}

/* ---------- cell renderers ---------- */

function ActiveToggleRenderer(props: ICellRendererParams<AdminMaterialRow>) {
  const active = props.value as boolean;
  const materialId = props.data?.id;
  const onDraftChanged = (props.context as { onDraftChanged?: () => void })?.onDraftChanged;

  const handleToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!materialId) return;
    const newValue = !active;
    const result = await saveMaterialField(materialId, 'is_active', String(active), String(newValue));
    if (result.success && props.node) {
      props.node.setDataValue('is_active', newValue);
      onDraftChanged?.();
    }
  }, [active, materialId, props.node, onDraftChanged]);

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

function ReviewToggleRenderer(props: ICellRendererParams<AdminMaterialRow>) {
  const needsReview = props.value as boolean;
  const materialId = props.data?.id;
  const onDraftChanged = (props.context as { onDraftChanged?: () => void })?.onDraftChanged;

  const handleToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!materialId) return;
    const newValue = !needsReview;
    const result = await saveMaterialField(materialId, 'needs_review', String(needsReview), String(newValue));
    if (result.success && props.node) {
      props.node.setDataValue('needs_review', newValue);
      onDraftChanged?.();
    }
  }, [needsReview, materialId, props.node, onDraftChanged]);

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

function SelectFilter(props: {
  model: { value: string } | null;
  onModelChange: (model: { value: string } | null) => void;
  options: { value: string; label: string }[];
  colDef: { field?: string };
}) {
  const value = props.model?.value ?? '';
  const field = props.colDef.field ?? '';

  const doesFilterPass = useCallback(
    (params: IDoesFilterPassParams<AdminMaterialRow>) => {
      if (!value) return true;
      return String((params.data as unknown as Record<string, unknown>)[field]) === value;
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

function DateRenderer(props: ICellRendererParams<AdminMaterialRow>) {
  const iso = props.value as string;
  if (!iso) return <span className="text-neutral-300">—</span>;
  return (
    <span className="text-xs text-neutral-500">
      {new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
    </span>
  );
}

/* ---------- main grid component ---------- */

interface MaterialGridProps {
  materials: AdminMaterialRow[];
  selectedIds: Set<string>;
  onSelectionChanged: (ids: Set<string>) => void;
  onDraftChanged: () => void;
}

export default function MaterialGrid({
  materials,
  selectedIds,
  onSelectionChanged,
  onDraftChanged,
}: MaterialGridProps) {
  const gridRef = useRef<AgGridReact<AdminMaterialRow>>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const getRowId = useCallback((params: { data: AdminMaterialRow }) => params.data.id, []);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    resizable: true,
    filter: true,
    suppressHeaderMenuButton: false,
    minWidth: 60,
  }), []);

  const columnDefs = useMemo<ColDef<AdminMaterialRow>[]>(() => [
    {
      headerCheckboxSelection: true,
      checkboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
      width: 48,
      maxWidth: 48,
      minWidth: 48,
      lockPosition: true,
      suppressMovable: true,
      filter: false,
      sortable: false,
      resizable: false,
    },
    {
      headerName: 'Titre',
      field: 'title',
      flex: 1,
      minWidth: 200,
      filter: 'agTextColumnFilter',
      editable: true,
      cellEditor: 'agLargeTextCellEditor',
      cellEditorParams: { maxLength: 500, rows: 2, cols: 50 },
      cellEditorPopup: true,
    },
    {
      headerName: 'Chapitre',
      colId: 'chapter',
      valueGetter: (params) => params.data?.parent_topic_title ?? params.data?.topic_title ?? '',
      width: 160,
      filter: 'agTextColumnFilter',
    },
    {
      headerName: 'Sous-chapitre',
      colId: 'subchapter',
      valueGetter: (params) => params.data?.parent_topic_title ? params.data?.topic_title : '',
      width: 160,
      filter: 'agTextColumnFilter',
    },
    {
      headerName: 'URL / Fichier',
      colId: 'url_file',
      valueGetter: (params) => params.data?.video_url ?? params.data?.file_name ?? '',
      width: 150,
      filter: 'agTextColumnFilter',
      cellRenderer: (params: ICellRendererParams<AdminMaterialRow>) => {
        const val = params.value as string;
        if (!val) return <span className="text-neutral-300">—</span>;
        return <span className="truncate text-xs text-neutral-500" title={val}>{val.length > 35 ? val.slice(0, 35) + '…' : val}</span>;
      },
    },
    {
      headerName: 'Date',
      field: 'created_at',
      cellRenderer: DateRenderer,
      width: 90,
      filter: false,
    },
    {
      headerName: 'Active',
      field: 'is_active',
      cellRenderer: ActiveToggleRenderer,
      width: 80,
      filter: SelectFilter,
      filterParams: { options: [{ value: 'true', label: 'Actifs' }, { value: 'false', label: 'Inactifs' }] },
    },
    {
      headerName: 'Vérifié',
      field: 'needs_review',
      cellRenderer: ReviewToggleRenderer,
      width: 90,
      filter: SelectFilter,
      filterParams: { options: [{ value: 'true', label: 'À vérifier' }, { value: 'false', label: 'Vérifié' }] },
    },
  ], []);

  const showSaveStatus = useCallback((status: SaveStatus, error?: string) => {
    setSaveStatus(status);
    setSaveError(error ?? null);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (status === 'saved' || status === 'error') {
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), status === 'saved' ? 2000 : 5000);
    }
  }, []);

  const onCellValueChanged = useCallback(async (event: CellValueChangedEvent<AdminMaterialRow>) => {
    const { data, colDef, oldValue, newValue } = event;
    if (!data) return;
    const field = colDef.field ?? colDef.colId;
    if (!field) return;
    if (oldValue === newValue) return;

    showSaveStatus('saving');
    const result = await saveMaterialField(
      data.id,
      field,
      String(oldValue ?? ''),
      String(newValue ?? ''),
    );
    if (result.success) {
      showSaveStatus('saved');
      onDraftChanged();
    } else {
      showSaveStatus('error', result.error);
      event.node.setDataValue(field, oldValue);
    }
  }, [showSaveStatus, onDraftChanged]);

  // Sync external selectedIds to grid selection
  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    api.deselectAll();
    if (selectedIds.size > 0) {
      api.forEachNode((node) => {
        if (node.data && selectedIds.has(node.data.id)) {
          node.setSelected(true);
        }
      });
    }
  }, [selectedIds]);

  const onSelectionChangedHandler = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    const selected = api.getSelectedRows();
    onSelectionChanged(new Set(selected.map((r) => r.id)));
  }, [onSelectionChanged]);

  const rowClassRules = useMemo(() => ({
    'opacity-50': (params: { data?: AdminMaterialRow }) => params.data?.is_active === false,
    'draft-row': (params: { data?: AdminMaterialRow }) => params.data?.is_draft === true,
  }), []);

  if (materials.length === 0) {
    return (
      <div className="flex items-center justify-center glass-card py-16">
        <p className="text-sm text-neutral-400">Aucun élément trouvé.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <SaveIndicator status={saveStatus} errorMsg={saveError} />
      <div
        className="ag-theme-alpine question-grid-theme"
        style={{ height: 'calc(100vh - 280px)', width: '100%' }}
      >
        <AgGridReact<AdminMaterialRow>
          ref={gridRef}
          rowData={materials}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={getRowId}
          context={{ onDraftChanged }}
          rowSelection="multiple"
          suppressRowClickSelection={true}
          onSelectionChanged={onSelectionChangedHandler}
          onCellValueChanged={onCellValueChanged}
          rowClassRules={rowClassRules}
          animateRows={true}
          rowHeight={44}
          headerHeight={40}
          suppressCellFocus={false}
          tooltipShowDelay={500}
          enableCellTextSelection={true}
          singleClickEdit={false}
          stopEditingWhenCellsLoseFocus={true}
        />
      </div>
    </div>
  );
}
