/**
 * COMPATIBILITY SHIM FOR AlertGenerator
 * 
 * This class now wraps UnifiedAlertGenerator in production mode
 * to maintain backward compatibility with existing routes.ts usage.
 * 
 * All functionality has been moved to UnifiedAlertGenerator.
 */

import { UnifiedAlertGenerator } from './unified-alert-generator';

/**
 * COMPATIBILITY SHIM CLASS
 * 
 * AlertGenerator now wraps UnifiedAlertGenerator in production mode.
 * This maintains backward compatibility with existing code.
 */
export class AlertGenerator {
  private unifiedGenerator: UnifiedAlertGenerator;

  constructor() {
    this.unifiedGenerator = new UnifiedAlertGenerator({
      mode: 'production',
      logLevel: 'verbose'
    });
  }

  async generateLiveGameAlerts(): Promise<number> {
    return this.unifiedGenerator.generateLiveGameAlerts();
  }

  async isAlertGloballyEnabled(sport: string, alertType: string): Promise<boolean> {
    return this.unifiedGenerator.isAlertGloballyEnabled(sport, alertType);
  }

  async startMonitoring(): Promise<void> {
    return this.unifiedGenerator.startMonitoring();
  }

  async stopMonitoring(): Promise<void> {
    return this.unifiedGenerator.stopMonitoring();
  }

  getStats(): any {
    return this.unifiedGenerator.getStats();
  }

  getPerformanceMetrics(): any {
    return this.unifiedGenerator.getPerformanceMetrics();
  }

  getMode(): 'production' | 'demo' {
    return this.unifiedGenerator.getMode();
  }
}