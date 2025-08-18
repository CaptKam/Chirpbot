=====================================
CHIRPBOT V2 - COMPLETE APPLICATION
=====================================
Generated: August 18, 2025

This archive contains the complete ChirpBot V2 sports monitoring application.

CONTENTS:
---------
• client/         - React frontend with TypeScript
• server/         - Express.js backend API
• shared/         - Shared TypeScript schemas
• attached_assets/ - Documentation and assets
• Configuration files (package.json, vite.config.ts, etc.)

SETUP INSTRUCTIONS:
-------------------
1. Extract the archive:
   tar -xzf chirpbot-v2-complete.tar.gz

2. Install dependencies:
   npm install

3. Set up environment variables:
   Create a .env file with:
   - DATABASE_URL (PostgreSQL connection string)
   - OPENAI_API_KEY (for AI analysis)
   - SESSION_SECRET (for authentication)
   - TELEGRAM_BOT_TOKEN (optional, for notifications)
   - TELEGRAM_CHAT_ID (optional)

4. Set up database:
   npm run db:push

5. Start the application:
   npm run dev

FEATURES:
---------
• Real-time sports monitoring (MLB, NFL, NBA, NHL)
• AI-powered alert generation
• WebSocket live updates
• User authentication system
• Persistent game monitoring
• Modern responsive UI with ChirpBot V2 design system

TECHNOLOGY STACK:
-----------------
• Frontend: React, TypeScript, Tailwind CSS, Vite
• Backend: Node.js, Express, PostgreSQL
• ORM: Drizzle
• APIs: ESPN (sports data), OpenAI (analysis)
• Real-time: WebSocket

DESIGN SYSTEM:
--------------
• Colors: #F2F4F7 (bg), #1C2B5E (accent), #2387F4 (CTA), #F02D3A (alert)
• Typography: Inter font, bold uppercase headings
• UI: 12px rounded corners, shadow effects on hover

NOTES:
------
• node_modules not included (run npm install)
• Database needs to be provisioned separately
• API keys required for full functionality

=====================================