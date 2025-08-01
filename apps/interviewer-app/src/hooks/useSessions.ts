import { useState, useEffect, useCallback } from 'react';
import { supabase, Session } from '../services/supabase';

export const useSessions = (callUrl: string | null) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(
    async (background = false) => {
      if (!callUrl) {
        setSessions([]);
        return;
      }

      if (!background) {
        setLoading(true);
      }

      setError(null);

      try {
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('call_url', callUrl)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setSessions(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!background) {
          setLoading(false);
        }
      }
    },
    [callUrl]
  );

  useEffect(() => {
    fetchSessions();

    if (!callUrl) return;

    const channel = supabase
      .channel(`sessions_changes_${callUrl}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `call_url=eq.${callUrl}`,
        },
        () => {
          fetchSessions(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callUrl, fetchSessions]);

  return { sessions, loading, error, refetch: fetchSessions };
};
