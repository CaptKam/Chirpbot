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
  windGust?: number;
  temperature?: number;
  stadiumWindContext?: string;
  size?: 'sm' | 'md';
}

// Wind Direction Compass Component
function WindDirectionCompass({ 
  windDirection, 
  windSpeed, 
  stadiumWindContext, 
  size = 'sm' 
}: {
  windDirection: string;
  windSpeed: number;
  stadiumWindContext?: string;
  size?: 'sm' | 'md';
}) {
  // Convert wind direction to degrees for rotation
  const getWindDegrees = (direction: string) => {
    const directions: Record<string, number> = {
      'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
      'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
      'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
      'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
    };
    return directions[direction.toUpperCase()] || 0;
  };

  // Get wind impact from stadium context
  const getWindImpact = () => {
    if (!stadiumWindContext) return 'neutral';
    const context = stadiumWindContext.toLowerCase();

    if (context.includes('to center field') || context.includes('to left field') || context.includes('to right field')) {
      return 'favorable'; // Helps home runs
    }
    if (context.includes('in from center') || context.includes('in from left') || context.includes('in from right')) {
      return 'unfavorable'; // Hurts home runs
    }
    return 'neutral';
  };

  const windDegrees = getWindDegrees(windDirection);
  const impact = getWindImpact();
  const compassSize = size === 'sm' ? 'w-16 h-16' : 'w-20 h-20';

  // Arrow color based on wind impact
  const arrowColor = impact === 'favorable' ? 'text-emerald-400' : 
                     impact === 'unfavorable' ? 'text-red-400' : 'text-blue-400';

  return (
    <div className={`relative ${compassSize} flex items-center justify-center`}>
      {/* Home Plate Base */}
      <div className="absolute w-6 h-6 bg-white transform rotate-45 border-2 border-slate-600 z-10" />

      {/* Spinning Wind Arrow */}
      <motion.div
        className={`absolute ${arrowColor} text-2xl z-20`}
        style={{
          transform: `rotate(${windDegrees}deg) translateY(-24px)`,
        }}
        animate={{
          rotate: [windDegrees, windDegrees + 360]
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "linear"
        }}
      >
        ⬆️
      </motion.div>

      {/* Wind Speed Label */}
      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-center">
        <div className={`font-bold ${arrowColor}`}>
          {windSpeed}mph
        </div>
        {stadiumWindContext && (
          <div className="text-slate-300 text-[10px] leading-tight max-w-20">
            {stadiumWindContext}
          </div>
        )}
      </div>

      {/* Home Run Impact Indicator */}
      {windSpeed >= 10 && impact !== 'neutral' && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-lg">
          {impact === 'favorable' ? '📈' : '📉'}
        </div>
      )}

      {/* Compass Points */}
      <div className="absolute inset-0 text-xs text-slate-500">
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2">N</div>
        <div className="absolute right-0 top-1/2 transform translate-x-2 -translate-y-1/2">E</div>
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-2">S</div>
        <div className="absolute left-0 top-1/2 transform -translate-x-2 -translate-y-1/2">W</div>
      </div>
    </div>
  );
}

export function WeatherDisplay({
  windSpeed = 0,
  windDirection = 'N',
  windGust,
  temperature,
  stadiumWindContext,
  size = 'sm'
}: WeatherDisplayProps) {
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className={`flex flex-col items-center space-y-2 ${textSize}`}>
      {/* Wind Compass */}
      <WindDirectionCompass
        windDirection={windDirection}
        windSpeed={windSpeed}
        stadiumWindContext={stadiumWindContext}
        size={size}
      />

      {/* Additional Weather Info */}
      <div className="flex items-center space-x-2 text-slate-300">
        {windGust && windGust > windSpeed + 3 && (
          <span className="text-yellow-400">
            Gusts {windGust}mph
          </span>
        )}
        {temperature && (
          <>
            {windGust && windGust > windSpeed + 3 && <span className="text-slate-500">•</span>}
            <span>
              {temperature}°F
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// Legacy simple weather display for non-MLB or fallback
export function SimpleWeatherDisplay({
  windSpeed = 0,
  windDirection = 'N',
  windGust,
  temperature,
  stadiumWindContext,
  size = 'sm'
}: WeatherDisplayProps) {
  const getWindIcon = (direction: string) => {
    const directions: Record<string, string> = {
      'N': '↑', 'S': '↓', 'E': '→', 'W': '←',
      'NE': '↗', 'NW': '↖', 'SE': '↘', 'SW': '↙'
    };
    return directions[direction.toUpperCase()] || '↑';
  };

  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const displayText = stadiumWindContext || `${windSpeed}mph ${windDirection}`;

  return (
    <div className={`flex items-center space-x-1 ${textSize}`}>
      <span className="text-slate-400 font-mono">
        {getWindIcon(windDirection)}
      </span>
      <span className="text-slate-300 font-medium">
        {displayText}
        {windGust && windGust > windSpeed + 3 && (
          <span className="text-yellow-400 ml-1">
            (gusts {windGust}mph)
          </span>
        )}
      </span>
      {temperature && (
        <>
          <span className="text-slate-500">•</span>