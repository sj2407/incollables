'use client';

import { useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import DOMPurify from 'dompurify';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';

interface TipTapEditorProps {
  value: string;
  onSave: (html: string) => void;
  onClose: () => void;
}

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`min-h-[36px] min-w-[36px] rounded-lg px-2 py-1 text-sm font-medium transition-colors ${
        active
          ? 'bg-primary-100 text-primary-700'
          : 'text-neutral-600 hover:bg-neutral-100'
      }`}
    >
      {children}
    </button>
  );
}

export default function TipTapEditor({ value, onSave, onClose }: TipTapEditorProps) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[200px] p-4 outline-none focus:outline-none',
      },
    },
  });

  const isEmpty = editor?.isEmpty ?? true;

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image trop lourde (max 5 Mo)'); return; }

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `explanations/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('explanations')
      .upload(path, file, { cacheControl: '31536000', upsert: false });

    if (uploadError) {
      console.error('Upload failed:', uploadError.message);
      setUploading(false);
      // Reset input so user can try again
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const { data: urlData } = supabase.storage.from('explanations').getPublicUrl(path);
    if (urlData?.publicUrl) {
      editor.chain().focus().insertContent(`<img src="${urlData.publicUrl}" />`).run();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [editor]);

  const handleSave = useCallback(() => {
    if (!editor) return;
    setSaving(true);
    const rawHtml = editor.isEmpty ? '' : editor.getHTML();
    // Sanitize with DOMPurify before saving
    const sanitized = rawHtml ? DOMPurify.sanitize(rawHtml, { ADD_TAGS: ['img'], ADD_ATTR: ['src', 'alt'] }) : '';
    onSave(sanitized);
  }, [editor, onSave]);

  if (!editor) return null;

  return (
    <Modal onClose={onClose} title="Modifier l'explication" maxWidth="max-w-2xl">
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1.5">
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Gras"
        >
          <strong>G</strong>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italique"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Souligné"
        >
          <u>U</u>
        </ToolbarButton>

        <span className="mx-1 border-r border-neutral-300" />

        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Liste à puces"
        >
          • Liste
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Liste numérotée"
        >
          1. Liste
        </ToolbarButton>

        <span className="mx-1 border-r border-neutral-300" />

        <ToolbarButton
          active={false}
          onClick={() => fileInputRef.current?.click()}
          title="Insérer une image"
        >
          {uploading ? '...' : '🖼 Image'}
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {/* Editor */}
      <div className="rounded-lg border border-neutral-200 bg-white">
        <EditorContent editor={editor} />
      </div>

      {isEmpty && (
        <p className="mt-2 text-xs text-neutral-400">L&apos;explication sera vide si vous enregistrez maintenant.</p>
      )}

      {/* Actions */}
      <div className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="min-h-[44px] rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Enregistrement...' : isEmpty ? 'Enregistrer (vide)' : 'Enregistrer'}
        </button>
      </div>
    </Modal>
  );
}
