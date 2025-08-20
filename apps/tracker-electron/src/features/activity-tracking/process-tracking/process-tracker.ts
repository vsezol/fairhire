import {
  ProcessInfo,
  ProcessStartData,
  ProcessEndData,
  ProcessSnapshotData,
} from '../types.js';
import findProcessFn from 'find-process';

const findProcess = (findProcessFn as any).default as typeof findProcessFn;

import { suspiciousProcesses, systemProcessesPatterns } from './const.js';

export interface ProcessTrackerConfig {
  pollingInterval?: number;
  excludeSystemProcesses?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export class ProcessTracker {
  private isTracking = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastProcesses: Map<string, ProcessInfo> = new Map();
  private readonly config: Required<ProcessTrackerConfig>;

  constructor(
    config: ProcessTrackerConfig = {},
    private onProcessEvent: (event: {
      type: 'start' | 'end';
      data: ProcessStartData | ProcessEndData;
    }) => void,
    private onProcessSnapshot: (data: ProcessSnapshotData) => void
  ) {
    this.config = {
      pollingInterval: 5000,
      excludeSystemProcesses: true,
      includePatterns: [],
      excludePatterns: [...systemProcessesPatterns],
      ...config,
    };
  }

  public async startTracking(): Promise<void> {
    if (this.isTracking) {
      console.log('⚠️ Enhanced process tracking already active');
      return;
    }

    console.log('🎯 Starting enhanced process tracking...');
    this.isTracking = true;

    await this.takeProcessSnapshot();

    this.pollingInterval = setInterval(async () => {
      if (this.isTracking) {
        await this.checkProcessChanges();
        await this.takeProcessSnapshot();
      }
    }, this.config.pollingInterval);

    console.log(
      `✅ Enhanced process tracking started with ${this.config.pollingInterval}ms interval`
    );
  }

  public async stopTracking(): Promise<void> {
    if (!this.isTracking) return;

    console.log('🛑 Stopping enhanced process tracking...');
    this.isTracking = false;

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    this.lastProcesses.clear();
    console.log('✅ Enhanced process tracking stopped');
  }

  private async getProcesses(): Promise<ProcessInfo[]> {
    if (!findProcess) {
      throw new Error('find-process not available');
    }

    try {
      // Используем find-process для получения всех процессов
      const processes = await findProcess('name', '.*');

      return processes.map((proc: any) => ({
        name: proc.name || 'Unknown',
        cmd: proc.cmd || proc.name || 'Unknown',
        bin: proc.bin,
        isSuspicious: this.isSuspiciousProcess(
          proc.name,
          proc.cmd,
          proc.bin || ''
        ),
        isApplication: this.isApplicationProcess(
          proc.name,
          proc.cmd,
          proc.bin || ''
        ),
      }));
    } catch (error) {
      console.error('❌ find-process failed:', error);
      return [];
    }
  }

  private async takeProcessSnapshot(): Promise<void> {
    try {
      const processes = await this.getProcesses();

      const filteredProcesses = this.filterProcesses(processes).sort((a, b) => {
        const getPriority = (process: ProcessInfo): number => {
          return [process.isSuspicious, process.isApplication].reduce(
            (acc, curr) => acc + (curr ? 1 : 0),
            0
          );
        };

        return getPriority(b) - getPriority(a);
      });

      console.log('filteredProcesses', filteredProcesses);

      this.lastProcesses.clear();
      filteredProcesses.forEach((proc) => {
        this.lastProcesses.set(proc.name, proc);
      });

      this.onProcessSnapshot({
        processes: filteredProcesses,
      });

      console.log(
        `📸 Process snapshot: ${filteredProcesses.length} processes (filtered from ${processes.length})`
      );
    } catch (error) {
      console.error('❌ Failed to take process snapshot:', error);
    }
  }

  private async checkProcessChanges(): Promise<void> {
    try {
      const allProcesses = await this.getProcesses();
      const currentProcesses = this.filterProcesses(allProcesses);
      const currentProcessMap = new Map<string, ProcessInfo>();

      currentProcesses.forEach((proc) => {
        currentProcessMap.set(proc.name, proc);
      });

      const added: ProcessInfo[] = [];
      const removed: ProcessInfo[] = [];
      const modified: ProcessInfo[] = [];

      // Находим новые и измененные процессы
      for (const [name, process] of currentProcessMap) {
        if (!this.lastProcesses.has(name)) {
          added.push(process);

          // Отправляем событие о запуске
          this.onProcessEvent({
            type: 'start',
            data: {
              name: process.name,
              cmd: process.cmd,
              isSuspicious: process.isSuspicious,
              isApplication: process.isApplication,
            },
          });
        } else {
          const lastProcess = this.lastProcesses.get(name)!;

          if (this.hasProcessChanged(lastProcess, process)) {
            modified.push(process);
          }
        }
      }

      // Находим завершенные процессы
      for (const [name, process] of this.lastProcesses) {
        if (!currentProcessMap.has(name)) {
          removed.push(process);

          // Отправляем событие о завершении
          this.onProcessEvent({
            type: 'end',
            data: {
              name: process.name,
              cmd: process.cmd,
              isSuspicious: process.isSuspicious,
              isApplication: process.isApplication,
            },
          });
        }
      }

      this.lastProcesses = currentProcessMap;
    } catch (error) {
      console.error('❌ Failed to check process changes:', error);
    }
  }

  private hasProcessChanged(
    oldProcess: ProcessInfo,
    newProcess: ProcessInfo
  ): boolean {
    return (
      oldProcess.name !== newProcess.name || oldProcess.cmd !== newProcess.cmd
    );
  }

  private filterProcesses(processes: ProcessInfo[]): ProcessInfo[] {
    const filteredProcesses = processes.filter((process) => {
      if (this.config.excludeSystemProcesses) {
        const isSystemProcess = this.config.excludePatterns.some(
          (pattern) =>
            process.name.toLowerCase().includes(pattern.toLowerCase()) ||
            process.cmd.toLowerCase().includes(pattern.toLowerCase())
        );
        if (isSystemProcess) return false;
      }

      if (this.config.includePatterns.length > 0) {
        const isIncluded = this.config.includePatterns.some(
          (pattern) =>
            process.name.toLowerCase().includes(pattern.toLowerCase()) ||
            process.cmd.toLowerCase().includes(pattern.toLowerCase())
        );
        if (!isIncluded) return false;
      }

      return process.isApplication || process.isSuspicious;
    });

    const uniqueProcesses = new Map<string, ProcessInfo>();

    filteredProcesses.forEach((process) => {
      uniqueProcesses.set(process.name, process);
    });

    return Array.from(uniqueProcesses.values());
  }

  private isSuspiciousProcess(name: string, cmd: string, bin: string): boolean {
    return suspiciousProcesses.some((pattern) => {
      if (pattern.length > 3) {
        return (
          name.toLowerCase().includes(pattern) ||
          cmd.toLowerCase().includes(pattern) ||
          bin?.toLowerCase().includes(pattern)
        );
      }

      return (
        name.toLowerCase() === pattern ||
        cmd.toLowerCase() === pattern ||
        bin?.toLowerCase() === pattern
      );
    });
  }

  private isApplicationProcess(
    name: string,
    cmd: string,
    bin: string
  ): boolean {
    const processName = name.toLowerCase();
    const processCmd = cmd.toLowerCase();
    const processBin = bin?.toLowerCase() || '';

    if (process.platform === 'darwin' && processCmd.includes('.app/')) {
      return true;
    }

    if (processBin?.includes('/Applications/')) {
      return true;
    }

    if (processBin?.includes('Program Files')) {
      return true;
    }

    if (
      processName.endsWith('.exe') &&
      (processBin?.includes('Users\\') || processBin?.includes('AppData\\'))
    ) {
      return true;
    }

    return false;
  }
}
