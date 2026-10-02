import { saveMaterialField } from '../adminMaterialActions';
import { createClient } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }));

const mockedCreateClient = createClient as jest.Mock;

function mockSupabase() {
  const eq = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ update }));
  const rpc = jest.fn().mockResolvedValue({ error: null });
  mockedCreateClient.mockReturnValue({ from, rpc });
  return { from, update, eq, rpc };
}

describe('saveMaterialField', () => {
  beforeEach(() => {
    mockedCreateClient.mockReset();
  });

  it('rejects unknown fields without touching the database', async () => {
    const { from } = mockSupabase();
    const result = await saveMaterialField('m1', 'deleted_at', null, 'x');
    expect(result).toEqual({ success: false, error: 'Champ inconnu : deleted_at' });
    expect(from).not.toHaveBeenCalled();
  });

  it('saves allowed text fields as-is', async () => {
    const { from, update, eq } = mockSupabase();
    const result = await saveMaterialField('m1', 'title', 'Old', 'New');
    expect(result).toEqual({ success: true });
    expect(from).toHaveBeenCalledWith('learning_materials');
    expect(update).toHaveBeenCalledWith({ title: 'New', is_draft: true });
    expect(eq).toHaveBeenCalledWith('id', 'm1');
  });

  it.each(['is_active', 'needs_review'])('parses boolean field %s', async (field) => {
    const { update } = mockSupabase();
    await saveMaterialField('m1', field, 'false', 'true');
    expect(update).toHaveBeenCalledWith({ [field]: true, is_draft: true });
  });
});
