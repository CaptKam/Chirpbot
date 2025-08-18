import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div>
      <main style={{ paddingBottom: '60px' }}>{children}</main>
      <nav style={{
        display: 'flex', justifyContent: 'space-around',
        position: 'fixed', bottom: 0, width: '100%', background: '#eee', padding: '10px 0'
      }}>
        <Link to="/calendar" style={{ fontWeight: pathname === '/calendar' ? 'bold' : 'normal' }}>Calendar</Link>
        <Link to="/alerts" style={{ fontWeight: pathname === '/alerts' ? 'bold' : 'normal' }}>Alerts</Link>
        <Link to="/settings" style={{ fontWeight: pathname === '/settings' ? 'bold' : 'normal' }}>Settings</Link>
      </nav>
    </div>
  );
}
