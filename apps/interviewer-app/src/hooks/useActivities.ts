import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, UserActivity } from '../services/supabase';

export const useActivities = (sessionId: string | null) => {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const lastTimestampRef = useRef<number>(0);

  const fetchAllActivities = useCallback(
    async (showLoader = true) => {
      if (!sessionId) {
        setActivities([]);
        lastTimestampRef.current = 0;
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
          .from('user_activities')
          .select('*')
          .eq('session_id', sessionId)
          .order('timestamp', { ascending: true });

        if (error) throw error;

        const newActivities = data || [];
        setActivities(newActivities);

        // Update last timestamp
        if (newActivities.length > 0) {
          lastTimestampRef.current = Math.max(
            ...newActivities.map((a) => a.timestamp)
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
        setIsUpdating(false);
      }
    },
    [sessionId]
  );

  const fetchNewActivities = useCallback(async () => {
    if (!sessionId || lastTimestampRef.current === 0) return;

    setIsUpdating(true);

    try {
      const { data, error } = await supabase
        .from('user_activities')
        .select('*')
        .eq('session_id', sessionId)
        .gt('timestamp', lastTimestampRef.current)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      const newActivities = data || [];
      if (newActivities.length > 0) {
        setActivities((prev) => [...prev, ...newActivities]);
        lastTimestampRef.current = Math.max(
          ...newActivities.map((a) => a.timestamp)
        );
      }
    } catch (err) {
      console.error('Error fetching new activities:', err);
    } finally {
      setIsUpdating(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchAllActivities(true);

    if (!sessionId) return;

    // Set up interval for periodic updates every 5 seconds
    const intervalId = setInterval(() => {
      fetchNewActivities();
    }, 5000);

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
            // Check if activity already exists to avoid duplicates
            const exists = prev.some((a) => a.id === newActivity.id);
            if (!exists) {
              lastTimestampRef.current = Math.max(
                lastTimestampRef.current,
                newActivity.timestamp
              );
              return [...prev, newActivity];
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchAllActivities, fetchNewActivities]);

  return {
    activities,
    loading,
    error,
    isUpdating,
    refetch: fetchAllActivities,
  };
};
