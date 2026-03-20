import { createClient } from '@/lib/supabase/client';
import type { AdminMaterialRow, DeletedMaterial, MaterialSyncDiffItem, MaterialType } from '@/types/admin';

/** Fetch materials of a given type with optional filters */
export async function fetchMaterials(
  type: MaterialType,
  topicId?: string | null,
  search?: string | null,
): Promise<{ data: AdminMaterialRow[]; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_admin_materials', {
    p_type: type,
    p_topic_id: topicId || null,
    p_search: search || null,
  });
  if (error) return { data: [], error: error.message };
  return { data: (data as AdminMaterialRow[]) ?? [] };
}

/** Save a single field on a material + log the edit */
export async function saveMaterialField(
  materialId: string,
  field: string,
  oldValue: string | null,
  newValue: string | null,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  let dbValue: string | boolean | null = newValue;
  if (field === 'is_active' || field === 'needs_review') dbValue = newValue === 'true';

  const { error } = await supabase
    .from('learning_materials')
    .update({ [field]: dbValue, is_draft: true })
    .eq('id', materialId);

  if (error) return { success: false, error: error.message };

  // Log (fire-and-forget)
  supabase.rpc('log_material_edit', {
    p_material_id: materialId,
    p_field: field,
    p_old: oldValue ?? '',
    p_new: newValue ?? '',
  }).then(({ error: logErr }) => {
    if (logErr) console.error('Failed to log material edit:', logErr.message);
  });

  return { success: true };
}

/** Soft-delete materials (move to corbeille) */
export async function softDeleteMaterials(ids: string[]): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('learning_materials')
    .update({ deleted_at: new Date().toISOString(), is_draft: true })
    .in('id', ids);

  if (error) return { success: false, error: error.message };

  supabase.rpc('log_material_edit', {
    p_material_id: null,
    p_field: 'bulk_delete',
    p_old: `${ids.length} éléments`,
    p_new: 'mis à la corbeille',
  }).then(({ error: logErr }) => {
    if (logErr) console.error('Failed to log material delete:', logErr.message);
  });

  return { success: true };
}

/** Restore a material from corbeille */
export async function restoreMaterial(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('learning_materials')
    .update({ deleted_at: null, is_draft: true })
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Get deleted materials for corbeille panel */
export async function getDeletedMaterials(type: MaterialType): Promise<DeletedMaterial[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_deleted_materials', { p_type: type });
  if (error) {
    console.error('getDeletedMaterials error:', error.message);
    return [];
  }
  return (data as DeletedMaterial[]) ?? [];
}

/** Get draft count for a material type */
export async function getMaterialDraftCount(type?: MaterialType): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_material_draft_count', { p_type: type ?? null });
  if (error) {
    console.error('getMaterialDraftCount error:', error.message);
    return 0;
  }
  return Number(data) ?? 0;
}

/** Publish all material drafts of a given type */
export async function publishMaterialDrafts(type?: MaterialType, force = false): Promise<{ success: boolean; count: number; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('publish_material_drafts', { p_type: type ?? null, p_force: force });
  if (error) return { success: false, count: 0, error: error.message };
  return { success: true, count: Number(data) ?? 0 };
}

/** Get sync diff for confirmation modal */
export async function getMaterialSyncDiff(type?: MaterialType): Promise<MaterialSyncDiffItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_material_sync_diff', { p_type: type ?? null });
  if (error) {
    console.error('getMaterialSyncDiff error:', error.message);
    return [];
  }
  return (data as MaterialSyncDiffItem[]) ?? [];
}

/** Bulk activate/deactivate materials */
export async function bulkActivateMaterials(ids: string[], activate: boolean): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('learning_materials')
    .update({ is_active: activate, is_draft: true })
    .in('id', ids);

  if (error) return { success: false, error: error.message };

  supabase.rpc('log_material_edit', {
    p_material_id: null,
    p_field: activate ? 'bulk_activate' : 'bulk_deactivate',
    p_old: `${ids.length} éléments`,
    p_new: activate ? 'activés' : 'désactivés',
  }).then(({ error: logErr }) => {
    if (logErr) console.error('Failed to log bulk action:', logErr.message);
  });

  return { success: true };
}

/** Bulk move materials to a different topic */
export async function bulkMoveMaterials(
  ids: string[],
  topicId: string,
  topicTitle: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('learning_materials')
    .update({ topic_id: topicId, is_draft: true })
    .in('id', ids);

  if (error) return { success: false, error: error.message };

  supabase.rpc('log_material_edit', {
    p_material_id: null,
    p_field: 'bulk_move',
    p_old: `${ids.length} éléments`,
    p_new: topicTitle,
  }).then(({ error: logErr }) => {
    if (logErr) console.error('Failed to log bulk move:', logErr.message);
  });

  return { success: true };
}
