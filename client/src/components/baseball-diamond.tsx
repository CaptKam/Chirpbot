import React from 'react';
import { motion } from 'framer-motion';

interface BaseRunners {
  first?: boolean;
  second?: boolean;
  third?: boolean;
}

interface BaseballDiamondProps {
  runners?: BaseRunners;
  inning?: number;
  isTopInning?: boolean;
  outs?: number;
  balls?: number;
  strikes?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
}

export function BaseballDiamond({
  runners = {},
  inning,
  isTopInning,
  outs = 0,
  balls = 0,
  strikes = 0,
  size = 'md',
  showCount = true
}: BaseballDiamondProps) {

  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return { diamond: 'w-16 h-16', base: 'w-2 h-2', text: 'text-xs' };
      case 'lg': return { diamond: 'w-24 h-24', base: 'w-4 h-4', text: 'text-sm' };
      default: return { diamond: 'w-20 h-20', base: 'w-3 h-3', text: 'text-xs' };
    }
  };

  const { diamond, base, text } = getSizeClasses();

  return (
    <div className="flex flex-col items-center space-y-2">
      {/* Count and Inning Info */}
      {showCount && (inning || outs || balls || strikes) && (
        <div className="text-center space-y-1">
          {inning && (
            <div className={`${text} text-slate-300 font-bold`}>
              {isTopInning ? '↑' : '↓'} {inning}th
            </div>
          )}
          <div className="flex items-center justify-center space-x-3">
            {(balls > 0 || strikes > 0) && (
              <div className={`${text} text-emerald-400 font-mono`}>
                {balls}-{strikes}
              </div>
            )}
            <div className={`${text} text-slate-400`}>
              {outs} out{outs !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}

      {/* Simple Baseball Diamond - Same as alerts page but bigger */}
      <div className={`relative ${size === 'sm' ? 'w-10 h-10' : 'w-16 h-16'} mx-auto flex-shrink-0`}>
        {/* Second Base */}
        <div className={`absolute top-0 left-1/2 transform -translate-x-1/2 ${size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'} rotate-45 border-2 ${runners.second ? 'bg-emerald-400 border-emerald-400' : 'border-slate-500'}`} />
        {/* Third Base */}
        <div className={`absolute top-1/2 left-0 transform -translate-y-1/2 ${size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'} rotate-45 border-2 ${runners.third ? 'bg-emerald-400 border-emerald-400' : 'border-slate-500'}`} />
        {/* First Base */}
        <div className={`absolute top-1/2 right-0 transform -translate-y-1/2 ${size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'} rotate-45 border-2 ${runners.first ? 'bg-emerald-400 border-emerald-400' : 'border-slate-500'}`} />
      </div>

      {/* Base status text */}
      {(runners.first || runners.second || runners.third) && (
        <motion.div
          className={`${text} text-emerald-400 font-medium text-center`}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {[
            runners.first && '1st',
            runners.second && '2nd',
            runners.third && '3rd'
          ].filter(Boolean).join(' & ')}
        </motion.div>
      )}
    </div>
  );
}

interface WeatherDisplayProps {
  windSpeed?: number;
  windDirection?: string;
  temperature?: number;
  size?: 'sm' | 'md';
}

export function WeatherDisplay({
  windSpeed = 0,
  windDirection = 'N',
  temperature,
  size = 'sm'
}: WeatherDisplayProps) {
  const getWindIcon = (direction: string) => {
    const directions: Record<string, string> = {
      'N': '↑', 'S': '↓', 'E': '→', 'W': '←',
      'NE': '↗', 'NW': '↖', 'SE': '↘', 'SW': '↙'
    };
    return directions[direction.toUpperCase()] || '○';
  };

  const getWindColor = (speed: number) => {
    if (speed >= 15) return 'text-red-400';
    if (speed >= 10) return 'text-yellow-400';
    if (speed >= 5) return 'text-green-400';
    return 'text-slate-400';
  };

  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className={`flex items-center space-x-1 ${textSize}`}>
      <motion.span
        className={`${getWindColor(windSpeed)} font-mono`}
        animate={{ rotate: windSpeed > 20 ? [0, 5, -5, 0] : 0 }}
        transition={{ 
          duration: windSpeed > 20 ? 1.5 : 0, 
          repeat: windSpeed > 20 ? Infinity : 0, 
          ease: 'easeInOut',
          repeatDelay: 0.5
        }}
      >
        {getWindIcon(windDirection)}
      </motion.span>
      <span className="text-slate-300 font-medium">
        {windSpeed}mph
      </span>
      {temperature && (
        <>
          <span className="text-slate-500">•</span>
          <span className="text-slate-300">
            {temperature}°F
          </span>
        </>
      )}
    </div>
  );
}

export { default as WeatherImpactVisualizer } from './WeatherImpactVisualizer';