import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  isKeyDownActivity,
  KeyDownEventData,
  UserActivity,
} from '../services/supabase';
import { AlertTriangleIcon } from './icons';

interface ActivitiesListProps {
  activities: UserActivity[];
  loading: boolean;
  error: string | null;
  platform: string;
}

export const ActivitiesList: React.FC<ActivitiesListProps> = ({
  activities,
  loading,
  error,
  platform,
}) => {
  const { t } = useTranslation();

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
      'key_down',
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
          return (
            <div
              key={activity.id}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                isSuspiciousEvent(activity, platform)
                  ? 'bg-warning/10 border border-warning/20'
                  : 'bg-base-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  {getEventIcon(activity.event_type)}
                  {isSuspiciousEvent(activity, platform) && (
                    <AlertTriangleIcon className="w-4 h-4 text-warning" />
                  )}
                </div>
                <ActivityText activity={activity} platform={platform} />
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

function ActivityText({
  activity,
  platform,
}: {
  activity: UserActivity;
  platform: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="min-w-0 flex-1">
      <div className="font-medium text-sm">
        {!isKeyDownActivity(activity) ? (
          t(`activities.events.${activity.event_type}`)
        ) : (
          <div className="flex items-center gap-1">
            {formatKeyboardShortcut(activity.event_data, platform).map(
              (key, index, array) => (
                <React.Fragment key={index}>
                  <kbd className="kbd kbd-sm">{key}</kbd>
                  {index < array.length - 1 && (
                    <span className="text-base-content/60">+</span>
                  )}
                </React.Fragment>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatKeyboardShortcut(eventData: KeyDownEventData, platform: string) {
  const parts: string[] = [];

  if (eventData.ctrl) parts.push('Ctrl');
  if (eventData.alt) parts.push('Alt');
  if (eventData.shift) parts.push('Shift');
  if (eventData.meta) {
    parts.push(platform === 'darwin' ? 'Cmd' : 'Win');
  }

  if (eventData.code && eventData.code !== ' ') {
    parts.push(
      eventData.code === ' '
        ? 'Space'
        : eventData.code
            .replace('Key', '')
            .replace('Digit', '')
            .replace('ArrowLeft', '◀︎')
            .replace('ArrowRight', '▶︎')
            .replace('ArrowDown', '▼')
            .replace('ArrowUp', '▲')
            .replace('Numpad', '')
    );
  }

  return parts;
}

const suspiciousEvents = ['app_blur', 'app_hide', 'app_close'];

function isSuspiciousEvent(event: UserActivity, platform: string) {
  if (suspiciousEvents.includes(event.event_type)) {
    return true;
  }

  if (isKeyDownActivity(event)) {
    return (
      isCopyCombination(event.event_data, platform) ||
      isPasteCombination(event.event_data, platform) ||
      false
    );
  }

  return false;
}

function isCopyCombination(event: KeyDownEventData, platform: string) {
  if (platform === 'darwin') {
    return event.meta && event.code === 'KeyC';
  }

  return event.ctrl && event.code === 'KeyC';
}

function isPasteCombination(event: KeyDownEventData, platform: string) {
  if (platform === 'darwin') {
    return event.meta && event.code === 'KeyV';
  }

  return event.ctrl && event.code === 'KeyV';
}
