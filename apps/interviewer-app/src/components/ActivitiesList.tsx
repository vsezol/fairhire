import React from 'react';
import { useTranslation } from 'react-i18next';
import { UserActivity } from '../services/supabase';
import { AlertTriangleIcon, EyeIcon, EyeOffIcon, FocusIcon } from './icons';

interface ActivitiesListProps {
  activities: UserActivity[];
  loading: boolean;
  error: string | null;
  isUpdating?: boolean;
}

export const ActivitiesList: React.FC<ActivitiesListProps> = ({
  activities,
  loading,
  error,
  isUpdating = false,
}) => {
  const { t } = useTranslation();

  const suspiciousEvents = ['app_blur', 'app_hide'];

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'app_focus':
        return <EyeIcon className="w-4 h-4" />;
      case 'app_blur':
        return <EyeOffIcon className="w-4 h-4" />;
      case 'app_show':
        return <EyeIcon className="w-4 h-4" />;
      case 'app_hide':
        return <EyeOffIcon className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp / 1000).toLocaleTimeString();
  };

  // Filter out mouse movement events
  const filteredActivities = activities.filter(
    (activity) =>
      activity.event_type !== 'mouse_move' &&
      activity.event_type !== 'page_navigate'
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
