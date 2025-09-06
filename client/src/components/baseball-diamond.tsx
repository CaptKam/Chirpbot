import React from 'react';
import { motion } from 'framer-motion';

// BaseballDiamond component removed

interface WeatherDisplayProps {
  windSpeed?: number;
  windDirection?: string;
  windGust?: number;
  temperature?: number;
  stadiumWindContext?: string;
  size?: 'sm' | 'md';
}

export function WeatherDisplay({
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

  // Use stadium context if available, otherwise show basic wind info
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
          <span className="text-slate-300">
            {temperature}°F
          </span>
        </>
      )}
    </div>
  );
}