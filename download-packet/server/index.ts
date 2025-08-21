import express from "express";
import session from "express-session";
import cors from "cors";
import routes from "./routes";
import { createViteDevServer } from "./vite";

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());

// Session configuration
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    user?: {
      id: string;
      username: string | null;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
      role: string;
    };
  }
}

app.use(session({
  secret: process.env.SESSION_SECRET || "sports-app-dev-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// API routes
app.use(routes);

// Create HTTP server for WebSocket
import { createServer } from "http";
const httpServer = createServer(app);

async function startServer() {
  if (process.env.NODE_ENV === "development") {
    // In development, serve frontend with Vite
    await createViteDevServer(app);
  } else {
    // In production, serve static files
    app.use(express.static("dist/client"));
    app.get("*", (req, res) => {
      res.sendFile("index.html", { root: "dist/client" });
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});