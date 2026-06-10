import { createBrowserClient } from '@supabase/ssr';

let _supabase: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabase() {
  if (_supabase) return _supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // During build/prerender, env vars may not be available.
    // Return a dummy proxy that won't throw so static pages can be generated.
    console.warn('[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — client not initialized.');
    return null;
  }

  _supabase = createBrowserClient(url, key);
  return _supabase;
}

// Keep backward-compatible named export (lazy — only accessed at runtime in the browser)
// Using a getter so it doesn't execute at module evaluation time.
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, prop) {
    const client = getSupabase();
    if (!client) {
      // If called during SSR/prerender without env vars, throw a clear error
      // that is caught by Next.js prerender error handling.
      if (typeof window === 'undefined') {
        throw new Error(
          '[Supabase] Client is not available during prerendering. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
        );
      }
      throw new Error('[Supabase] Client is not initialized. Check your environment variables.');
    }
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});