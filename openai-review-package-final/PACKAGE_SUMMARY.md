# ChirpBot V2 - Package Summary for OpenAI Review

## Quick Overview
Production-ready sports betting alert application with real OpenAI integration, 4-tier alert system, and actionable betting insights.

## Key Files to Review

### 🎯 Core Engine (V3 Production)
- `server/services/engines/mlb-engine-v3.ts` - Main V3 engine with 4-tier system
- `server/services/ai-health-monitor.ts` - OpenAI GPT-4o integration monitor
- `server/services/alert-deduper.ts` - Advanced deduplication system

### 🖥️ User Interface  
- `client/src/pages/alerts.tsx` - Main alert feed with actionable betting advice
- `client/src/components/SwipeableCard.tsx` - Advanced betting insights panel
- `client/src/adapters/mlb.tsx` - Data transformation layer

### 📊 Data & Architecture
- `shared/schema.ts` - Complete database schema (Drizzle ORM)
- `replit.md` - Full architecture documentation
- `server/index.ts` - Main application server

## Live Demo Features
✅ Real-time Yankees vs White Sox monitoring  
✅ Actual OpenAI API calls generating insights  
✅ V3 4-tier alert system operational  
✅ Advanced deduplication preventing spam  

## Technology Stack
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + PostgreSQL  
- **AI**: OpenAI GPT-4o (production API)
- **Data**: Official MLB API + Weather integration
- **Real-time**: WebSocket implementation

## Current Status: ✅ PRODUCTION READY