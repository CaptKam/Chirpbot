/**
 * COMPATIBILITY SHIM FOR DemoAlertGenerator
 * 
 * This class now wraps UnifiedAlertGenerator in demo mode
 * to maintain backward compatibility with existing usage.
 * 
 * All functionality has been moved to UnifiedAlertGenerator.
 */

import { UnifiedAlertGenerator } from './unified-alert-generator';

/**
 * COMPATIBILITY SHIM CLASS
 * 
 * DemoAlertGenerator now wraps UnifiedAlertGenerator in demo mode.
 * This maintains backward compatibility with existing code.
 */
export class DemoAlertGenerator {
  private unifiedGenerator: UnifiedAlertGenerator;

  constructor(demoUserId: string) {
    this.unifiedGenerator = new UnifiedAlertGenerator({
      mode: 'demo',
      demoUserId,
      logLevel: 'verbose'
    });
  }

  async generateAllDemoAlerts(): Promise<void> {
    return this.unifiedGenerator.generateAllDemoAlerts();
  }

  getStats(): any {
    return this.unifiedGenerator.getStats();
  }

  getMode(): 'production' | 'demo' {
    return this.unifiedGenerator.getMode();
  }
}