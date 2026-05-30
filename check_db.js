const url = 'https://paqijpdgwttioiizlfzv.supabase.co/rest/v1/';
const apikey = 'sb_publishable_lArZgj0m8XmlPUNXR7UK-A_rDQ1ldrZ';

async function check() {
  const headers = {
    'apikey': apikey,
    'Authorization': `Bearer ${apikey}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
  };

  const branchRes = await fetch(url + 'branches?select=*&limit=1', { headers: { 'apikey': apikey } });
  const branches = await branchRes.json();
  const merchantId = branches[0].merchant_id;
  const branchId = branches[0].id;
  console.log(`Using merchant_id: ${merchantId}, branch_id: ${branchId}`);

  console.log('\nTesting upsert with onConflict=branch_id,key...');
  try {
    const payload = {
      key: 'test_upsert_key',
      value: 'val_branch2',
      merchant_id: merchantId,
      branch_id: branchId
    };
    const res = await fetch(url + 'settings?on_conflict=branch_id,key', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    console.log('Upsert branch_id,key Status:', res.status);
    console.log('Upsert branch_id,key Response:', await res.json().catch(() => 'No JSON'));
  } catch (err) {
    console.error('Upsert branch_id,key Exception:', err);
  }
}

check();
