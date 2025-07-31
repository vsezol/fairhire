import { useState, useEffect, useCallback } from 'react';
import { supabase, Session } from '../services/supabase';

export const useSessions = (callUrl: string | null) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchSessions = useCallback(
    async (showLoader = true) => {
      if (!callUrl) {
        setSessions([]);
        return;
      }

      if (showLoader) {
        setLoading(true);
      } else {
        setIsUpdating(true);
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
        setLoading(false);
        setIsUpdating(false);
      }
    },
    [callUrl]
  );

  useEffect(() => {
    fetchSessions(true);

    if (!callUrl) return;

    // Set up interval for periodic updates every 5 seconds
    const intervalId = setInterval(() => {
      fetchSessions(false);
    }, 5000);

    // Set up real-time updates via Supabase
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
          fetchSessions(false);
        }
      )
      .subscribe();

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [callUrl, fetchSessions]);

  return { sessions, loading, error, isUpdating, refetch: fetchSessions };
};
