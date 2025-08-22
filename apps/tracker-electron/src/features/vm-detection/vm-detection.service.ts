import * as si from 'systeminformation';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execAsync = promisify(exec);

export interface SystemResourceInfo {
  diskSpaceGB: number;
  ramGB: number;
  cpuCores: number;
}

export interface VMDetectionResult {
  isVirtual: boolean;
  virtualHost?: string;
  detectionMethod: 'systeminformation' | 'system-command' | 'unknown';
  error?: string;
  systemResources?: SystemResourceInfo;
}

export class VMDetectionService {
  private static instance: VMDetectionService;

  public static getInstance(): VMDetectionService {
    if (!VMDetectionService.instance) {
      VMDetectionService.instance = new VMDetectionService();
    }
    return VMDetectionService.instance;
  }

  public async detectVM(): Promise<VMDetectionResult> {
    let vmResult: VMDetectionResult;

    try {
      vmResult = await this.detectVMWithSystemInformation();
      if (vmResult.detectionMethod === 'unknown') {
        vmResult = await this.detectVMWithSystemCommands();
      }
    } catch (error) {
      console.warn(
        'VM Detection: systeminformation failed, trying fallback methods',
        error
      );

      try {
        vmResult = await this.detectVMWithSystemCommands();
      } catch (fallbackError) {
        console.error('VM Detection: All methods failed', fallbackError);
        vmResult = {
          isVirtual: false,
          detectionMethod: 'unknown',
          error:
            fallbackError instanceof Error
              ? fallbackError.message
              : 'Unknown error',
        };
      }
    }

    // Add system resource detection
    try {
      const resourceInfo = await this.getSystemResources();

      vmResult.systemResources = resourceInfo;
    } catch (error) {
      console.warn('Failed to detect system resources', error);
    }

    return vmResult;
  }

  private async getSystemResources(): Promise<SystemResourceInfo> {
    try {
      const [memInfo, diskInfo, cpuInfo] = await Promise.all([
        si.mem(),
        si.diskLayout(),
        si.cpu(),
      ]);

      // Convert memory from bytes to GB
      const ramGB = Math.round((memInfo.total / 1024 ** 3) * 100) / 100;

      // Get total disk space across all drives in GB
      const totalDiskSpaceBytes = diskInfo.reduce(
        (total, disk) => total + disk.size,
        0
      );

      console.log('totalDiskSpaceBytes', totalDiskSpaceBytes);

      const diskSpaceGB =
        Math.round((totalDiskSpaceBytes / 1024 ** 3) * 100) / 100;

      // Get CPU core count
      const cpuCores = cpuInfo.cores;

      return {
        diskSpaceGB,
        ramGB,
        cpuCores,
      };
    } catch (error) {
      throw new Error(
        `Failed to get system resources: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  private async detectVMWithSystemInformation(): Promise<VMDetectionResult> {
    try {
      const systemData = await si.system();

      if (systemData.virtual !== undefined && systemData.virtual !== null) {
        return {
          isVirtual: systemData.virtual,
          virtualHost: systemData.virtualHost || undefined,
          detectionMethod: 'systeminformation',
        };
      }

      let isVirtual = false;
      let virtualHost = undefined;

      const allData = await si.getStaticData();

      const stringData = JSON.stringify({
        version: allData.version,
        system: allData.system,
        bios: allData.bios,
        baseboard: allData.baseboard,
        chassis: allData.chassis,
        os: allData.os,
        uuid: allData.uuid,
        cpu: allData.cpu,
        graphics: allData.graphics,
        net: allData.net,
        memLayout: allData.memLayout,
        diskLayout: allData.diskLayout,
      });

      if (stringData.includes('virtualbox"') || stringData.includes('vbox')) {
        isVirtual = true;
        virtualHost = 'VirtualBox';
      } else if (stringData.includes('vmware')) {
        isVirtual = true;
        virtualHost = 'VMware';
      } else if (stringData.includes('hyperv')) {
        isVirtual = true;
        virtualHost = 'Hyper-V';
      } else if (stringData.includes('kvm')) {
        isVirtual = true;
        virtualHost = 'KVM';
      } else if (stringData.includes('qemu')) {
        isVirtual = true;
        virtualHost = 'QEMU';
      }

      return {
        isVirtual: isVirtual || false,
        virtualHost: virtualHost || undefined,
        detectionMethod: isVirtual ? 'systeminformation' : 'unknown',
      };
    } catch (error) {
      throw new Error(
        `systeminformation detection failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  private async detectVMWithSystemCommands(): Promise<VMDetectionResult> {
    const platform = os.platform();

    try {
      if (platform === 'linux') {
        return await this.detectVMLinux();
      } else if (platform === 'win32') {
        return await this.detectVMWindows();
      } else if (platform === 'darwin') {
        return await this.detectVMMacOS();
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      throw new Error(
        `System command detection failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  private async detectVMLinux(): Promise<VMDetectionResult> {
    try {
      const { stdout } = await execAsync('systemd-detect-virt');
      const virtType = stdout.trim();

      return {
        isVirtual: virtType !== 'none',
        virtualHost: virtType !== 'none' ? virtType : undefined,
        detectionMethod: 'system-command',
      };
    } catch (error) {
      throw new Error(
        `Linux VM detection failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  private async detectVMWindows(): Promise<VMDetectionResult> {
    try {
      const { stdout } = await execAsync(
        'systeminfo | findstr /C:"System Model"'
      );
      const isVirtual = stdout.toLowerCase().includes('virtual');

      return {
        isVirtual,
        virtualHost: isVirtual ? 'Windows Virtual Machine' : undefined,
        detectionMethod: 'system-command',
      };
    } catch (error) {
      throw new Error(
        `Windows VM detection failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  private async detectVMMacOS(): Promise<VMDetectionResult> {
    try {
      const { stdout } = await execAsync(
        'system_profiler SPHardwareDataType | grep -i "Model Name"'
      );
      const isVirtual = stdout.toLowerCase().includes('virtual');

      return {
        isVirtual,
        virtualHost: isVirtual ? 'macOS Virtual Machine' : undefined,
        detectionMethod: 'system-command',
      };
    } catch (error) {
      throw new Error(
        `macOS VM detection failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
}
