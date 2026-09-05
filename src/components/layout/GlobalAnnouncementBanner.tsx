import React, { useState, useEffect } from 'react';
import { Megaphone, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../utils/cn';

export function GlobalAnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('snackbot_platform_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.broadcastAnnouncement || '';
      }
    } catch {}
    return '';
  });

  const [dismissed, setDismissed] = useState(false);

  // Sync announcement from Supabase & listen for realtime updates
  useEffect(() => {
    let isMounted = true;

    const fetchAnnouncement = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'platform_broadcast_announcement')
          .maybeSingle();

        if (data?.value && isMounted) {
          try {
            const parsed = JSON.parse(data.value);
            const msg = typeof parsed === 'object' ? (parsed.message || '') : parsed;
            setAnnouncement(msg);
          } catch {
            setAnnouncement(data.value);
          }
        }
      } catch (err) {
        console.warn('Could not fetch global announcement from Supabase:', err);
      }
    };

    fetchAnnouncement();

    // Supabase Realtime listener
    const channel = supabase
      .channel('platform_announcement_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'settings',
          filter: 'key=eq.platform_broadcast_announcement'
        },
        (payload: any) => {
          if (payload.new && payload.new.value && isMounted) {
            try {
              const parsed = JSON.parse(payload.new.value);
              const msg = typeof parsed === 'object' ? (parsed.message || '') : parsed;
              setAnnouncement(msg);
              setDismissed(false); // New message clears dismiss
            } catch {
              setAnnouncement(payload.new.value);
              setDismissed(false);
            }
          }
        }
      )
      .subscribe();

    // Custom window event listener (instant local sync)
    const handleLocalUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ message?: string }>;
      if (customEvent.detail?.message !== undefined) {
        setAnnouncement(customEvent.detail.message);
        setDismissed(false);
      }
    };

    // Storage event for other tabs in same browser
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'snackbot_platform_settings' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.broadcastAnnouncement !== undefined) {
            setAnnouncement(parsed.broadcastAnnouncement);
            setDismissed(false);
          }
        } catch {}
      }
    };

    window.addEventListener('snackbot_announcement_updated', handleLocalUpdate);
    window.addEventListener('storage', handleStorage);

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      window.removeEventListener('snackbot_announcement_updated', handleLocalUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Check if current message was dismissed
  const activeMessage = announcement?.trim();
  const dismissedMessage = sessionStorage.getItem('snackbot_dismissed_announcement');

  if (!activeMessage || dismissed || dismissedMessage === activeMessage) {
    return null;
  }

  const handleDismiss = () => {
    sessionStorage.setItem('snackbot_dismissed_announcement', activeMessage);
    setDismissed(true);
  };

  return (
    <div className="relative z-40 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white px-4 py-2.5 shadow-sm border-b border-amber-600/30 shrink-0 animate-in slide-in-from-top duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <Megaphone className="w-3.5 h-3.5 text-white" />
          </div>

          <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-extrabold uppercase tracking-wider shrink-0 border border-white/20">
            Announcement
          </span>

          <p className="font-semibold text-white truncate text-xs">
            {activeMessage}
          </p>
        </div>

        <button
          onClick={handleDismiss}
          title="Dismiss Announcement"
          className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
