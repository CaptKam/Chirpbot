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
  const getOutfieldWindEffect = (direction: string, speed: number) => {
    // Convert direction to degrees for calculation
    const directionMap: Record<string, number> = {
      'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
      'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
      'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
      'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
    };

    const degrees = directionMap[direction.toUpperCase()] || 0;

    // Assume outfield is roughly 180-360 degrees (S to N through W)
    // Tailwind (helping ball carry): 135-225 degrees
    // Headwind (hurting ball carry): 315-45 degrees
    // Crosswind: 45-135 or 225-315 degrees

    if (degrees >= 135 && degrees <= 225) {
      return { 
        effect: 'Tailwind', 
        color: 'text-green-400', 
        bgColor: 'bg-green-400/20',
        icon: '➡️',
        description: 'Helping carries'
      };
    } else if ((degrees >= 315 && degrees <= 360) || (degrees >= 0 && degrees <= 45)) {
      return { 
        effect: 'Headwind', 
        color: 'text-red-400', 
        bgColor: 'bg-red-400/20',
        icon: '⬅️',
        description: 'Hurting carries'
      };
    } else {
      return { 
        effect: 'Crosswind', 
        color: 'text-yellow-400', 
        bgColor: 'bg-yellow-400/20',
        icon: '↕️',
        description: 'Side movement'
      };
    }
  };

  const getWindIntensity = (speed: number) => {
    if (speed >= 20) return { level: 'Very Strong', bars: 4, color: 'bg-red-500' };
    if (speed >= 15) return { level: 'Strong', bars: 3, color: 'bg-orange-500' };
    if (speed >= 10) return { level: 'Moderate', bars: 2, color: 'bg-yellow-500' };
    if (speed >= 5) return { level: 'Light', bars: 1, color: 'bg-green-500' };
    return { level: 'Calm', bars: 0, color: 'bg-slate-500' };
  };

  const windEffect = getOutfieldWindEffect(windDirection, windSpeed);
  const windIntensity = getWindIntensity(windSpeed);
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className={`flex items-center space-x-3 ${textSize}`}>
      {/* Wind Direction & Effect */}
      <div className={`flex items-center space-x-2 px-2 py-1 rounded-md ${windEffect.bgColor}`}>
        <span className="text-lg">
          {windEffect.icon}
        </span>
        <div className="flex flex-col">
          <span className={`${windEffect.color} font-bold text-xs`}>
            {windEffect.effect}
          </span>
          <span className="text-slate-400 text-xs">
            {windEffect.description}
          </span>
        </div>
      </div>

      {/* Wind Speed with Visual Bars */}
      <div className="flex items-center space-x-2">
        <span className="text-slate-300 font-mono font-bold">
          {windSpeed}mph
        </span>
        
        {/* Wind Intensity Bars */}
        <div className="flex items-end space-x-0.5">
          {[1, 2, 3, 4].map((bar) => (
            <div
              key={bar}
              className={`w-1 ${
                bar <= windIntensity.bars ? windIntensity.color : 'bg-slate-600'
              } ${
                bar === 1 ? 'h-1' : bar === 2 ? 'h-2' : bar === 3 ? 'h-3' : 'h-4'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Gust Indicator */}
      {windGust && windGust > windSpeed && (
        <div className="flex items-center space-x-1 px-1 py-0.5 bg-orange-400/20 rounded">
          <span className="text-orange-400 text-xs font-bold">
            ⚡G{windGust}
          </span>
        </div>
      )}
    </div>
  );
}

export { default as WeatherImpactVisualizer } from './WeatherImpactVisualizer';