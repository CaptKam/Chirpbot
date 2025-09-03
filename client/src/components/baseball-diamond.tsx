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
  windGust?: number;
  size?: 'sm' | 'md';
}

export function WeatherDisplay({
  windSpeed = 0,
  windDirection = 'N',
  temperature,
  windGust,
  size = 'sm'
}: WeatherDisplayProps) {
  const getCenterFieldWindEffect = (direction: string, speed: number) => {
    // Convert direction to degrees for calculation
    const directionMap: Record<string, number> = {
      'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
      'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
      'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
      'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
    };

    const degrees = directionMap[direction.toUpperCase()] || 0;

    // Center field is typically at 0 degrees (due North)
    // Calculate wind direction relative to center field
    if (degrees >= 315 || degrees <= 45) {
      // Wind blowing toward center field (from behind batter)
      return { 
        effect: 'To Center', 
        color: 'text-green-400', 
        bgColor: 'bg-green-400/10',
        arrow: '🎯',
        description: 'Carrying to CF'
      };
    } else if (degrees >= 135 && degrees <= 225) {
      // Wind blowing from center field (toward batter)
      return { 
        effect: 'From Center', 
        color: 'text-red-400', 
        bgColor: 'bg-red-400/10',
        arrow: '⬅️',
        description: 'Against carries'
      };
    } else if (degrees >= 45 && degrees <= 135) {
      // Wind blowing from right field toward left field
      return { 
        effect: 'Left Pull', 
        color: 'text-blue-400', 
        bgColor: 'bg-blue-400/10',
        arrow: '↖️',
        description: 'RF → LF'
      };
    } else {
      // Wind blowing from left field toward right field
      return { 
        effect: 'Right Pull', 
        color: 'text-purple-400', 
        bgColor: 'bg-purple-400/10',
        arrow: '↗️',
        description: 'LF → RF'
      };
    }
  };

  const getWindStrengthIcon = (speed: number) => {
    if (speed >= 20) return { icon: '🌪️', intensity: 'Very Strong', color: 'text-red-500' };
    if (speed >= 15) return { icon: '💨', intensity: 'Strong', color: 'text-orange-500' };
    if (speed >= 10) return { icon: '🍃', intensity: 'Moderate', color: 'text-yellow-500' };
    if (speed >= 5) return { icon: '🪶', intensity: 'Light', color: 'text-green-500' };
    return { icon: '😴', intensity: 'Calm', color: 'text-slate-500' };
  };

  const windEffect = getCenterFieldWindEffect(windDirection, windSpeed);
  const windStrength = getWindStrengthIcon(windSpeed);
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className={`flex items-center space-x-2 ${textSize}`}>
      {/* Mini Baseball Field Diagram */}
      <div className="relative">
        <div className="w-8 h-8 border border-slate-600 rounded-sm relative">
          {/* Home Plate */}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-slate-400 rounded-full" />
          {/* Center Field */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-emerald-400 rounded-full" />

          {/* Wind Arrow pointing toward center field */}
          <div className={`absolute inset-0 flex items-center justify-center ${windEffect.color}`}>
            <span className="text-sm">{windEffect.arrow}</span>
          </div>
        </div>
      </div>

      {/* Wind Speed with Strength Icon */}
      <div className="flex items-center space-x-1">
        <span className="text-sm">{windStrength.icon}</span>
        <div className="flex flex-col">
          <span className="text-slate-300 font-mono font-bold leading-none">
            {windSpeed}mph
          </span>
          <span className={`${windStrength.color} text-xs leading-none`}>
            {windStrength.intensity}
          </span>
        </div>
      </div>

      {/* Direction Effect */}
      <div className={`px-2 py-1 rounded-md ${windEffect.bgColor}`}>
        <div className="flex flex-col">
          <span className={`${windEffect.color} font-semibold text-xs leading-none`}>
            {windEffect.effect}
          </span>
          <span className="text-slate-500 text-xs leading-none">
            {windEffect.description}
          </span>
        </div>
      </div>

      {/* Gust Indicator with Lightning */}
      {windGust && windGust > windSpeed && (
        <div className="flex items-center space-x-1 px-2 py-1 bg-orange-500/20 rounded-md border border-orange-500/30">
          <span className="text-orange-400 text-sm">⚡</span>
          <div className="flex flex-col">
            <span className="text-orange-300 font-bold text-xs leading-none">
              G{windGust}
            </span>
            <span className="text-orange-500 text-xs leading-none">
              Gusts
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export { default as WeatherImpactVisualizer } from './WeatherImpactVisualizer';