
# ChirpBot AI - OpenAI Review Package

## For OpenAI Reviewers

This is a complete, production-ready sports alert and analysis platform that demonstrates sophisticated integration with OpenAI's API services.

### Key OpenAI Integration Points

1. **Sports Analysis Engine** (`server/services/engines/OpenAiEngine.ts`)
   - Real-time game situation analysis
   - Player performance insights using GPT-4o-mini
   - Contextual sports commentary generation

2. **Betting Intelligence** (`server/services/engines/betbook-engine.ts`)
   - Live betting opportunity analysis using GPT-5
   - Value bet identification and risk assessment
   - Real-time market context generation

3. **Health Monitoring** (`server/services/ai-health-monitor.ts`)
   - Continuous AI service health tracking
   - Performance metrics and latency monitoring
   - Automatic degraded mode with fallbacks

### Quick Demo Setup

1. **Install**: `npm install`
2. **Configure**: Copy `.env.example` to `.env` and add your OpenAI API key
3. **Setup DB**: `npm run db:push`
4. **Run**: `npm run dev`
5. **Access**: http://localhost:5000 (demo/demo123)

### OpenAI API Usage Stats

- **Primary Model**: gpt-4o-mini for sports analysis
- **Advanced Model**: gpt-5 for betting insights
- **Rate Limiting**: 30-second intervals in production
- **Token Management**: 500 tokens for analysis, 50 for betting
- **Health Checks**: Lightweight 5-token calls every 30 seconds
- **Fallback System**: Graceful degradation when API unavailable

### Review Focus Areas

1. **Responsible AI Usage**: Rate limiting, error handling, fallbacks
2. **Token Efficiency**: Optimized prompts with strict token limits
3. **Health Monitoring**: Comprehensive AI service monitoring
4. **Production Ready**: Full error handling and graceful degradation
5. **Real-time Integration**: WebSocket-based live alert system

### Database Auto-Setup
- Creates demo user automatically
- Seeds 25+ master alert controls
- Configures AI settings for all sports
- No manual database setup required

The application is designed for immediate evaluation with minimal setup requirements.
