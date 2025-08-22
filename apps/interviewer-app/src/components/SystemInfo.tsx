import React from 'react';
import { useTranslation } from 'react-i18next';
import { SystemResourceInfo } from '../services/supabase';
import {
  AlertTriangleIcon,
  MonitorIcon,
  CpuIcon,
  HardDriveIcon,
  MemoryStickIcon,
} from './icons';

interface SystemInfoProps {
  systemResources?: SystemResourceInfo;
  displayCount?: number;
  isVirtual?: boolean;
  virtualHost?: string;
}

export const SystemInfo: React.FC<SystemInfoProps> = ({
  systemResources,
  displayCount = 1,
  isVirtual = false,
  virtualHost,
}) => {
  const { t } = useTranslation();

  // Check for suspicious parameters
  const isSuspiciousRAM = systemResources && systemResources.ramGB <= 2;
  const isSuspiciousDisk =
    systemResources && systemResources.diskSpaceGB <= 100;
  const isSuspiciousCores = systemResources && systemResources.cpuCores <= 3;
  const isSuspiciousMonitors = displayCount >= 2;

  const hasSuspiciousSpecs =
    isSuspiciousRAM ||
    isSuspiciousDisk ||
    isSuspiciousCores ||
    isSuspiciousMonitors;

  if (!systemResources) {
    return (
      <div className="mb-8">
        <SystemInfoHeader showError={true} />
        <div className="alert alert-warning">
          <AlertTriangleIcon className="w-5 h-5" />
          <span className="text-sm">{t('systemInfo.noData')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <SystemInfoHeader
        hasSuspiciousSpecs={hasSuspiciousSpecs}
        showError={false}
      />

      {/* Virtual Machine Info */}
      {isVirtual && (
        <div className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangleIcon className="w-4 h-4" />
            <span className="text-sm font-medium">
              {t('systemInfo.virtualMachine')}:{' '}
              {virtualHost || t('systemInfo.unknown')}
            </span>
          </div>
        </div>
      )}

      {/* System Resources Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* RAM */}
        <SystemResourceCard
          icon={<MemoryStickIcon className="w-5 h-5" />}
          label={t('systemInfo.ram')}
          value={`${systemResources.ramGB} GB`}
          isSuspicious={isSuspiciousRAM}
        />

        {/* Disk Space */}
        <SystemResourceCard
          icon={<HardDriveIcon className="w-5 h-5" />}
          label={t('systemInfo.disk')}
          value={`${systemResources.diskSpaceGB} GB`}
          isSuspicious={isSuspiciousDisk}
        />

        {/* CPU Cores */}
        <SystemResourceCard
          icon={<CpuIcon className="w-5 h-5" />}
          label={t('systemInfo.cores')}
          value={`${systemResources.cpuCores} ${t('systemInfo.coresUnit')}`}
          isSuspicious={isSuspiciousCores}
        />

        {/* Monitors */}
        <SystemResourceCard
          icon={<MonitorIcon className="w-5 h-5" />}
          label={t('systemInfo.monitors')}
          value={`${displayCount} ${t('systemInfo.monitorsUnit')}`}
          isSuspicious={isSuspiciousMonitors}
        />
      </div>
    </div>
  );
};

interface SystemInfoHeaderProps {
  hasSuspiciousSpecs?: boolean;
  showError: boolean;
}

const SystemInfoHeader: React.FC<SystemInfoHeaderProps> = ({
  hasSuspiciousSpecs = false,
  showError,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between mb-3 pr-2">
      <h3 className="text-lg font-semibold">{t('systemInfo.title')}</h3>
      {!showError && hasSuspiciousSpecs && (
        <div className="flex items-center gap-1 text-warning">
          <AlertTriangleIcon className="w-4 h-4" />
          <span className="text-xs">{t('systemInfo.suspiciousDetected')}</span>
        </div>
      )}
    </div>
  );
};

interface SystemResourceCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  isSuspicious?: boolean;
  suspiciousText?: string;
}

const SystemResourceCard: React.FC<SystemResourceCardProps> = ({
  icon,
  label,
  value,
  isSuspicious = false,
  suspiciousText,
}) => {
  return (
    <div
      className={`p-3 rounded-lg border ${
        isSuspicious
          ? 'bg-warning/10 border-warning/30'
          : 'bg-base-200 border-base-300'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-lg font-bold mb-1">{value}</div>
      {isSuspicious && suspiciousText && (
        <div className="text-xs opacity-80">{suspiciousText}</div>
      )}
    </div>
  );
};
