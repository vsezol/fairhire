import React from 'react';
import { useTranslation } from 'react-i18next';
import { UserActivity } from '../services/supabase';
import { AlertTriangleIcon, EyeIcon, EyeOffIcon } from './icons';

interface ActivitiesListProps {
  activities: UserActivity[];
  loading: boolean;
  error: string | null;
}

export const ActivitiesList: React.FC<ActivitiesListProps> = ({
  activities,
  loading,
  error,
}) => {
  const { t } = useTranslation();

  const suspiciousEvents = ['app_blur', 'app_hide', 'app_close'];

  const getEventIcon = (eventType: string) => {
    return null;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Filter out mouse movement events
  const filteredActivities = activities.filter((activity) =>
    [
      'app_focus',
      'app_blur',
      'app_hide',
      'app_show',
      'app_open',
      'app_close',
    ].includes(activity.event_type)
  );

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <span className="loading loading-spinner loading-md"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <AlertTriangleIcon className="w-5 h-5" />
        <span>Error loading activities: {error}</span>
      </div>
    );
  }

  if (filteredActivities.length === 0) {
    return (
      <div className="text-center py-4 text-base-content/60">
        {t('activities.noActivities')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('activities.title')}</h3>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredActivities.map((activity) => {
          const isSuspicious = suspiciousEvents.includes(activity.event_type);

          return (
            <div
              key={activity.id}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                isSuspicious
                  ? 'bg-warning/10 border border-warning/20'
                  : 'bg-base-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  {getEventIcon(activity.event_type)}
                  {isSuspicious && (
                    <AlertTriangleIcon className="w-4 h-4 text-warning" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">
                    {t(`activities.events.${activity.event_type}`) ||
                      activity.event_type}
                  </div>
                </div>
              </div>
              <div className="text-xs text-base-content/60 whitespace-nowrap">
                {formatTimestamp(activity.timestamp)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
