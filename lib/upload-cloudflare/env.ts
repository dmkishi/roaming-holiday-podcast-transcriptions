export interface CloudflareEnv {
  apiToken: string;
  accountId: string;
  instance: string;
}

type LoadEnvResult =
  | { ok: true; env: CloudflareEnv }
  | { ok: false; missing: string[] };

const VAR_NAMES = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_AI_SEARCH_INSTANCE'] as const;

export function loadCloudflareEnv(): LoadEnvResult {
  const missing = VAR_NAMES.filter((name) => {
    const value = process.env[name];
    return value === undefined || value === '';
  });
  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    env: {
      apiToken: process.env['CLOUDFLARE_API_TOKEN']!,
      accountId: process.env['CLOUDFLARE_ACCOUNT_ID']!,
      instance: process.env['CLOUDFLARE_AI_SEARCH_INSTANCE']!,
    },
  };
}
