console.log('Initializing fetch query...');
const url = 'https://paqijpdgwttioiizlfzv.supabase.co/rest/v1/';
const apikey = 'sb_publishable_lArZgj0m8XmlPUNXR7UK-A_rDQ1ldrZ';

async function check() {
  const headers = {
    'apikey': apikey,
    'Authorization': `Bearer ${apikey}`
  };

  console.log('Querying settings...');
  try {
    const res = await fetch(url + 'settings?select=*&limit=1', { headers });
    console.log('Settings Status:', res.status);
    const data = await res.json();
    console.log('Settings Data:', data);
  } catch (err) {
    console.error('Settings Error:', err);
  }

  console.log('Querying users...');
  try {
    const res = await fetch(url + 'users?select=*&limit=10', { headers });
    console.log('Users Status:', res.status);
    const data = await res.json();
    console.log('Users Data:', data);
  } catch (err) {
    console.error('Users Error:', err);
  }
}

check();
