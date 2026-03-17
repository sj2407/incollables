'use client';

import { FileDoc, CheckCircle, SpinnerGap, UploadSimple, VideoCamera, Notebook, ListChecks, LinkSimple } from '@phosphor-icons/react';
import { useCallback, useState } from 'react';
import { parseWordFile, type ImportParseResult } from '@/lib/importWord';
import { parseWordToHtml, extractYouTubeId } from '@/lib/importLearningMaterial';
import { createClient } from '@/lib/supabase/client';

// ─── Types ───

type ImportTab = 'questions' | 'resumes' | 'videos' | 'fiches';
type ImportStep = 'idle' | 'parsing' | 'preview' | 'importing' | 'done' | 'error';

const TABS: { key: ImportTab; label: string; icon: React.ReactNode; accept: string; description: string }[] = [
  { key: 'questions', label: 'Questions', icon: <FileDoc size={18} />, accept: '.docx', description: 'Fichier .docx standardisé (questions, propositions, réponses)' },
  { key: 'resumes', label: 'Résumés', icon: <Notebook size={18} />, accept: '.docx', description: 'Résumé de cours au format .docx' },
  { key: 'videos', label: 'Vidéos', icon: <VideoCamera size={18} />, accept: '.mp4,.mov,.webm', description: 'Lien YouTube ou fichier vidéo' },
  { key: 'fiches', label: 'Fiches', icon: <ListChecks size={18} />, accept: '.docx', description: 'Fiche de révision au format .docx' },
];

// ─── Main Page ───

export default function AdminImportPage() {
  const [activeTab, setActiveTab] = useState<ImportTab>('questions');

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">Import</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Importez du contenu pédagogique
      </p>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-primary shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === 'questions' && <QuestionImportSection />}
        {activeTab === 'resumes' && <MaterialImportSection materialType="resume" label="Résumé de cours" />}
        {activeTab === 'videos' && <VideoImportSection />}
        {activeTab === 'fiches' && <MaterialImportSection materialType="fiche" label="Fiche de révision" />}
      </div>
    </div>
  );
}

// ─── Question Import (existing logic) ───

function QuestionImportSection() {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<ImportStep>('idle');
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null);
  const [importResult, setImportResult] = useState<{ stats: Record<string, number>; errors: string[] } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleFileChange = useCallback(async (selectedFile: File | null) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setStep('parsing');
    setErrorMessage('');
    setImportResult(null);
    try {
      const buffer = await selectedFile.arrayBuffer();
      const result = await parseWordFile(buffer);
      setParseResult(result);
      setStep('preview');
    } catch (err) {
      setErrorMessage(`Erreur lors de l'analyse du fichier : ${err}`);
      setStep('error');
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!parseResult) return;
    setStep('importing');
    setErrorMessage('');
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke('import-word', {
        body: { questions: parseResult.questions, topics: parseResult.topics },
      });
      if (error) { setErrorMessage(`Erreur serveur : ${error.message}`); setStep('error'); return; }
      if (data?.error) { setErrorMessage(`Erreur : ${data.error}`); setStep('error'); return; }
      setImportResult({ stats: data.stats, errors: data.errors ?? [] });
      setStep('done');
    } catch (err) {
      setErrorMessage(`Erreur inattendue : ${err}`);
      setStep('error');
    }
  }, [parseResult]);

  const handleReset = useCallback(() => {
    setFile(null); setStep('idle'); setParseResult(null); setImportResult(null); setErrorMessage('');
  }, []);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-md">
      {(step === 'idle' || step === 'error') && (
        <>
          <DropZone accept=".docx" description="Fichier .docx standardisé" onFile={handleFileChange} />
          {step === 'error' && errorMessage && <ErrorBox message={errorMessage} onRetry={handleReset} />}
        </>
      )}
      {step === 'parsing' && <Spinner message="Analyse du fichier..." detail={file?.name} />}
      {step === 'preview' && parseResult && (
        <div>
          <FileInfo name={file?.name} size={file?.size} />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Questions" value={parseResult.stats.totalQuestions} />
            <StatCard label="Actives" value={parseResult.stats.activeQuestions} color="text-secondary-500" />
            <StatCard label="Désactivées" value={parseResult.stats.inactiveQuestions} color="text-warning" />
            <StatCard label="Avec explication" value={parseResult.stats.withExplanation} />
            <StatCard label="Images" value={parseResult.stats.totalImages} />
            <StatCard label="Chapitres" value={parseResult.stats.totalTopics} />
          </div>
          {parseResult.errors.length > 0 && <WarningList items={parseResult.errors} />}
          <p className="mt-4 text-xs text-neutral-400">
            Les questions seront importées comme <strong>inactives</strong>. Activez-les depuis Base de données après vérification.
          </p>
          <div className="mt-4 flex gap-3">
            <PrimaryButton onClick={handleImport} disabled={parseResult.stats.totalQuestions === 0}>
              Importer {parseResult.stats.totalQuestions} questions
            </PrimaryButton>
            <SecondaryButton onClick={handleReset}>Annuler</SecondaryButton>
          </div>
        </div>
      )}
      {step === 'importing' && <Spinner message="Import en cours..." detail={`${parseResult?.stats.totalQuestions} questions`} />}
      {step === 'done' && importResult && (
        <div>
          <SuccessHeader label="Import terminé" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Importées" value={importResult.stats.inserted} color="text-secondary-500" />
            <StatCard label="Chapitres" value={importResult.stats.topicsCreated} />
            <StatCard label="Images" value={importResult.stats.imagesUploaded} />
          </div>
          {importResult.errors.length > 0 && <WarningList items={importResult.errors} />}
          <p className="mt-4 text-xs text-neutral-400">Vérifiez-les dans Base de données et activez-les.</p>
          <div className="mt-4 flex gap-3">
            <a href="/admin/questions" className="min-h-[44px] flex-1 rounded-xl bg-primary px-4 py-2 text-center text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90">
              Voir dans Base de données
            </a>
            <SecondaryButton onClick={handleReset}>Importer un autre fichier</SecondaryButton>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Material Import (Résumés / Fiches) ───

function MaterialImportSection({ materialType, label }: { materialType: 'resume' | 'fiche'; label: string }) {
  const [step, setStep] = useState<ImportStep>('idle');
  const [title, setTitle] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [fileName, setFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleFileChange = useCallback(async (file: File | null) => {
    if (!file) return;
    setStep('parsing');
    setErrorMessage('');
    try {
      const parsed = await parseWordToHtml(file);
      setTitle(parsed.title);
      setContentHtml(parsed.contentHtml);
      setFileName(parsed.fileName);
      setStep('preview');
    } catch (err) {
      setErrorMessage(`Erreur : ${err}`);
      setStep('error');
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!contentHtml || !title.trim()) return;
    setStep('importing');
    try {
      const supabase = createClient();
      const { error } = await supabase.from('learning_materials').insert({
        material_type: materialType,
        title: title.trim(),
        content_html: contentHtml,
        file_name: fileName,
        is_active: true,
      });
      if (error) { setErrorMessage(`Erreur : ${error.message}`); setStep('error'); return; }
      setStep('done');
    } catch (err) {
      setErrorMessage(`Erreur : ${err}`);
      setStep('error');
    }
  }, [contentHtml, title, fileName, materialType]);

  const handleReset = useCallback(() => {
    setStep('idle'); setTitle(''); setContentHtml(''); setFileName(''); setErrorMessage('');
  }, []);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-md">
      {(step === 'idle' || step === 'error') && (
        <>
          <DropZone accept=".docx" description={`${label} au format .docx`} onFile={handleFileChange} />
          {step === 'error' && <ErrorBox message={errorMessage} onRetry={handleReset} />}
        </>
      )}
      {step === 'parsing' && <Spinner message="Conversion en cours..." />}
      {step === 'preview' && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Aperçu — {label}</p>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre"
            className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="mt-3 max-h-[300px] overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: contentHtml }} />
          </div>
          <div className="mt-4 flex gap-3">
            <PrimaryButton onClick={handleImport} disabled={!title.trim()}>Importer</PrimaryButton>
            <SecondaryButton onClick={handleReset}>Annuler</SecondaryButton>
          </div>
        </div>
      )}
      {step === 'importing' && <Spinner message="Enregistrement..." />}
      {step === 'done' && (
        <div>
          <SuccessHeader label={`${label} importé`} />
          <p className="mt-2 text-sm text-neutral-500">&laquo; {title} &raquo; est disponible pour les étudiants.</p>
          <div className="mt-4">
            <SecondaryButton onClick={handleReset}>Importer un autre</SecondaryButton>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Video Import ───

function VideoImportSection() {
  const [mode, setMode] = useState<'youtube' | 'upload' | null>(null);
  const [step, setStep] = useState<ImportStep>('idle');
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleImportYouTube = useCallback(async () => {
    if (!title.trim() || !videoUrl.trim()) return;
    const ytId = extractYouTubeId(videoUrl);
    if (!ytId) { setErrorMessage('URL YouTube invalide'); setStep('error'); return; }
    setStep('importing');
    try {
      const supabase = createClient();
      const { error } = await supabase.from('learning_materials').insert({
        material_type: 'video',
        title: title.trim(),
        video_url: `https://www.youtube.com/watch?v=${ytId}`,
        is_active: true,
      });
      if (error) { setErrorMessage(`Erreur : ${error.message}`); setStep('error'); return; }
      setStep('done');
    } catch (err) {
      setErrorMessage(`Erreur : ${err}`);
      setStep('error');
    }
  }, [title, videoUrl]);

  const handleImportFile = useCallback(async () => {
    if (!title.trim() || !videoFile) return;
    setStep('importing');
    try {
      const supabase = createClient();
      const ext = videoFile.name.split('.').pop() ?? 'mp4';
      const storagePath = `videos/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('learning-materials')
        .upload(storagePath, videoFile, { contentType: videoFile.type, upsert: false });

      if (uploadError) { setErrorMessage(`Upload échoué : ${uploadError.message}`); setStep('error'); return; }

      const { error } = await supabase.from('learning_materials').insert({
        material_type: 'video',
        title: title.trim(),
        video_storage_path: storagePath,
        file_name: videoFile.name,
        file_size: videoFile.size,
        is_active: true,
      });
      if (error) { setErrorMessage(`Erreur : ${error.message}`); setStep('error'); return; }
      setStep('done');
    } catch (err) {
      setErrorMessage(`Erreur : ${err}`);
      setStep('error');
    }
  }, [title, videoFile]);

  const handleReset = useCallback(() => {
    setMode(null); setStep('idle'); setTitle(''); setVideoUrl(''); setVideoFile(null); setErrorMessage('');
  }, []);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-md">
      {step === 'idle' && !mode && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setMode('youtube')}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-neutral-200 p-6 text-sm font-medium text-neutral-700 transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <LinkSimple size={20} />
            Lien YouTube
          </button>
          <button
            type="button"
            onClick={() => setMode('upload')}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-neutral-200 p-6 text-sm font-medium text-neutral-700 transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <VideoCamera size={20} />
            Fichier vidéo
          </button>
        </div>
      )}

      {step === 'idle' && mode === 'youtube' && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Vidéo YouTube</p>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la vidéo"
            className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {videoUrl && extractYouTubeId(videoUrl) && (
            <div className="mt-3 overflow-hidden rounded-lg">
              <iframe
                src={`https://www.youtube.com/embed/${extractYouTubeId(videoUrl)}`}
                className="aspect-video w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          <div className="mt-4 flex gap-3">
            <PrimaryButton onClick={handleImportYouTube} disabled={!title.trim() || !extractYouTubeId(videoUrl)}>
              Ajouter
            </PrimaryButton>
            <SecondaryButton onClick={handleReset}>Annuler</SecondaryButton>
          </div>
        </div>
      )}

      {step === 'idle' && mode === 'upload' && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Fichier vidéo</p>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la vidéo"
            className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="mt-2">
            <DropZone
              accept=".mp4,.mov,.webm"
              description="Fichier .mp4, .mov ou .webm"
              onFile={(f) => { if (f) { setVideoFile(f); if (!title) setTitle(f.name.replace(/\.[^.]+$/, '')); } }}
            />
          </div>
          {videoFile && (
            <p className="mt-2 text-xs text-neutral-500">{videoFile.name} · {(videoFile.size / 1024 / 1024).toFixed(1)} Mo</p>
          )}
          <div className="mt-4 flex gap-3">
            <PrimaryButton onClick={handleImportFile} disabled={!title.trim() || !videoFile}>
              Importer
            </PrimaryButton>
            <SecondaryButton onClick={handleReset}>Annuler</SecondaryButton>
          </div>
        </div>
      )}

      {step === 'error' && <ErrorBox message={errorMessage} onRetry={handleReset} />}
      {step === 'importing' && <Spinner message="Enregistrement..." />}
      {step === 'done' && (
        <div>
          <SuccessHeader label="Vidéo ajoutée" />
          <p className="mt-2 text-sm text-neutral-500">&laquo; {title} &raquo; est disponible pour les étudiants.</p>
          <div className="mt-4">
            <SecondaryButton onClick={handleReset}>Ajouter une autre vidéo</SecondaryButton>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared UI Components ───

function DropZone({ accept, description, onFile }: { accept: string; description: string; onFile: (f: File | null) => void }) {
  const id = `upload-${accept.replace(/[^a-z]/g, '')}`;
  return (
    <div
      className="rounded-xl border-2 border-dashed border-neutral-300 p-8 text-center transition-colors hover:border-primary/50"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
    >
      <input type="file" accept={accept} onChange={(e) => onFile(e.target.files?.[0] ?? null)} className="sr-only" id={id} />
      <label htmlFor={id} className="cursor-pointer">
        <UploadSimple size={30} className="mx-auto text-neutral-400" />
        <p className="mt-2 text-sm font-semibold text-neutral-700">Glissez ici ou cliquez pour sélectionner</p>
        <p className="mt-1 text-xs text-neutral-400">{description}</p>
      </label>
    </div>
  );
}

function Spinner({ message, detail }: { message: string; detail?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <SpinnerGap size={32} className="animate-spin text-primary" />
      <p className="text-sm text-neutral-500">{message}</p>
      {detail && <p className="text-xs text-neutral-400">{detail}</p>}
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-4 rounded-lg border border-error/20 bg-red-50 p-3">
      <p className="text-sm text-error">{message}</p>
      <button type="button" onClick={onRetry} className="mt-2 text-sm font-medium text-primary hover:underline">Réessayer</button>
    </div>
  );
}

function SuccessHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <CheckCircle size={28} weight="fill" className="text-secondary-500" />
      <p className="text-sm font-semibold text-neutral-700">{label}</p>
    </div>
  );
}

function FileInfo({ name, size }: { name?: string; size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <FileDoc size={24} className="text-primary" />
      <div>
        <p className="text-sm font-semibold text-neutral-700">{name}</p>
        <p className="text-xs text-neutral-400">{((size ?? 0) / 1024).toFixed(1)} Ko</p>
      </div>
    </div>
  );
}

function WarningList({ items }: { items: string[] }) {
  return (
    <div className="mt-4 max-h-[150px] overflow-y-auto rounded-lg border border-warning/20 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-warning">{items.length} avertissement{items.length > 1 ? 's' : ''}</p>
      <ul className="mt-1 space-y-0.5">
        {items.map((err, i) => <li key={i} className="text-xs text-neutral-600">{err}</li>)}
      </ul>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <p className={`text-lg font-bold ${color ?? 'text-neutral-700'}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-neutral-400">{label}</p>
    </div>
  );
}

function PrimaryButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="min-h-[44px] flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.98] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none">
      {children}
    </button>
  );
}

function SecondaryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="min-h-[44px] rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50">
      {children}
    </button>
  );
}
