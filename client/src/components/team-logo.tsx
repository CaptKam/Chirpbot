import React from 'react';

interface TeamLogoProps {
  teamName: string;
  abbreviation: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function TeamLogo({ teamName, abbreviation, size = 'md', className = '' }: TeamLogoProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  const logoMap: Record<string, JSX.Element> = {
    // MLB Teams
    'LAD': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <defs>
          <linearGradient id="dodgers-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#005A9C" />
            <stop offset="100%" stopColor="#0078D4" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#dodgers-gradient)" stroke="#FFFFFF" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-2xl font-sans">LA</text>
      </svg>
    ),
    'SF': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <defs>
          <linearGradient id="giants-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FD5A1E" />
            <stop offset="100%" stopColor="#FF8C42" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#giants-gradient)" stroke="#000000" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-black font-black text-2xl font-sans">SF</text>
      </svg>
    ),
    'NYY': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#132448" stroke="#C4CED4" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-xl font-sans">NY</text>
      </svg>
    ),
    'BOS': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#BD3039" stroke="#FFFFFF" strokeWidth="2"/>
        <circle cx="50" cy="50" r="20" fill="none" stroke="#FFFFFF" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-2xl font-sans">B</text>
      </svg>
    ),
    'CHC': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#0E3386" stroke="#CC3433" strokeWidth="3"/>
        <circle cx="50" cy="50" r="35" fill="none" stroke="#CC3433" strokeWidth="1"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-base font-sans">CHC</text>
      </svg>
    ),
    'MIL': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#FFC52F" stroke="#12284B" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-blue-900 font-black text-xl font-sans">M</text>
      </svg>
    ),

    // NFL Teams
    'KC': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#E31837" stroke="#FFB81C" strokeWidth="4"/>
        <polygon points="35,35 65,35 50,65" fill="#FFB81C"/>
        <text x="50" y="40" textAnchor="middle" className="fill-white font-black text-sm font-sans">KC</text>
      </svg>
    ),
    'BUF': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#00338D" stroke="#C60C30" strokeWidth="3"/>
        <circle cx="40" cy="40" r="8" fill="#C60C30"/>
        <text x="50" y="65" textAnchor="middle" className="fill-white font-black text-sm font-sans">BILLS</text>
      </svg>
    ),

    // NBA Teams  
    'LAL': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#552583" stroke="#FDB927" strokeWidth="4"/>
        <rect x="20" y="40" width="60" height="20" fill="#FDB927" rx="4"/>
        <text x="50" y="55" textAnchor="middle" className="fill-purple-900 font-black text-sm font-sans">LAKERS</text>
      </svg>
    ),
    'BOS': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#007A33" stroke="#BA9653" strokeWidth="3"/>
        <circle cx="50" cy="45" r="12" fill="none" stroke="#BA9653" strokeWidth="2"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">CELTICS</text>
      </svg>
    ),

    // NHL Teams
    'LAK': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#111111" stroke="#A2AAAD" strokeWidth="2"/>
        <polygon points="30,30 70,30 60,50 40,50" fill="#A2AAAD"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">KINGS</text>
      </svg>
    ),
    'ANA': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#F47A38" stroke="#B9975B" strokeWidth="3"/>
        <polygon points="25,45 75,45 50,25" fill="#B9975B"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">DUCKS</text>
      </svg>
    )
  };

  // Generic fallback logo
  const defaultLogo = (
    <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className}`}>
      <circle cx="50" cy="50" r="48" fill="#6B7280" stroke="#FFFFFF" strokeWidth="2"/>
      <text x="50" y="60" textAnchor="middle" className="fill-white font-bold text-lg">{abbreviation}</text>
    </svg>
  );

  return logoMap[abbreviation] || defaultLogo;
}