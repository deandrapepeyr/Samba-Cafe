'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Megaphone } from 'lucide-react';

export function BroadcastMarquee() {
  const [message, setMessage] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Initial fetch
    const fetchMessage = async () => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'broadcast_message')
        .single();
        
      if (data && data.value) {
        setMessage(data.value);
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };
    
    fetchMessage();

    // Subscribe to realtime changes
    const channel = supabase.channel('settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'settings',
          filter: 'key=eq.broadcast_message'
        },
        (payload) => {
          if (payload.new && 'value' in payload.new) {
            const newMsg = payload.new.value;
            setMessage(newMsg);
            setIsVisible(!!newMsg);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!isVisible || !message) return null;

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
