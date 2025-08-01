import { useState, useEffect, useCallback } from 'react';
import { supabase, UserActivity } from '../services/supabase';

export const useActivities = (sessionId: string | null) => {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllActivities = useCallback(async () => {
    if (!sessionId) {
      setActivities([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newActivities = await getSessionActivities(sessionId);

      setActivities(newActivities);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchAllActivities();

    if (!sessionId) return;

    // Set up real-time updates for new activities via Supabase
    const channel = supabase
      .channel(`activities_changes_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_activities',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newActivity = payload.new as UserActivity;

          setActivities((prev) => {
            const exists = prev.some((a) => a.id === newActivity.id);

            if (!exists) {
              return [...prev, newActivity];
            }

            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchAllActivities]);

  return {
    activities,
    loading,
    error,
  };
};

async function getSessionActivities(
  sessionId: string
): Promise<UserActivity[]> {
  const { data, error } = await supabase
    .from('user_activities')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true });

  if (error) throw error;

  return data || [];
}
