// Cliente do serviço de contas/dados original (mantido separado do Lovable Cloud).
import { createClient } from '@supabase/supabase-js';
import type { Database } from './app-db-types';

// Fallback seguro: sem credenciais, createClient() lança "supabaseUrl is required."
// no load do módulo → tela branca. Com o placeholder a app RENDERIZA e segue pedindo as
// credenciais; `supabaseConfigured` (em @/lib/supabase) lê o env CRU e continua false até
// as creds reais chegarem (a UI exibe "não configurado" / o onboarding de chaves).
// Fallback com as credenciais reais do projeto (anon key é pública por design,
// protegida por RLS). Evita que builds onde a env não foi injetada caiam no
// placeholder e quebrem auth no domínio publicado.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://auytmefqnuzbktyzcled.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1eXRtZWZxbnV6Ymt0eXpjbGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTc4MjYsImV4cCI6MjA5ODIzMzgyNn0.zIRr-xM3Z_nM3xkOKWp6J3uCRVi_fWeiGvxZlOh7Rok';


function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

// Import the supabase client like this:
// import { supabase } from "@/lib/app-db-client";

export const supabase = createClient<Database, 'app_social'>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  // Repoint: banco central. Todo .from() resolve em app_social; identidade/bootstrap via .schema('core').
  db: { schema: 'app_social' },
  global: {
    fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
  },
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
