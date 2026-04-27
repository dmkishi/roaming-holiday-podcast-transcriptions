import { z } from 'zod';
import { CLOUDFLARE_API_BASE } from '@lib/config/cloudflare.js';
import type { CloudflareEnv } from '@lib/upload-cloudflare/env.js';

const CfErrorSchema = z.object({ code: z.number(), message: z.string() });
const CfItemSchema = z.object({ id: z.string(), key: z.string() });
const CfListEnvelopeSchema = z.object({
  result: z.array(CfItemSchema).nullable(),
  success: z.boolean(),
  errors: z.array(CfErrorSchema).optional(),
});

const CfItemEnvelopeSchema = z.object({
  result: CfItemSchema.nullable(),
  success: z.boolean(),
  errors: z.array(CfErrorSchema).optional(),
});

function itemsUrl(env: CloudflareEnv, suffix = ''): string {
  return `${CLOUDFLARE_API_BASE}/accounts/${env.accountId}/ai-search/instances/${env.instance}/items${suffix}`;
}

function authHeaders(env: CloudflareEnv): Record<string, string> {
  return { Authorization: `Bearer ${env.apiToken}` };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function describeErrors(errors: { code: number; message: string }[] | undefined): string {
  if (!errors || errors.length === 0) return 'unknown error';
  return errors.map((e) => `[${e.code}] ${e.message}`).join('; ');
}

const CfErrorEnvelopeSchema = z.object({
  success: z.boolean().optional(),
  errors: z.array(CfErrorSchema).optional(),
});

async function parseJson<S extends z.ZodType>(res: Response, schema: S):
  Promise<{ ok: true; body: z.infer<S> } | { ok: false; error: string }> {
  const text = await res.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    const snippet = text.slice(0, 800);
    return { ok: false, error: `HTTP ${res.status}: invalid JSON response (${errorMessage(error)}): ${snippet}` };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fallback = CfErrorEnvelopeSchema.safeParse(raw);
    if (fallback.success && fallback.data.errors && fallback.data.errors.length > 0) {
      return { ok: false, error: `HTTP ${res.status}: ${describeErrors(fallback.data.errors)}` };
    }
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return { ok: false, error: `HTTP ${res.status}: unexpected response shape (${issues})` };
  }
  return { ok: true, body: parsed.data };
}

export type ListResult =
  | { ok: true; keys: Set<string> }
  | { ok: false; error: string };

export async function listItemKeys(env: CloudflareEnv): Promise<ListResult> {
  const keys = new Set<string>();
  const perPage = 50;
  let page = 1;

  while (true) {
    const url = `${itemsUrl(env)}?per_page=${perPage}&page=${page}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: authHeaders(env) });
    } catch (error) {
      return { ok: false, error: `Network error: ${errorMessage(error)}` };
    }

    const parsed = await parseJson(res, CfListEnvelopeSchema);
    if (!parsed.ok) return parsed;
    const body = parsed.body;

    if (!res.ok || !body.success || !body.result) {
      return { ok: false, error: `HTTP ${res.status}: ${describeErrors(body.errors)}` };
    }

    for (const item of body.result) keys.add(item.key);

    if (body.result.length < perPage) break;
    page += 1;
  }

  return { ok: true, keys };
}

export type UploadResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function uploadItem(
  env: CloudflareEnv,
  key: string,
  content: Buffer,
  metadata: Record<string, string>,
): Promise<UploadResult> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(content)], { type: 'text/markdown' });
  form.append('file', blob, key);
  form.append('metadata', JSON.stringify(metadata));

  let res: Response;
  try {
    res = await fetch(itemsUrl(env), { method: 'POST', headers: authHeaders(env), body: form });
  } catch (error) {
    return { ok: false, error: `Network error: ${errorMessage(error)}` };
  }

  const parsed = await parseJson(res, CfItemEnvelopeSchema);
  if (!parsed.ok) return parsed;
  const body = parsed.body;

  if (!res.ok || !body.success || !body.result) {
    return { ok: false, error: `HTTP ${res.status}: ${describeErrors(body.errors)}` };
  }

  return { ok: true, id: body.result.id };
}
