import { createClient } from '@supabase/supabase-js';

console.log('Initializing Supabase client...');
const supabase = createClient(
  'https://paqijpdgwttioiizlfzv.supabase.co',
  'sb_publishable_lArZgj0m8XmlPUNXR7UK-A_rDQ1ldrZ'
);

async function check() {
  console.log('Querying settings table...');
  const { data, error } = await supabase.from('settings').select('*').limit(1);
  console.log('Settings Data:', data);
  console.log('Settings Error:', error);

  console.log('Querying users table...');
  const { data: users, error: usersErr } = await supabase.from('users').select('*').limit(10);
  console.log('Users Data:', users);
  console.log('Users Error:', usersErr);
}

check().catch(err => {
  console.error('Unhandled rejection in check:', err);
});
