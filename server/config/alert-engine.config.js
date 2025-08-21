// Alert Engine Configuration
// This file controls which alert engine is active

export default {
  // Options: "legacy", "new", "both"
  // - legacy: Use existing alert system only (default)
  // - new: Use new startup-phase alert system only  
  // - both: Run both systems in shadow mode (new alerts logged but not sent)
  mode: process.env.ALERTS_ENGINE || "both"
};