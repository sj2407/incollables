'use client';

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  type ColDef,
  type CellClickedEvent,
  type CellValueChangedEvent,
  type ICellRendererParams,
  type ICellEditorParams,
  ModuleRegistry,
  AllCommunityModule,
} from 'ag-grid-community';
import { saveQuestionField, saveQuestionTopic } from '@/lib/adminAutoSave';
import type { AdminQuestionRow, TopicOption } from '@/types/admin';
import { SaveIndicator, SelectFilter, createToggleRenderers, useSaveStatus } from './grid';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

/* ---------- custom cell renderers ---------- */

const { ActiveToggleRenderer, ReviewToggleRenderer } = createToggleRenderers<AdminQuestionRow>({
  getId: (row) => row.question_id,
  saveField: saveQuestionField,
});

function DifficultyRenderer(props: ICellRendererParams<AdminQuestionRow>) {
  const d = props.value as string;
  const map: Record<string, { label: string; cls: string }> = {
    easy: { label: 'Facile', cls: 'bg-green-50 text-green-700' },
    medium: { label: 'Moyen', cls: 'bg-amber-50 text-amber-700' },
    hard: { label: 'Difficile', cls: 'bg-red-50 text-red-700' },
  };
  const info = map[d] ?? { label: d, cls: 'bg-neutral-50 text-neutral-700' };
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${info.cls}`}>{info.label}</span>;
}

function ScoreRenderer(props: ICellRendererParams<AdminQuestionRow>) {
  const attempts = props.data?.total_attempts ?? 0;
  const score = props.data?.avg_score ?? 0;
  if (attempts === 0) return <span className="text-neutral-300">—</span>;
  return (
    <span className={score < 30 ? 'font-bold text-error' : 'text-neutral-500'}>
      {score}%
    </span>
  );
}

function CorrectLabelsRenderer(props: ICellRendererParams<AdminQuestionRow>) {
  const labels = props.value as string;
  return (
    <button
      type="button"
      className="cursor-pointer rounded bg-secondary-50 px-1.5 py-0.5 text-xs font-medium text-secondary-700 hover:bg-secondary-100"
      title="Cliquer pour modifier"
      onClick={(e) => e.stopPropagation()}
    >
      {labels || '—'}
    </button>
  );
}

function AllChoicesRenderer(props: ICellRendererParams<AdminQuestionRow>) {
  const choices = props.data?.all_choices ?? [];
  return (
    <button
      type="button"
      className="cursor-pointer text-xs text-neutral-600 hover:text-primary"
      title="Cliquer pour modifier"
      onClick={(e) => e.stopPropagation()}
    >
      {choices.length === 0 ? '0 prop.' : choices.map((c) => c.label).join(', ')}
    </button>
  );
}

function EnonceRenderer(props: ICellRendererParams<AdminQuestionRow>) {
  const text = (props.value as string) ?? '';
  // Strip HTML tags if present (backward compat with old imported HTML data)
  const clean = text.replace(/<[^>]*>/g, '').trim();
  return (
    <button
      type="button"
      className="w-full cursor-pointer truncate text-left hover:text-primary"
      title={clean}
      onClick={(e) => e.stopPropagation()}
    >
      {clean || <span className="text-neutral-300">—</span>}
    </button>
  );
}

function ExplanationClickRenderer(props: ICellRendererParams<AdminQuestionRow>) {
  const has = props.data?.has_explanation;
  return (
    <button
      type="button"
      className="cursor-pointer hover:text-primary"
      title="Cliquer pour modifier l'explication"
      onClick={(e) => e.stopPropagation()}
    >
      {has ? (
        <span className="text-secondary-500">✓</span>
      ) : (
        <span className="text-neutral-300">+ ajout</span>
      )}
    </button>
  );
}

/* ---------- difficulty editor ---------- */

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Facile' },
  { value: 'medium', label: 'Moyen' },
  { value: 'hard', label: 'Difficile' },
];

const DifficultyEditor = forwardRef(function DifficultyEditor(
  props: ICellEditorParams<AdminQuestionRow>,
  ref: React.Ref<{ getValue: () => string }>
) {
  const [value, setValue] = useState(props.value as string);
  const valueRef = useRef(props.value as string);
  const refInput = useRef<HTMLSelectElement>(null);

  useEffect(() => { refInput.current?.focus(); }, []);

  useImperativeHandle(ref, () => ({
    getValue: () => valueRef.current,
  }));

  return (
    <select
      ref={refInput}
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        valueRef.current = e.target.value;
      }}
      className="h-full w-full border-0 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-primary"
    >
      {DIFFICULTY_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
});

/* ---------- main grid component ---------- */

export type PopupType = 'propositions' | 'correct_answers' | 'explanation' | 'enonce';

export interface PopupRequest {
  type: PopupType;
  questionId: string;
  data: AdminQuestionRow;
}

interface QuestionGridProps {
  questions: AdminQuestionRow[];
  topics: TopicOption[];
  selectedIds: Set<string>;
  onSelectionChanged: (ids: Set<string>) => void;
  onDraftChanged: () => void;
  onPopupOpen: (req: PopupRequest) => void;
  /** When set, shows a "Groupe" column and alternating row tints per duplicate group. */
  duplicateGroupLookup?: Map<string, number>;
}

export default function QuestionGrid({
  questions,
  topics,
  selectedIds,
  onSelectionChanged,
  onDraftChanged,
  onPopupOpen,
  duplicateGroupLookup,
}: QuestionGridProps) {
  const gridRef = useRef<AgGridReact<AdminQuestionRow>>(null);
  const { saveStatus, saveError, showSaveStatus } = useSaveStatus();

  const getRowId = useCallback((params: { data: AdminQuestionRow }) => params.data.question_id, []);

  const topicMap = useMemo(() => {
    const map = new Map<string, TopicOption>();
    topics.forEach((t) => map.set(t.id, t));
    return map;
  }, [topics]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    resizable: true,
    filter: true,
    suppressHeaderMenuButton: false,
    minWidth: 60,
  }), []);

  const columnDefs = useMemo<ColDef<AdminQuestionRow>[]>(() => [
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
    // "Groupe" column — only visible during duplicate detection mode
    ...(duplicateGroupLookup ? [{
      headerName: 'Groupe',
      colId: 'dupe_group',
      valueGetter: (params: { data?: AdminQuestionRow }) =>
        params.data ? (duplicateGroupLookup.get(params.data.question_id) ?? '') : '',
      width: 75,
      maxWidth: 75,
      filter: false,
      sortable: true,
      sort: 'asc' as const,
      cellStyle: (params: { value?: number }) => {
        if (!params.value) return undefined;
        const isEven = params.value % 2 === 0;
        return { backgroundColor: isEven ? '#eff6ff' : '#f0fdf4', fontWeight: 600, textAlign: 'center' as const };
      },
    }] as ColDef<AdminQuestionRow>[] : []),
    {
      headerName: 'Chapitre',
      colId: 'chapter',
      valueGetter: (params) => params.data?.parent_topic_title ?? params.data?.topic_title ?? '',
      valueSetter: (params) => {
        // Always write to parent_topic_title — chapter valueGetter reads this first
        params.data.parent_topic_title = params.newValue;
        return true;
      },
      width: 160,
      filter: 'agTextColumnFilter',
      editable: true,
      cellEditor: 'agLargeTextCellEditor',
      cellEditorParams: { maxLength: 200, rows: 2, cols: 40 },
      cellEditorPopup: true,
    },
    {
      headerName: 'Sous-chapitre',
      colId: 'subchapter',
      valueGetter: (params) => params.data?.parent_topic_title ? params.data?.topic_title : '',
      valueSetter: (params) => {
        if (!params.data.parent_topic_title) {
          // Question is on a chapter directly (no sub-chapter yet).
          // Promote: current topic_title becomes parent, new value becomes sub-chapter.
          params.data.parent_topic_title = params.data.topic_title;
        }
        params.data.topic_title = params.newValue;
        return true;
      },
      width: 160,
      filter: 'agTextColumnFilter',
      editable: true,
      cellEditor: 'agLargeTextCellEditor',
      cellEditorParams: { maxLength: 200, rows: 2, cols: 40 },
      cellEditorPopup: true,
    },
    {
      headerName: 'Q#',
      field: 'question_number',
      width: 70,
      filter: 'agNumberColumnFilter',
    },
    {
      headerName: 'Énoncé',
      field: 'question_text',
      flex: 1,
      minWidth: 250,
      filter: 'agTextColumnFilter',
      cellRenderer: EnonceRenderer,
      colId: 'enonce_popup',
    },
    {
      headerName: 'Propositions',
      cellRenderer: AllChoicesRenderer,
      width: 110,
      filter: false,
      sortable: false,
      colId: 'propositions_popup',
    },
    {
      headerName: 'Rép.',
      field: 'correct_labels',
      cellRenderer: CorrectLabelsRenderer,
      width: 80,
      filter: 'agTextColumnFilter',
      colId: 'correct_popup',
    },
    {
      headerName: 'Expl.',
      field: 'has_explanation',
      cellRenderer: ExplanationClickRenderer,
      width: 70,
      filter: false,
      colId: 'explanation_popup',
    },
    {
      headerName: 'Difficulté',
      field: 'difficulty',
      cellRenderer: DifficultyRenderer,
      width: 100,
      filter: SelectFilter,
      filterParams: { options: [{ value: 'easy', label: 'Facile' }, { value: 'medium', label: 'Moyen' }, { value: 'hard', label: 'Difficile' }] },
      editable: true,
      cellEditor: DifficultyEditor,
    },
    {
      headerName: 'Active',
      field: 'is_active',
      cellRenderer: ActiveToggleRenderer,
      width: 80,
      filter: SelectFilter,
      filterParams: { options: [{ value: 'true', label: 'Actives' }, { value: 'false', label: 'Inactives' }] },
    },
    {
      headerName: 'Tentatives',
      field: 'total_attempts',
      width: 95,
      filter: 'agNumberColumnFilter',
      valueFormatter: (params) => params.value > 0 ? String(params.value) : '—',
    },
    {
      headerName: 'Score',
      field: 'avg_score',
      cellRenderer: ScoreRenderer,
      width: 80,
      filter: 'agNumberColumnFilter',
    },
    {
      headerName: 'Vérifié',
      field: 'needs_review',
      cellRenderer: ReviewToggleRenderer,
      width: 90,
      sort: 'desc' as const,
      sortIndex: 0,
      filter: SelectFilter,
      filterParams: { options: [{ value: 'true', label: 'À vérifier' }, { value: 'false', label: 'Vérifié' }] },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps -- topics used in onCellValueChanged, not in column defs
  ], [duplicateGroupLookup]);

  // Handle cell value changes — auto-save
  const onCellValueChanged = useCallback(async (event: CellValueChangedEvent<AdminQuestionRow>) => {
    const { data, colDef, oldValue, newValue } = event;
    if (!data) return;

    const field = colDef.field ?? colDef.colId;
    if (!field) return;

    // Skip if value didn't actually change
    if (oldValue === newValue) return;

    showSaveStatus('saving');

    // Topic change — user typed a topic name in the chapter/subchapter popup editor
    if (field === 'chapter' || field === 'subchapter') {
      const oldTopicId = data.topic_id;
      const typedName = (newValue as string ?? '').trim();

      if (!typedName || typedName === oldValue) {
        showSaveStatus('idle');
        return;
      }

      const isSubchapter = field === 'subchapter';

      // Match typed name to an existing topic — no inline creation
      const matchPool = isSubchapter
        ? topics.filter((t) => t.level === 2)
        : topics.filter((t) => t.level === 1);
      const exactMatch = matchPool.find((t) => t.title.toLowerCase() === typedName.toLowerCase());

      if (!exactMatch) {
        // No match — revert and show error
        showSaveStatus('error', isSubchapter
          ? 'Ce sous-chapitre n\'existe pas. Utilisez « + Sous-chapitre » pour en créer un.'
          : 'Ce chapitre n\'existe pas. Utilisez « + Chapitre » pour en créer un.');
        if (isSubchapter) {
          event.data.topic_title = oldValue ?? '';
        } else {
          event.data.parent_topic_title = oldValue ?? '';
        }
        event.api.refreshCells({ rowNodes: [event.node], columns: [field], force: true });
        return;
      }

      const newTopicId = exactMatch.id;
      const newTopicTitle = exactMatch.title;

      if (newTopicId === oldTopicId) {
        showSaveStatus('idle');
        return;
      }

      const oldTopic = topicMap.get(oldTopicId);
      const result = await saveQuestionTopic(
        data.question_id,
        oldTopicId,
        newTopicId,
        oldTopic?.title ?? '',
        newTopicTitle,
      );
      if (result.success) {
        showSaveStatus('saved');
        // Update local row data so subsequent edits see fresh values
        event.data.topic_id = newTopicId;
        event.data.topic_title = newTopicTitle;
        if (!isSubchapter) event.data.parent_topic_title = newTopicTitle;
        onDraftChanged();
      } else {
        showSaveStatus('error', result.error);
        // Revert display on failure
        if (isSubchapter) {
          event.data.topic_title = oldValue ?? '';
        } else {
          event.data.parent_topic_title = oldValue ?? '';
        }
        event.api.refreshCells({ rowNodes: [event.node], columns: [field], force: true });
      }
      return;
    }

    // Simple field change
    const result = await saveQuestionField(
      data.question_id,
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
  }, [topicMap, topics, showSaveStatus, onDraftChanged]);

  // Sync external selectedIds to grid selection
  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    api.deselectAll();
    if (selectedIds.size > 0) {
      api.forEachNode((node) => {
        if (node.data && selectedIds.has(node.data.question_id)) {
          node.setSelected(true);
        }
      });
    }
  }, [selectedIds]);

  const onSelectionChangedHandler = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    const selected = api.getSelectedRows();
    onSelectionChanged(new Set(selected.map((r) => r.question_id)));
  }, [onSelectionChanged]);

  // Handle clicks on popup columns
  const onCellClicked = useCallback((event: CellClickedEvent<AdminQuestionRow>) => {
    const colId = event.colDef.colId;
    if (!event.data) return;
    if (colId === 'propositions_popup') {
      onPopupOpen({ type: 'propositions', questionId: event.data.question_id, data: event.data });
    } else if (colId === 'correct_popup') {
      onPopupOpen({ type: 'correct_answers', questionId: event.data.question_id, data: event.data });
    } else if (colId === 'explanation_popup') {
      onPopupOpen({ type: 'explanation', questionId: event.data.question_id, data: event.data });
    } else if (colId === 'enonce_popup') {
      onPopupOpen({ type: 'enonce', questionId: event.data.question_id, data: event.data });
    }
  }, [onPopupOpen]);

  const rowClassRules = useMemo(() => ({
    'opacity-50': (params: { data?: AdminQuestionRow }) => params.data?.is_active === false,
    'draft-row': (params: { data?: AdminQuestionRow }) => params.data?.is_draft === true,
  }), []);

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center glass-card py-16">
        <p className="text-sm text-neutral-400">Aucune question trouvée.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <SaveIndicator status={saveStatus} errorMsg={saveError} />
      <div
        className="ag-theme-alpine question-grid-theme"
        style={{ height: 'calc(100vh - 220px)', width: '100%' }}
      >
        <AgGridReact<AdminQuestionRow>
          ref={gridRef}
          rowData={questions}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={getRowId}
          context={{ onDraftChanged }}
          rowSelection="multiple"
          suppressRowClickSelection={true}
          onSelectionChanged={onSelectionChangedHandler}
          onCellClicked={onCellClicked}
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
