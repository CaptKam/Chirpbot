import React from 'react';
import { Clock } from 'lucide-react';

interface AlertFooterProps {
  inning?: number;
  isTopInning?: boolean;
  outs?: number;
  balls?: number;
  strikes?: number;
  hasFirst?: boolean;
  hasSecond?: boolean;
  hasThird?: boolean;
  createdAt: string;
}

export default function AlertFooter({
  inning,
  isTopInning,
  outs = 0,
  balls = 0,
  strikes = 0,
  hasFirst = false,
  hasSecond = false,
  hasThird = false,
  createdAt
}: AlertFooterProps) {
  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const alertTime = new Date(dateString);
    const diffMinutes = Math.floor((now.getTime() - alertTime.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes === 1) return '1 min ago';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
  };

  return (
    <div className="flex items-center justify-between text-xs text-slate-400">
      <div className="flex items-center space-x-4">
        {/* Inning Display */}
        {inning && (
          <div className="flex items-center space-x-1">
            <span className="text-emerald-400 font-medium">
              {isTopInning ? '▲' : '▼'} {inning}
            </span>
          </div>
        )}

        {/* Count Display */}
        <div className="flex items-center space-x-2">
          <span className="text-slate-300">
            {balls}-{strikes}, {outs} {outs === 1 ? 'out' : 'outs'}
          </span>
        </div>

        {/* Base Runners - Baseball Diamond Layout */}
        <div className="relative w-6 h-6 flex-shrink-0">
          {/* Second Base - Top */}
          <div className={`absolute top-0 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rotate-45 border ${hasSecond ? 'bg-emerald-400 border-emerald-400' : 'border-slate-500'}`} />
          
          {/* Third Base - Left */}
          <div className={`absolute top-1/2 left-0 transform -translate-y-1/2 w-1.5 h-1.5 rotate-45 border ${hasThird ? 'bg-emerald-400 border-emerald-400' : 'border-slate-500'}`} />
          
          {/* First Base - Right */}
          <div className={`absolute top-1/2 right-0 transform -translate-y-1/2 w-1.5 h-1.5 rotate-45 border ${hasFirst ? 'bg-emerald-400 border-emerald-400' : 'border-slate-500'}`} />
          
          {/* Home Plate - Bottom */}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-slate-600 rounded-full" />
        </div>
      </div>

      {/* Time Ago */}
      <div className="flex items-center space-x-1">
        <Clock className="w-3 h-3" />
        <span>{formatTimeAgo(createdAt)}</span>
      </div>
    </div>
  );
}