# Overview

ChirpBot V2 is a fully functional modern sports alert application providing real-time notifications and AI-enhanced insights for sports events. Successfully deployed and tested on August 18, 2025, the application monitors sports teams across multiple leagues (MLB, NFL, NBA, NHL) using authentic ESPN API data and generates intelligent alerts for high-impact game situations like runners in scoring position, red zone opportunities, and clutch time scenarios. Built with a React frontend, Express backend, and PostgreSQL database, the app integrates with OpenAI for contextual analysis, weather services for environmental data, and includes Telegram notification capabilities. Features persistent team monitoring that saves user game selections to the database and restores them on page reload. Alert generation system now correctly filters for live games only, preventing alerts for non-active games. Fixed August 18, 2025.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite for build tooling
- **UI Library**: Shadcn/ui components built on Radix UI primitives for accessible, modern interfaces
- **Styling**: Tailwind CSS with custom ChirpBot theme variables and Inter font family
- **State Management**: TanStack Query for server state with WebSocket integration for real-time updates
- **Routing**: Wouter for lightweight client-side routing
- **Mobile-First Design**: Responsive design optimized for mobile devices with bottom navigation

## Backend Architecture
- **Runtime**: Node.js with Express.js RESTful API
- **Database ORM**: Drizzle ORM with PostgreSQL for type-safe database operations
- **Real-time Communication**: WebSocket server for live alert broadcasting to connected clients
- **Session Management**: Express sessions with PostgreSQL session store
- **Build System**: ESBuild for production bundling with TypeScript support

## Data Storage
- **Primary Database**: PostgreSQL with Drizzle ORM
- **Schema Design**: Five main entities - users, teams, alerts, settings, and user_monitored_teams
- **Persistent Monitoring**: User game selections saved to user_monitored_teams table for cross-session persistence
- **Session Storage**: PostgreSQL-backed session management using connect-pg-simple
- **Migration System**: Drizzle Kit for database schema migrations
- **Storage Classes**: DatabaseStorage for production, MemStorage fallback for testing

## Authentication & Authorization
- **Session-based Authentication**: Express sessions with secure cookie management
- **User Management**: Basic username/password authentication system
- **API Security**: Session-based request authorization for protected endpoints

## Real-time Features
- **WebSocket Integration**: Live alert broadcasting with automatic reconnection
- **Alert Processing**: Real-time sports event monitoring with AI analysis
- **Team Monitoring**: Dynamic enable/disable of team tracking with instant updates
- **Persistent Game Selection**: User game choices automatically saved to database and restored on page reload

# External Dependencies

## AI Services
- **OpenAI API**: GPT-4o integration for sports alert analysis and context generation
- **Confidence Scoring**: AI-powered confidence ratings for alert reliability

## Communication Services
- **Telegram Bot API**: Push notification delivery with rich formatting and markdown support
- **Connection Testing**: Built-in Telegram connectivity validation

## Weather Integration
- **OpenWeatherMap API**: Real-time weather data for outdoor sports venues
- **Fallback System**: Mock weather data when API keys are unavailable
- **Location-based Data**: City-specific weather conditions for game context

## Sports Data
- **ESPN API Integration**: Real-time sports data from ESPN's public API endpoints
- **Live Game Filtering**: Alert generation only occurs for games that are actually happening
- **Multi-sport Support**: MLB, NFL, NBA, NHL event types and monitoring
- **Game State Tracking**: Real-time game status and scoring updates from authentic sources

## Infrastructure Services
- **Neon Database**: PostgreSQL hosting with serverless architecture
- **Replit Platform**: Development and deployment environment with WebSocket support
- **CDN Integration**: Google Fonts for typography and external asset delivery