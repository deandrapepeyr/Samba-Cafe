'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Heart } from 'lucide-react';

export function BroadcastMarquee() {
  const [messages, setMessages] = useState<string[]>([]);
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
          try {
            const parsed = JSON.parse(msgData.value);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setMessages(parsed);
              setIsVisible(true);
            } else {
              setMessages([msgData.value]);
              setIsVisible(true);
            }
          } catch {
            setMessages([msgData.value]);
            setIsVisible(true);
          }
        } else {
          setIsVisible(false);
        }
        
        if (enabledData) {
          setIsEnabled(enabledData.value !== 'false');
        }
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
        },
        (payload) => {
          if (payload.new && 'key' in payload.new && 'value' in payload.new) {
            if (payload.new.key === 'broadcast_message') {
              const newMsg = payload.new.value;
              if (newMsg) {
                try {
                  const parsed = JSON.parse(newMsg);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    setMessages(parsed);
                    setIsVisible(true);
                  } else {
                    setMessages([newMsg]);
                    setIsVisible(true);
                  }
                } catch {
                  setMessages([newMsg]);
                  setIsVisible(true);
                }
              } else {
                setMessages([]);
                setIsVisible(false);
              }
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

  if (!isVisible || messages.length === 0 || !isEnabled) return null;

  const joinedMessage = messages.join(' ✦ ');

  return (
    <div className="w-full bg-gradient-to-r from-rose-500/15 via-pink-500/15 to-rose-500/15 border-b border-rose-500/20 text-rose-400 py-3.5 px-6 flex items-center overflow-hidden shrink-0 shadow-sm shadow-rose-500/5">
      <Heart size={24} className="shrink-0 mr-4 animate-pulse text-rose-500 fill-rose-500/40" />
      <div className="w-full overflow-hidden whitespace-nowrap">
        <div className="inline-block animate-[marquee_20s_linear_infinite] font-semibold text-[17px] tracking-wide drop-shadow-sm">
          {joinedMessage}
          <span className="mx-10 text-rose-500/60 text-lg">❤️</span>
          {joinedMessage}
          <span className="mx-10 text-rose-500/60 text-lg">❤️</span>
          {joinedMessage}
        </div>
      </div>
    </div>
  );
}
