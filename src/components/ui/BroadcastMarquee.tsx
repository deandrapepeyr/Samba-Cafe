'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Megaphone } from 'lucide-react';

export function BroadcastMarquee() {
  const [message, setMessage] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    // Initial fetch
    const fetchMessage = async () => {
      const { data } = await supabase
        .from('settings')
        .select('*')
        .in('key', ['broadcast_message', 'broadcast_enabled']);
        
      if (data) {
        const msgData = data.find(s => s.key === 'broadcast_message');
        const enabledData = data.find(s => s.key === 'broadcast_enabled');
        
        if (msgData && msgData.value) {
          setMessage(msgData.value);
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }
        
        if (enabledData) {
          setIsEnabled(enabledData.value !== 'false');
        }
      }
    };
    
    fetchMessage();

    // Subscribe to realtime changes (no key filter so we catch both)
    const channel = supabase.channel('settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'settings',
        },
        (payload) => {
          if (payload.new && 'key' in payload.new && 'value' in payload.new) {
            if (payload.new.key === 'broadcast_message') {
              const newMsg = payload.new.value;
              setMessage(newMsg);
              setIsVisible(!!newMsg);
            } else if (payload.new.key === 'broadcast_enabled') {
              setIsEnabled(payload.new.value !== 'false');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!isVisible || !message || !isEnabled) return null;

  return (
    <div className="w-full bg-primary/20 border-b border-primary/30 text-primary py-2 px-4 flex items-center overflow-hidden shrink-0">
      <Megaphone size={16} className="shrink-0 mr-3 animate-pulse" />
      <div className="w-full overflow-hidden whitespace-nowrap">
        <div className="inline-block animate-[marquee_20s_linear_infinite] font-semibold text-sm">
          {message}
          <span className="mx-8 text-primary/50">•</span>
          {message}
          <span className="mx-8 text-primary/50">•</span>
          {message}
        </div>
      </div>
    </div>
  );
}
