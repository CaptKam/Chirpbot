# Sports App Framework

A clean, modern sports application framework with authentication and professional design system.

## Features

- ✅ **Modern Design System** - Professional sports-themed UI with Inter font
- ✅ **User Authentication** - Complete login/register system with sessions  
- ✅ **Database Ready** - PostgreSQL with Drizzle ORM
- ✅ **Responsive Design** - Mobile-first responsive layout
- ✅ **TypeScript** - Full type safety throughout the stack
- ✅ **React + Vite** - Fast development with hot reload
- ✅ **TailwindCSS** - Utility-first styling with custom sports theme

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   # Create .env file
   DATABASE_URL="your-postgresql-url"
   SESSION_SECRET="your-session-secret"
   ```

3. **Push database schema:**
   ```bash
   npm run db:push
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to `http://localhost:5000`

## Project Structure

```
├── client/                 # Frontend React app
│   ├── src/
│   │   ├── components/ui/  # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utilities and API client
│   │   └── main.tsx       # App entry point
│   └── index.html         # HTML template
├── server/                # Backend Express app
│   ├── routes.ts         # API routes
│   ├── storage.ts        # Database interface
│   ├── db.ts             # Database connection
│   └── index.ts          # Server entry point
├── shared/                # Shared code
│   └── schema.ts         # Database schema & types
└── package.json          # Dependencies and scripts
```

## Design System

The framework includes a professional sports-themed design system:

- **Colors:** 
  - Primary: #1C2B5E (Navy)
  - Secondary: #2387F4 (Blue)
  - Accent: #F02D3A (Red)
  - Background: #F2F4F7 (Light Gray)

- **Typography:** Inter font with bold uppercase headings
- **Components:** 12px rounded corners, shadow effects on hover
- **Mobile-first:** Responsive design optimized for all devices

## Customization

### Adding New Pages
1. Create component in `client/src/pages/`
2. Add route in `client/src/App.tsx`

### Extending Database
1. Update schema in `shared/schema.ts`
2. Run `npm run db:push` to sync changes

### Adding API Endpoints
1. Add routes to `server/routes.ts`
2. Update storage interface if needed

### Styling
- Modify colors in `tailwind.config.ts`
- Update CSS variables in `client/src/index.css`
- Use existing UI components in `client/src/components/ui/`

## Built-in Authentication

The framework includes complete user authentication:

- **Registration** - Create new accounts
- **Login** - Session-based authentication  
- **Logout** - Clean session termination
- **Profile** - User information display

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - TypeScript type checking
- `npm run db:push` - Sync database schema

## Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Set production environment variables
3. Start the production server:
   ```bash
   npm run start
   ```

## Next Steps

This framework gives you a solid foundation. Consider adding:

- Real-time features with WebSockets
- External API integrations
- File upload capabilities
- Email services
- Push notifications
- Admin dashboard
- Analytics tracking

## Support

This is a starter framework - customize it to fit your specific needs!