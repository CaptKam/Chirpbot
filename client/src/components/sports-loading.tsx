import React from 'react';

interface SportsLoadingProps {
  sport?: string;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SportsLoading({ 
  sport = 'MLB', 
  message = 'Loading game data...', 
  size = 'md' 
}: SportsLoadingProps) {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return 'w-8 h-8 text-2xl';
      case 'lg': return 'w-20 h-20 text-6xl';
      default: return 'w-12 h-12 text-4xl';
    }
  };

  const getSportAnimation = (sport: string) => {
    switch (sport.toUpperCase()) {
      case 'MLB':
        return (
          <div className="relative">
            {/* Baseball spinning */}
            <div className={`${getSizeClasses()} animate-spin flex items-center justify-center text-white`}>
              ⚾
            </div>
            {/* Bouncing bat */}
            <div className="absolute -top-2 -right-2 text-lg animate-bounce">
              🏏
            </div>
          </div>
        );
        
      case 'NFL':
        return (
          <div className="relative">
            {/* Football spinning */}
            <div className={`${getSizeClasses()} animate-spin flex items-center justify-center text-amber-600`}>
              🏈
            </div>
            {/* Pulsing goal posts */}
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 text-sm animate-pulse">
              🥅
            </div>
          </div>
        );
        
      case 'NBA':
        return (
          <div className="relative">
            {/* Basketball bouncing */}
            <div className={`${getSizeClasses()} animate-bounce flex items-center justify-center text-orange-500`}>
              🏀
            </div>
            {/* Spinning hoop */}
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-lg animate-spin">
              🏀
            </div>
          </div>
        );
        
      case 'NHL':
        return (
          <div className="relative">
            {/* Puck sliding */}
            <div className={`${getSizeClasses()} flex items-center justify-center`}>
              <div className="w-8 h-2 bg-black rounded-full animate-pulse"></div>
            </div>
            {/* Hockey sticks crossing */}
            <div className="absolute inset-0 flex items-center justify-center text-sm">
              <div className="animate-ping">🏒</div>
            </div>
          </div>
        );
        
      case 'CFL':
        return (
          <div className="relative">
            {/* Canadian football with maple leaf */}
            <div className={`${getSizeClasses()} animate-spin flex items-center justify-center text-red-600`}>
              🏈
            </div>
            <div className="absolute top-0 right-0 text-xs animate-pulse">
              🍁
            </div>
          </div>
        );
        
      case 'NCAAF':
        return (
          <div className="relative">
            {/* College football with graduation cap */}
            <div className={`${getSizeClasses()} animate-spin flex items-center justify-center text-blue-600`}>
              🏈
            </div>
            <div className="absolute -top-1 -right-1 text-xs animate-bounce">
              🎓
            </div>
          </div>
        );
        
      default:
        return (
          <div className="relative">
            {/* Generic sports with trophy */}
            <div className={`${getSizeClasses()} animate-spin flex items-center justify-center text-yellow-500`}>
              🏆
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-full border-2 border-primaryBlue border-t-transparent rounded-full animate-spin opacity-50"></div>
            </div>
          </div>
        );
    }
  };

  const getLoadingMessages = (sport: string) => {
    const messages = {
      MLB: [
        "Analyzing pitcher tendencies...", 
        "Tracking base runners...", 
        "Calculating batting averages...", 
        "Checking field conditions...",
        "Loading diamond data..."
      ],
      NFL: [
        "Reading the playbook...", 
        "Analyzing offensive line...", 
        "Checking down and distance...", 
        "Loading field position...",
        "Studying game film..."
      ],
      NBA: [
        "Bouncing into action...", 
        "Shooting for the stats...", 
        "Dribbling up the data...", 
        "Loading court vision...",
        "Analyzing shot charts..."
      ],
      NHL: [
        "Skating to the net...", 
        "Checking ice conditions...", 
        "Loading power play data...", 
        "Analyzing face-off wins...",
        "Preparing for overtime..."
      ],
      CFL: [
        "Eh! Loading Canadian stats...", 
        "Preparing three downs...", 
        "Loading wider field data...", 
        "Analyzing rouge plays..."
      ],
      NCAAF: [
        "Studying for the game...", 
        "Loading college rankings...", 
        "Analyzing conference play...", 
        "Preparing bowl projections..."
      ]
    };
    
    const sportMessages = messages[sport.toUpperCase() as keyof typeof messages] || messages.MLB;
    return sportMessages[Math.floor(Math.random() * sportMessages.length)];
  };

  const [currentMessage, setCurrentMessage] = React.useState(message);
  const [dots, setDots] = React.useState('');

  React.useEffect(() => {
    let messageInterval: NodeJS.Timeout;
    let dotInterval: NodeJS.Timeout;

    // Change loading message every 2 seconds
    if (message === 'Loading game data...' || message.includes('Loading')) {
      messageInterval = setInterval(() => {
        setCurrentMessage(getLoadingMessages(sport));
      }, 2000);
    }

    // Animate dots every 500ms
    dotInterval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => {
      clearInterval(messageInterval);
      clearInterval(dotInterval);
    };
  }, [sport, message]);

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="text-center space-y-4">
        {getSportAnimation(sport)}
        <div className="space-y-2">
          <p className="text-slate-300 font-medium">
            {currentMessage}{dots}
          </p>
          {sport && (
            <p className="text-slate-500 text-sm uppercase tracking-wider font-bold">
              {sport} Game Center
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function GameCardLoading({ sport = 'MLB' }: { sport?: string }) {
  return (
    <div className="bg-surface rounded-xl p-6 border border-[#1E293B]">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Team loading placeholder with pulse */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-[#1E293B] rounded animate-pulse"></div>
            <div className="h-4 w-16 bg-[#1E293B] rounded animate-pulse"></div>
          </div>
          <div className="text-xl font-bold text-slate-400 animate-pulse">vs</div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-[#1E293B] rounded animate-pulse"></div>
            <div className="h-4 w-16 bg-[#1E293B] rounded animate-pulse"></div>
          </div>
        </div>
        
        {/* Sport-specific loading animation */}
        <div className="flex items-center space-x-3">
          <SportsLoading sport={sport} message="" size="sm" />
        </div>
      </div>
      
      {/* Game details loading */}
      <div className="mt-4 space-y-2">
        <div className="h-3 w-24 bg-[#1E293B] rounded animate-pulse"></div>
        <div className="h-3 w-32 bg-[#1E293B] rounded animate-pulse"></div>
      </div>
    </div>
  );
}

export function StatsLoading({ message = 'Crunching numbers...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center space-y-3">
        <div className="relative">
          {/* Multiple bouncing balls */}
          <div className="flex items-center justify-center space-x-1">
            <div className="w-3 h-3 bg-emeraldGreen rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          {/* Spinning chart icon */}
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-xl animate-spin">
            📊
          </div>
        </div>
        <p className="text-slate-300 text-sm">{message}</p>
      </div>
    </div>
  );
}

export function AlertLoading() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="text-center space-y-4">
        <div className="relative">
          {/* Pulsing bell */}
          <div className="text-5xl animate-pulse">
            🔔
          </div>
          {/* Spinning alert waves */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 border-2 border-yellow-500/30 rounded-full animate-ping"></div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-2 border-red-500/40 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-slate-300 font-medium">Scanning for live alerts...</p>
          <p className="text-slate-500 text-sm">Monitoring active games</p>
        </div>
      </div>
    </div>
  );
}

export function AuthLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-solidBackground text-white">
      <div className="text-center space-y-4">
        <div className="relative">
          {/* Spinning shield */}
          <div className="text-5xl animate-spin">
            🛡️
          </div>
          {/* Pulsing lock */}
          <div className="absolute -bottom-1 -right-1 text-lg animate-pulse">
            🔒
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-slate-300 font-medium">Securing your session...</p>
          <p className="text-slate-500 text-sm">ChirpBot Authentication</p>
        </div>
      </div>
    </div>
  );
}