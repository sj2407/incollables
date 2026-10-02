'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  type ColDef,
  type CellValueChangedEvent,
  type ICellRendererParams,
} from 'ag-grid-community';
import { saveMaterialField } from '@/lib/adminMaterialActions';
import type { AdminMaterialRow } from '@/types/admin';
import { SaveIndicator, SelectFilter, createToggleRenderers, useSaveStatus } from './grid';

/* ---------- cell renderers ---------- */

const { ActiveToggleRenderer, ReviewToggleRenderer } = createToggleRenderers<AdminMaterialRow>({
  getId: (row) => row.id,
  saveField: saveMaterialField,
});

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
  const { saveStatus, saveError, showSaveStatus } = useSaveStatus();

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
