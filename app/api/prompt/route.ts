import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RequestBody {
  prompt: string;
  session_id?: string;
  server_url: string;
  auth_token?: string;
}

function ndjsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ type: 'error', message }) + '\n', {
    status,
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: RequestBody;

  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return ndjsonError('Invalid JSON body', 400);
  }

  const { prompt, session_id, server_url, auth_token } = body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return ndjsonError('Missing or empty prompt', 400);
  }

  if (!server_url || typeof server_url !== 'string') {
    return ndjsonError('Missing server_url', 400);
  }

  // Validate server_url is an http(s) URL to prevent SSRF to arbitrary schemes
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(server_url);
  } catch {
    return ndjsonError('Invalid server_url', 400);
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    return ndjsonError('server_url must be http or https', 400);
  }

  const base = server_url.replace(/\/$/, '');

  try {
    const upstream = await fetch(`${base}/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth_token ? { Authorization: `Bearer ${auth_token}` } : {}),
      },
      body: JSON.stringify({
        prompt: prompt.trim(),
        ...(session_id ? { session_id } : {}),
      }),
    });

    if (!upstream.ok) {
      return ndjsonError(`Relay returned HTTP ${upstream.status}`, 502);
    }

    if (!upstream.body) {
      return ndjsonError('Relay returned empty body', 502);
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache, no-store',
        'X-Accel-Buffering': 'no',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Relay unreachable';
    return ndjsonError(message, 502);
  }
}
