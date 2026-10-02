'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash } from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';

interface QuestionImage {
  id: string;
  storage_path: string;
  original_name: string | null;
  sort_order: number;
  publicUrl: string;
}

interface PendingUpload {
  file: File;
  previewUrl: string;
}

interface EnoncePopupProps {
  questionId: string;
  value: string;
  onSave: (text: string) => void;
  onClose: () => void;
}

export default function EnoncePopup({ questionId, value, onSave, onClose }: EnoncePopupProps) {
  // Strip any HTML tags from the loaded value (backward compat with old HTML data)
  const cleanInitial = value.replace(/<[^>]*>/g, '').trim();

  const [text, setText] = useState(cleanInitial);
  const [images, setImages] = useState<QuestionImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Batched operations — only executed on Save
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing images on mount
  useEffect(() => {
    async function fetchImages() {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('question_images')
        .select('id, storage_path, original_name, sort_order')
        .eq('question_id', questionId)
        .order('sort_order');

      if (fetchError) {
        setError(`Impossible de charger les images : ${fetchError.message}`);
      } else if (data && data.length > 0) {
        const withUrls = data.map((img) => {
          const { data: urlData } = supabase.storage
            .from('question-images')
            .getPublicUrl(img.storage_path);
          return { ...img, publicUrl: urlData?.publicUrl ?? '' };
        });
        setImages(withUrls);
      }
      setLoading(false);
    }
    fetchImages();
  }, [questionId]);

  // Handle image selection — queue for upload (batched)
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image trop lourde (max 5 Mo)');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPendingUploads((prev) => [...prev, { file, previewUrl }]);

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Mark an existing image for deletion (batched)
  const handleMarkDelete = useCallback((imageId: string) => {
    setPendingDeletes((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) {
        next.delete(imageId); // Toggle off
      } else {
        next.add(imageId);
      }
      return next;
    });
  }, []);

  // Remove a pending upload
  const handleRemovePending = useCallback((index: number) => {
    setPendingUploads((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Save: execute all batched operations + save text
  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    let imageChanged = false;

    try {
      // 1. Delete marked images
      if (pendingDeletes.size > 0) {
        for (const imageId of Array.from(pendingDeletes)) {
          const img = images.find((i) => i.id === imageId);
          if (!img) continue;

          // Delete from storage (best-effort)
          await supabase.storage.from('question-images').remove([img.storage_path]);
          // Delete from DB
          const { error: deleteError } = await supabase
            .from('question_images')
            .delete()
            .eq('id', imageId);
          if (deleteError) {
            throw new Error(`Suppression de l'image impossible : ${deleteError.message}`);
          }

          imageChanged = true;
          setImages((prev) => prev.filter((i) => i.id !== imageId));
          setPendingDeletes((prev) => {
            const next = new Set(prev);
            next.delete(imageId);
            return next;
          });
        }
      }

      // 2. Upload new images
      if (pendingUploads.length > 0) {
        setUploading(true);
        const maxSort = images.length > 0
          ? Math.max(...images.map((i) => i.sort_order)) + 1
          : 0;

        for (let i = 0; i < pendingUploads.length; i++) {
          const pending = pendingUploads[i];
          const { file } = pending;
          const ext = file.name.split('.').pop() ?? 'png';
          const storagePath = `${questionId}/img_${Date.now()}_${i}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('question-images')
            .upload(storagePath, file, {
              contentType: file.type,
              upsert: false,
            });

          if (uploadError) {
            throw new Error(`Envoi de l'image impossible : ${uploadError.message}`);
          }

          const { data: inserted, error: insertError } = await supabase
            .from('question_images')
            .insert({
              question_id: questionId,
              storage_path: storagePath,
              original_name: file.name,
              sort_order: maxSort + i,
            })
            .select('id, storage_path, original_name, sort_order')
            .single();

          if (insertError) {
            await supabase.storage.from('question-images').remove([storagePath]);
            throw new Error(`Enregistrement de l'image impossible : ${insertError.message}`);
          }

          imageChanged = true;
          const { data: urlData } = supabase.storage
            .from('question-images')
            .getPublicUrl(inserted.storage_path);
          setImages((prev) => [...prev, { ...inserted, publicUrl: urlData?.publicUrl ?? '' }]);
          setPendingUploads((prev) => prev.filter((pu) => pu !== pending));
          URL.revokeObjectURL(pending.previewUrl);
        }
        setUploading(false);
      }

      // 3. If images changed, touch updated_at to trigger draft detection
      if (imageChanged) {
        const { error: touchError } = await supabase
          .from('questions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', questionId);
        if (touchError) {
          throw new Error(`Mise à jour de la question impossible : ${touchError.message}`);
        }
      }

      // 4. Save text
      onSave(text);
    } catch (err) {
      console.error('EnoncePopup save error:', err);
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
      setUploading(false);
      setSaving(false);
    }
  }, [text, images, pendingDeletes, pendingUploads, questionId, onSave]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      for (const pu of pendingUploads) {
        URL.revokeObjectURL(pu.previewUrl);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleImages = images.filter((img) => !pendingDeletes.has(img.id));
  const hasChanges = text !== cleanInitial || pendingUploads.length > 0 || pendingDeletes.size > 0;

  return (
    <Modal onClose={onClose} title="Modifier l'énoncé" maxWidth="max-w-2xl">
      {error && <p role="alert" className="mb-3 text-sm text-error">{error}</p>}

      {/* Text editor */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        className="w-full resize-y rounded-lg border border-neutral-300 p-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        placeholder="Texte de la question..."
      />

      {/* Image gallery */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Images ({visibleImages.length + pendingUploads.length})
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200 disabled:opacity-50"
          >
            {uploading ? '...' : '+ Image'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
        </div>

        {loading ? (
          <div className="mt-2 flex gap-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 w-20 animate-pulse rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : (visibleImages.length === 0 && pendingUploads.length === 0) ? (
          <p className="mt-2 text-xs text-neutral-400">Aucune image.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-3">
            {/* Existing images */}
            {visibleImages.map((img) => (
              <div key={img.id} className="group relative">
                <img
                  src={img.publicUrl}
                  alt={img.original_name ?? 'Image'}
                  className="h-24 w-auto max-w-[200px] rounded-lg border border-neutral-200 object-contain"
                />
                <button
                  type="button"
                  onClick={() => handleMarkDelete(img.id)}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100"
                  title="Supprimer cette image"
                >
                  <Trash size={12} />
                </button>
              </div>
            ))}
            {/* Pending uploads (preview) */}
            {pendingUploads.map((pu, i) => (
              <div key={`pending-${i}`} className="group relative">
                <img
                  src={pu.previewUrl}
                  alt={pu.file.name}
                  className="h-24 w-auto max-w-[200px] rounded-lg border-2 border-dashed border-primary/40 object-contain"
                />
                <button
                  type="button"
                  onClick={() => handleRemovePending(i)}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-500 text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100"
                  title="Retirer"
                >
                  <Trash size={12} />
                </button>
                <span className="absolute bottom-0.5 left-0.5 rounded bg-primary/80 px-1 py-0.5 text-[9px] font-medium text-white">
                  Nouveau
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Deleted images indicator */}
        {pendingDeletes.size > 0 && (
          <p className="mt-2 text-xs text-red-500">
            {pendingDeletes.size} image{pendingDeletes.size > 1 ? 's' : ''} sera{pendingDeletes.size > 1 ? 'ont' : ''} supprimée{pendingDeletes.size > 1 ? 's' : ''} à l&apos;enregistrement.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] rounded-2xl glass-btn-secondary px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="min-h-[44px] rounded-2xl bg-primary glass-btn px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </Modal>
  );
}
