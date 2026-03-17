const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN');
if (!allowedOrigin) {
  console.warn('ALLOWED_ORIGIN env var not set — CORS will reject cross-origin requests');
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin ?? '',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};
