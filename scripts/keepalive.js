/**
 * Supabase Keepalive Ping
 * 
 * Updates the `_keepalive` table via Supabase REST API.
 * This triggers external REST API activity and database write transactions,
 * preventing Supabase Free Tier from auto-pausing after 7 days of inactivity.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://paqijpdgwttioiizlfzv.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_lArZgj0m8XmlPUNXR7UK-A_rDQ1ldrZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function keepalive() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Sending Supabase keepalive heartbeat to _keepalive table...`);

  try {
    // 1. Fetch current counter
    const { data: current, error: fetchErr } = await supabase
      .from('_keepalive')
      .select('id, ping_count')
      .eq('id', 1)
      .maybeSingle();

    if (fetchErr) {
      console.error('❌ Failed to read _keepalive:', fetchErr.message);
      process.exit(1);
    }

    const nextCount = (current?.ping_count ?? 0) + 1;

    // 2. Upsert heartbeat
    const { data, error } = await supabase
      .from('_keepalive')
      .upsert({
        id: 1,
        last_ping: timestamp,
        ping_count: nextCount,
      })
      .select('id, last_ping, ping_count')
      .single();

    if (error) {
      console.error('❌ Heartbeat write failed:', error.message);
      process.exit(1);
    }

    console.log('✅ Supabase keepalive succeeded!');
    console.log(`   Table      : _keepalive`);
    console.log(`   Last Ping  : ${data.last_ping}`);
    console.log(`   Total Pings: ${data.ping_count}`);
  } catch (err) {
    console.error('❌ Unexpected error during keepalive:', err);
    process.exit(1);
  }
}

keepalive();
