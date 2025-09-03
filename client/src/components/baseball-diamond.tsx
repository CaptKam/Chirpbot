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

      {/* Diamond */}
      <div className={`relative ${diamond} mx-auto`}>
        {/* Diamond background */}
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Infield diamond */}
          <path
            d="M50 15 L85 50 L50 85 L15 50 Z"
            fill="rgba(34, 139, 34, 0.1)"
            stroke="rgba(34, 139, 34, 0.4)"
            strokeWidth="1"
          />
          {/* Pitcher's mound */}
          <circle
            cx="50"
            cy="50"
            r="3"
            fill="rgba(139, 69, 19, 0.6)"
            stroke="rgba(139, 69, 19, 0.8)"
            strokeWidth="0.5"
          />
          {/* Home plate */}
          <path
            d="M50 82 L47 79 L47 76 L53 76 L53 79 Z"
            fill="white"
            stroke="#ccc"
            strokeWidth="0.5"
          />
        </svg>

        {/* First Base */}
        <motion.div
          className={`absolute ${base} bg-white rounded-sm border`}
          style={{ top: '45%', right: '8%', transform: 'translate(50%, -50%) rotate(45deg)' }}
          animate={{
            backgroundColor: runners.first ? '#10B981' : '#ffffff',
            scale: runners.first ? 1.3 : 1,
          }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {runners.first && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, duration: 0.2 }}
            >
              <div className="w-1 h-1 bg-white rounded-full"></div>
            </motion.div>
          )}
        </motion.div>

        {/* Second Base */}
        <motion.div
          className={`absolute ${base} bg-white rounded-sm border`}
          style={{ top: '8%', left: '50%', transform: 'translate(-50%, 50%) rotate(45deg)' }}
          animate={{
            backgroundColor: runners.second ? '#10B981' : '#ffffff',
            scale: runners.second ? 1.3 : 1,
          }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {runners.second && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, duration: 0.2 }}
            >
              <div className="w-1 h-1 bg-white rounded-full"></div>
            </motion.div>
          )}
        </motion.div>

        {/* Third Base */}
        <motion.div
          className={`absolute ${base} bg-white rounded-sm border`}
          style={{ top: '45%', left: '8%', transform: 'translate(-50%, -50%) rotate(45deg)' }}
          animate={{
            backgroundColor: runners.third ? '#10B981' : '#ffffff',
            scale: runners.third ? 1.3 : 1,
          }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {runners.third && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, duration: 0.2 }}
            >
              <div className="w-1 h-1 bg-white rounded-full"></div>
            </motion.div>
          )}
        </motion.div>
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
        animate={{ rotate: windSpeed > 10 ? 360 : 0 }}
        transition={{ duration: windSpeed > 10 ? 2 : 0, repeat: windSpeed > 10 ? Infinity : 0, ease: 'linear' }}
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