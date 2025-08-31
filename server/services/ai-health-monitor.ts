
export const aiHealthMonitor = {
  getLivenessStatus() {
    return { 
      status: 'OK', 
      timestamp: Date.now(),
      uptime: process.uptime()
    };
  },

  getReadinessStatus() {
    return { 
      ready: true, 
      timestamp: Date.now(),
      services: {
        database: true,
        mlb_api: true
      }
    };
  },

  getDetailedMetrics() {
    return { 
      uptime: process.uptime(),
      averageLatency: 0,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    };
  },

  getHealthHistory() {
    return [];
  }
};
