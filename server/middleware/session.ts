import session from "express-session";

export const userSessionParser = session({
  name: 'cb.sid',
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    path: '/',
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
    domain: undefined,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
});

export const adminSessionParser = session({
  name: 'cb_admin.sid',
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    path: '/',
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
    domain: undefined,
    maxAge: 4 * 60 * 60 * 1000
  }
});
