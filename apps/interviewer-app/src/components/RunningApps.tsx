import React from 'react';
import { useTranslation } from 'react-i18next';
import { ProcessInfo } from '../services/supabase';
import { AlertTriangleIcon } from './icons';

interface RunningAppsProps {
  processes: ProcessInfo[];
}

export const RunningApps: React.FC<RunningAppsProps> = ({ processes }) => {
  return (
    <div>
      <RunningAppsHeader runningApps={processes} showError={false} />

      <div>
        <RunningAppsContent
          runningApps={processes}
          loading={false}
          error={null}
        />
      </div>
    </div>
  );
};

interface RunningAppsHeaderProps {
  runningApps: ProcessInfo[];
  showError: boolean;
}

const RunningAppsHeader: React.FC<RunningAppsHeaderProps> = ({
  runningApps,
  showError,
}) => {
  const { t } = useTranslation();
  const hasSuspiciousApps = runningApps.some((app) => app.isSuspicious);

  return (
    <div className="flex items-center justify-between mb-3 pr-2">
      <h3 className="text-lg font-semibold">{t('runningApps.title')}</h3>
      {!showError && (
        <div className="flex items-center gap-2">
          {hasSuspiciousApps && (
            <div className="flex items-center gap-1 text-warning">
              <AlertTriangleIcon className="w-4 h-4" />
              <span className="text-xs">
                {t('runningApps.suspiciousDetected')}
              </span>
            </div>
          )}
          <span className="text-sm text-base-content/60">
            {t('runningApps.total')} {runningApps.length}{' '}
            {t('runningApps.appsCount')}
          </span>
        </div>
      )}
    </div>
  );
};

interface RunningAppsContentProps {
  runningApps: ProcessInfo[];
  loading: boolean;
  error: string | null;
}

const RunningAppsContent: React.FC<RunningAppsContentProps> = ({
  runningApps,
  loading,
  error,
}) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex justify-center items-center max-h-32">
        <span className="loading loading-spinner loading-md"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <AlertTriangleIcon className="w-5 h-5" />
        <span className="text-sm">
          {t('runningApps.errorLoading')}: {error}
        </span>
      </div>
    );
  }

  if (runningApps.length === 0) {
    return (
      <div className="flex justify-center items-center max-h-32 text-base-content/60">
        <span className="text-sm">{t('runningApps.noApplications')}</span>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto max-h-32 pr-2 running-apps-grid">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
        {runningApps.map((app, index) => (
          <AppCard key={`${app.name}-${index}`} app={app} />
        ))}
      </div>
    </div>
  );
};

interface AppCardProps {
  app: ProcessInfo;
}

const AppCard: React.FC<AppCardProps> = ({ app }) => {
  const getAppDisplayName = (appName: string) => {
    // Убираем расширения и путь, оставляем только имя
    return (
      appName
        .split('/')
        .pop() // Убираем путь
        ?.split('\\')
        .pop() // Убираем путь Windows
        ?.replace(/\.(exe|app|dmg|pkg)$/i, '') || // Убираем расширения
      appName
    );
  };

  return (
    <div
      className={`
        flex items-center justify-center p-2 rounded-lg text-center transition-all relative
        ${
          app.isSuspicious
            ? 'bg-warning/10 border border-warning/20 hover:bg-warning/15'
            : 'bg-base-300 hover:bg-base-300/80'
        }
      `}
      title={app.name}
    >
      <div className="text-sm text-base-content/80 truncate w-full leading-tight px-1">
        {getAppDisplayName(app.name)}
      </div>
    </div>
  );
};
