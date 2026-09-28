export function useSupabase() { return process.env.MENTORING_BACKEND === 'supabase'; }
export function supabaseConfig() {
 const url = process.env.MENTORING_SUPABASE_URL;
 const key = process.env.MENTORING_SUPABASE_PUBLISHABLE_KEY;
 if (!url || !key) throw new Error('Mentoring Supabase is not configured.');
 return { url, key };
}
