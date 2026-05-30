import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://paqijpdgwttioiizlfzv.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_lArZgj0m8XmlPUNXR7UK-A_rDQ1ldrZ';

export const supabase = createClient(supabaseUrl, supabaseKey);
