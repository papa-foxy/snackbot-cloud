import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

const KEEPALIVE_KEY = 'sb_last_keepalive_timestamp';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Periodically writes a heartbeat ping to `_keepalive` table via Supabase REST API
 * whenever users access the application, keeping Supabase from auto-pausing.
 */
export function useSupabaseKeepalive() {
  useEffect(() => {
    const checkAndPing = async () => {
      try {
        const lastPing = localStorage.getItem(KEEPALIVE_KEY);
        const now = Date.now();

        if (!lastPing || now - Number(lastPing) > THREE_DAYS_MS) {
          const timestamp = new Date().toISOString();
          
          // Increment counter and update timestamp on the dedicated keepalive row
          const { data: current } = await supabase
            .from('_keepalive')
            .select('ping_count')
            .eq('id', 1)
            .maybeSingle();

          const nextCount = (current?.ping_count ?? 0) + 1;

          const { error } = await supabase
            .from('_keepalive')
            .upsert({
              id: 1,
              last_ping: timestamp,
              ping_count: nextCount,
            });

          if (!error) {
            localStorage.setItem(KEEPALIVE_KEY, String(now));
          }
        }
      } catch (err) {
        // Non-blocking background telemetry
        console.debug('Keepalive ping skipped:', err);
      }
    };

    checkAndPing();
  }, []);
}
