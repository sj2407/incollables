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
import { saveQuestionField, saveQuestionTopic, createTopicDraft } from '@/lib/adminAutoSave';
import { findSimilarTopics } from '@/lib/topicDuplicateCheck';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { AdminQuestionRow, TopicOption } from '@/types/admin';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

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

/* ---------- custom cell renderers ---------- */

function ActiveToggleRenderer(props: ICellRendererParams<AdminQuestionRow>) {
  const active = props.value as boolean;
  const questionId = props.data?.question_id;
  const onDraftChanged = (props.context as { onDraftChanged?: () => void })?.onDraftChanged;

  const handleToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!questionId) return;
    const newValue = !active;
    const result = await saveQuestionField(questionId, 'is_active', String(active), String(newValue));
    if (result.success && props.node) {
      props.node.setDataValue('is_active', newValue);
      onDraftChanged?.();
    }
  }, [active, questionId, props.node, onDraftChanged]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={active ? 'Désactiver' : 'Activer'}
      className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center"
      onClick={handleToggle}
    >
      <span className={`inline-block h-3 w-6 rounded-full ${active ? 'bg-secondary-400' : 'bg-neutral-300'}`}>
        <span className={`mt-0.5 block h-2 w-2 rounded-full bg-white transition-transform ${active ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}

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

export type PopupType = 'propositions' | 'correct_answers' | 'explanation';

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
  onDataChanged: () => void;
  onDraftChanged: () => void;
  onPopupOpen: (req: PopupRequest) => void;
}

export default function QuestionGrid({
  questions,
  topics,
  selectedIds,
  onSelectionChanged,
  onDataChanged,
  onDraftChanged,
  onPopupOpen,
}: QuestionGridProps) {
  const gridRef = useRef<AgGridReact<AdminQuestionRow>>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Pending topic duplicate confirmation
  const [duplicateConfirm, setDuplicateConfirm] = useState<{
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

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
      tooltipField: 'question_text',
      editable: true,
      cellEditor: 'agLargeTextCellEditor',
      cellEditorParams: { maxLength: 5000, rows: 5, cols: 60 },
      cellEditorPopup: true,
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
      filter: 'agSetColumnFilter',
      editable: true,
      cellEditor: DifficultyEditor,
    },
    {
      headerName: 'Active',
      field: 'is_active',
      cellRenderer: ActiveToggleRenderer,
      width: 80,
      filter: 'agSetColumnFilter',
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
  ], [topics]);

  const showSaveStatus = useCallback((status: SaveStatus, error?: string) => {
    setSaveStatus(status);
    setSaveError(error ?? null);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (status === 'saved' || status === 'error') {
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), status === 'saved' ? 2000 : 5000);
    }
  }, []);

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

      // Try to match typed name to an existing topic
      const matchPool = isSubchapter
        ? topics.filter((t) => t.level === 2)
        : topics.filter((t) => t.level === 1);
      const exactMatch = matchPool.find((t) => t.title.toLowerCase() === typedName.toLowerCase());

      let newTopicId: string;
      let newTopicTitle: string;

      if (exactMatch) {
        // Matched an existing topic
        newTopicId = exactMatch.id;
        newTopicTitle = exactMatch.title;
      } else {
        // No match — create a new topic
        // Check for similar names (typo protection)
        const similar = findSimilarTopics(typedName, topics);
        if (similar.length > 0) {
          const confirmed = await new Promise<boolean>((resolve) => {
            setDuplicateConfirm({
              message: `Un chapitre similaire existe : « ${similar[0].title} ». Créer « ${typedName} » quand même ?`,
              onConfirm: () => { setDuplicateConfirm(null); resolve(true); },
              onCancel: () => { setDuplicateConfirm(null); resolve(false); },
            });
          });
          if (!confirmed) {
            showSaveStatus('idle');
            event.node.setDataValue('topic_id', oldTopicId);
            return;
          }
        }

        let parentId: string | null = null;
        let level = 1;
        if (isSubchapter) {
          const currentTopic = topicMap.get(oldTopicId);
          parentId = currentTopic?.parent_id ?? oldTopicId;
          level = 2;
        }

        const createResult = await createTopicDraft(typedName, parentId, level);
        if (!createResult.success || !createResult.topicId) {
          showSaveStatus('error', createResult.error);
          event.node.setDataValue('topic_id', oldTopicId);
          return;
        }
        newTopicId = createResult.topicId;
        newTopicTitle = createResult.title ?? typedName;
      }

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
        onDraftChanged();
      } else {
        showSaveStatus('error', result.error);
        event.node.setDataValue('topic_id', oldTopicId);
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
  }, [topicMap, topics, showSaveStatus, onDataChanged, onDraftChanged]);

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
    }
  }, [onPopupOpen]);

  const rowClassRules = useMemo(() => ({
    'opacity-50': (params: { data?: AdminQuestionRow }) => params.data?.is_active === false,
    'draft-row': (params: { data?: AdminQuestionRow }) => params.data?.is_draft === true,
  }), []);

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-neutral-200 bg-white py-16">
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

      {/* Duplicate topic confirmation modal */}
      {duplicateConfirm && (
        <ConfirmModal
          title="Chapitre similaire"
          message={duplicateConfirm.message}
          confirmLabel="Créer quand même"
          onConfirm={duplicateConfirm.onConfirm}
          onCancel={duplicateConfirm.onCancel}
        />
      )}
    </div>
  );
}
