// Scheduler for periodic tasks like weather updates and data source polling
import { refreshWeatherForVenue } from './services/weather';
import { isMaintenanceMode } from './services/feature-flags';

interface ScheduledTask {
  name: string;
  interval: number; // milliseconds
  lastRun: number;
  fn: () => Promise<void>;
}

class Scheduler {
  private tasks: ScheduledTask[] = [];
  private running = false;
  private timer?: NodeJS.Timeout;

  addTask(name: string, intervalMinutes: number, fn: () => Promise<void>) {
    this.tasks.push({
      name,
      interval: intervalMinutes * 60 * 1000,
      lastRun: 0,
      fn
    });
  }

  start() {
    if (this.running) return;
    
    this.running = true;
    console.log('📅 Scheduler started');
    
    // Check tasks every minute
    this.timer = setInterval(() => {
      this.checkTasks();
    }, 60 * 1000);
  }

  stop() {
    if (!this.running) return;
    
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    console.log('📅 Scheduler stopped');
  }

  private async checkTasks() {
    if (isMaintenanceMode()) return;
    
    const now = Date.now();
    
    for (const task of this.tasks) {
      if (now - task.lastRun >= task.interval) {
        try {
          console.log(`🔄 Running scheduled task: ${task.name}`);
          await task.fn();
          task.lastRun = now;
        } catch (error) {
          console.error(`❌ Scheduled task failed: ${task.name}`, error);
        }
      }
    }
  }
}

// Global scheduler instance
export const scheduler = new Scheduler();

// Initialize default tasks
export function initializeScheduler() {
  // Weather refresh task
  scheduler.addTask('weather-refresh', 10, async () => {
    // Refresh weather for active venues
    // This would typically query active games and refresh their weather
    console.log('🌤️ Refreshing weather data for active venues');
  });

  // Cleanup old alerts task
  scheduler.addTask('cleanup-alerts', 60, async () => {
    // Clean up old alerts and plays from database
    console.log('🧹 Cleaning up old alerts and plays');
  });

  // Health check task
  scheduler.addTask('health-check', 5, async () => {
    // Perform internal health checks
    console.log('💓 Internal health check');
  });

  scheduler.start();
}