import { Router } from 'express';
import { mlbEngine } from '../services/engines/mlb-engine';

const router = Router();

// Health and metrics endpoints for fast triage
router.get('/metrics', (req, res) => {
  const metrics = (mlbEngine as any)?._metrics ?? null;
  res.json({ 
    engine: metrics, 
    time: new Date().toISOString(),
    armed: (mlbEngine as any)?._armed ?? false
  });
});

router.get('/state-sampler', (req, res) => {
  // For now, just return basic info
  res.json({ 
    info: "State sampling not implemented yet",
    time: new Date().toISOString() 
  });
});

export default router;