import React from 'react';
import { useTranslation } from 'react-i18next';
import { Session } from '../services/supabase';
import { ClockIcon, ActivityIcon } from './icons';

interface SessionCardProps {
  session: Session;
  onClick: () => void;
  isSelected?: boolean;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onClick,
  isSelected,
}) => {
  const { t } = useTranslation();

  const isActive =
    Date.now() - new Date(session.updated_at).getTime() < 1000 * 60 * 1;

  const formatDate = (updated_at: string) => {
    return new Date(updated_at).toLocaleString('ru-RU');
  };

  return (
    <div
      className={`card bg-base-200 cursor-pointer transition-all hover:bg-base-300 ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onClick}
    >
      <div className="card-body p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isActive ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-500 text-sm font-medium">
                  {t('sessions.active')}
                </span>
              </>
            ) : (
              <>
                <ClockIcon className="w-4 h-4 text-base-content/60" />
                <span className="text-base-content/60 text-sm">
                  {t('sessions.lastActive')}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm text-base-content/60">
            <ActivityIcon className="w-4 h-4" />
            {session.total_events}
          </div>
        </div>

        <div className="mt-2">
          <div className="text-sm text-base-content/80">
            {t('sessions.lastActiveDate')}: {formatDate(session.updated_at)}
          </div>
          <div className="text-sm text-base-content/80">
            {t('sessions.platform')}: {session.platform} •{' '}
            {t('sessions.version')}: {session.app_version}
          </div>
        </div>
      </div>
    </div>
  );
};
