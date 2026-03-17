'use client';

import { Notebook, VideoCamera, ListChecks, CaretRight } from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
// Topic tree will be used once chapter assignment is implemented
import DOMPurify from 'dompurify';
import { extractYouTubeId } from '@/lib/importLearningMaterial';

// ─── Types ───

interface LearningMaterial {
  id: string;
  material_type: 'resume' | 'video' | 'fiche';
  title: string;
  content_html: string | null;
  video_url: string | null;
  video_storage_path: string | null;
  topic_id: string | null;
  created_at: string;
}

type MaterialTab = 'resume' | 'video' | 'fiche';

const TAB_CONFIG: { key: MaterialTab; label: string; icon: React.ReactNode }[] = [
  { key: 'resume', label: 'Résumés', icon: <Notebook size={16} /> },
  { key: 'video', label: 'Vidéos', icon: <VideoCamera size={16} /> },
  { key: 'fiche', label: 'Fiches', icon: <ListChecks size={16} /> },
];

// ─── Main Page ───

export default function LearnPage() {
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<MaterialTab>('resume');
  const [selectedMaterial, setSelectedMaterial] = useState<LearningMaterial | null>(null);

  useEffect(() => {
    async function fetchMaterials() {
      const supabase = createClient();
      const { data } = await supabase
        .from('learning_materials')
        .select('id, material_type, title, content_html, video_url, video_storage_path, topic_id, created_at')
        .eq('is_active', true)
        .order('sort_order')
        .order('created_at', { ascending: false });
      setMaterials(data ?? []);
      setLoading(false);
    }
    fetchMaterials();
  }, []);

  const filtered = materials.filter((m) => m.material_type === activeTab);
  const counts = {
    resume: materials.filter((m) => m.material_type === 'resume').length,
    video: materials.filter((m) => m.material_type === 'video').length,
    fiche: materials.filter((m) => m.material_type === 'fiche').length,
  };

  // If viewing a material, show inline
  if (selectedMaterial) {
    return (
      <MaterialViewer
        material={selectedMaterial}
        onClose={() => setSelectedMaterial(null)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">
        Apprendre
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Contenus pédagogiques pour accompagner vos révisions.
      </p>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
        {TAB_CONFIG.map((tab) => (
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
            {tab.label}
            {counts[tab.key] > 0 && (
              <span className="ml-0.5 rounded-full bg-neutral-200 px-1.5 text-[10px] font-semibold text-neutral-600">
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-4">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
            <span className="text-neutral-400">
              {TAB_CONFIG.find((t) => t.key === activeTab)?.icon}
            </span>
            <p className="mt-3 text-sm text-neutral-500">
              Aucun contenu disponible pour le moment.
            </p>
            <p className="mt-1 text-xs text-neutral-400">Bientôt disponible</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((m) => (
              <MaterialCard
                key={m.id}
                material={m}
                onSelect={() => setSelectedMaterial(m)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Material Card ───

function MaterialCard({ material, onSelect }: { material: LearningMaterial; onSelect: () => void }) {
  const icon = material.material_type === 'resume'
    ? <Notebook size={18} className="text-primary" />
    : material.material_type === 'video'
      ? <VideoCamera size={18} className="text-primary" />
      : <ListChecks size={18} className="text-primary" />;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex min-h-[44px] items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-neutral-700 line-clamp-1">{material.title}</p>
        <p className="mt-0.5 text-xs text-neutral-400">
          {new Date(material.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
      <CaretRight size={16} className="shrink-0 text-neutral-300" />
    </button>
  );
}

// ─── Material Viewer (inline) ───

function MaterialViewer({ material, onClose }: { material: LearningMaterial; onClose: () => void }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-primary-50"
        >
          &larr; Retour
        </button>
      </div>

      <h1 className="mt-3 text-[1.125rem] font-bold text-neutral-900 md:text-[1.375rem]">
        {material.title}
      </h1>

      {/* Content */}
      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-md sm:p-6">
        {/* Résumé or Fiche: render HTML */}
        {(material.material_type === 'resume' || material.material_type === 'fiche') && material.content_html && (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(material.content_html) }}
          />
        )}

        {/* Video: YouTube embed or HTML5 video */}
        {material.material_type === 'video' && (
          <>
            {material.video_url && extractYouTubeId(material.video_url) && (
              <div className="overflow-hidden rounded-lg">
                <iframe
                  src={`https://www.youtube.com/embed/${extractYouTubeId(material.video_url)}`}
                  className="aspect-video w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={material.title}
                />
              </div>
            )}
            {material.video_storage_path && supabaseUrl && (
              <video
                controls
                className="w-full rounded-lg"
                src={`${supabaseUrl}/storage/v1/object/public/learning-materials/${material.video_storage_path}`}
              >
                Votre navigateur ne supporte pas la lecture vidéo.
              </video>
            )}
          </>
        )}
      </div>
    </div>
  );
}
