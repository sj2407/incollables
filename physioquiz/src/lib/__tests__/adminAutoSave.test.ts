import { logEdit } from '../adminAutoSave';

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }));

type Client = Parameters<typeof logEdit>[0];

function fakeClient(result: { error: { message: string } | null }) {
  const rpc = jest.fn().mockResolvedValue(result);
  return { client: { rpc } as unknown as Client, rpc };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('logEdit', () => {
  afterEach(() => jest.restoreAllMocks());

  it('calls the given RPC with the params and returns synchronously', () => {
    const { client, rpc } = fakeClient({ error: null });
    const params = { p_question_id: 'q1', p_field: 'question_text', p_old: 'a', p_new: 'b' };
    const result = logEdit(client, 'log_admin_edit', params);
    expect(result).toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('log_admin_edit', params);
  });

  it('reports RPC errors to the console without throwing', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { client } = fakeClient({ error: { message: 'boom' } });
    logEdit(client, 'log_material_edit', {
      p_material_id: null,
      p_field: 'bulk_delete',
      p_old: '2',
      p_new: 'x',
    });
    await flush();
    expect(consoleError).toHaveBeenCalledWith('Failed to log_material_edit:', 'boom');
  });

  it('stays silent on success', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { client } = fakeClient({ error: null });
    logEdit(client, 'log_admin_edit', {
      p_question_id: null,
      p_field: 'bulk_move',
      p_old: '',
      p_new: '',
    });
    await flush();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
