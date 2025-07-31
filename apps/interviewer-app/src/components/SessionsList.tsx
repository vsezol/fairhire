import React from 'react';
import { useTranslation } from 'react-i18next';
import { Session } from '../services/supabase';
import { SessionCard } from './SessionCard';
import { AlertTriangleIcon } from './icons';

interface SessionsListProps {
  sessions: Session[];
  loading: boolean;
  error: string | null;
  isUpdating?: boolean;
  selectedSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
}

export const SessionsList: React.FC<SessionsListProps> = ({
  sessions,
  loading,
  error,
  isUpdating = false,
  selectedSessionId,
  onSessionSelect,
}) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <AlertTriangleIcon className="w-5 h-5" />
        <span>
          {t('sessions.error')}: {error}
        </span>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-base-content/60">
        <div className="text-lg">{t('sessions.noSessions')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t('sessions.title')}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            onClick={() => onSessionSelect(session.session_id)}
            isSelected={selectedSessionId === session.session_id}
          />
        ))}
      </div>
    </div>
  );
};
