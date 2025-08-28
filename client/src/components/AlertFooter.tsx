import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Clock3 } from 'lucide-react';
import { Pill } from './Pill';

export interface AlertFooterProps {
  half: 'Top' | 'Bottom';
  inning: number;
  bases: {
    first: boolean;
    second: boolean;
    third: boolean;
    home?: boolean;   // optional, if you want to show home plate too
  };
  balls?: number;   // 0..4 (optional)
  strikes?: number; // 0..3 (optional)
  outs: number;    // 0..3
  createdAt?: string; // timestamp for the timer
}

// Reusable indicator for B/S/O lights
const Indicator: React.FC<{ label: string; count?: number; max: number }> = ({
  label,
  count,
  max,
}) => {
  // If count is undefined/null, don't render the indicator
  if (count === undefined || count === null) {
    return null;
  }
  
  return (
    <div className="flex items-center space-x-1">
      <span className="text-sm font-medium mr-1">{label}</span>
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${
            i < count ? 'bg-green-400' : 'bg-gray-500'
          }`}
        ></span>
      ))}
    </div>
  );
};

/**
 * AlertFooter
 *
 * Renders a dark bar with:
 *   • Half inning and inning number on the left.
 *   • A row of 4 diamonds for bases (highlighted green when occupied).
 *   • Indicators for balls (max 4), strikes (max 3) and outs (max 3).
 */
const AlertFooter: React.FC<AlertFooterProps> = ({
  half,
  inning,
  bases,
  balls,
  strikes,
  outs,
  createdAt,
}) => {
  // In order: first, second, third, home (home is optional).
  const baseOrder: (keyof typeof bases)[] = ['first', 'second', 'third', 'home'];

  return (
    <div className="flex items-center justify-between w-full px-4 py-2 bg-gray-800 text-white rounded-b-xl">
      <div className="flex items-center space-x-3">
        <span className="text-base font-semibold whitespace-nowrap">
          {half} of {inning}
        </span>
        {/* Baseball Field Diamond */}
        <div className="relative w-8 h-8 ml-2">
          {/* Second Base (top) */}
          <div
            className={`absolute top-0 left-1/2 transform -translate-x-1/2 w-2 h-2 rotate-45 border border-gray-500 ${
              bases.second ? 'bg-green-500' : 'bg-gray-700'
            }`}
          ></div>
          
          {/* Third Base (left) */}
          <div
            className={`absolute top-1/2 left-0 transform -translate-y-1/2 w-2 h-2 rotate-45 border border-gray-500 ${
              bases.third ? 'bg-green-500' : 'bg-gray-700'
            }`}
          ></div>
          
          {/* First Base (right) */}
          <div
            className={`absolute top-1/2 right-0 transform -translate-y-1/2 w-2 h-2 rotate-45 border border-gray-500 ${
              bases.first ? 'bg-green-500' : 'bg-gray-700'
            }`}
          ></div>
          
          {/* Home Plate (bottom) */}
          <div
            className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-2 h-2 rotate-45 border border-gray-500 ${
              bases.home ? 'bg-green-500' : 'bg-gray-700'
            }`}
          ></div>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <Indicator label="B" count={balls} max={4} />
        <Indicator label="S" count={strikes} max={3} />
        <Indicator label="O" count={outs} max={3} />
        {createdAt && (
          <Pill className="text-slate-300 ml-2">
            <Clock3 className="w-3.5 h-3.5" />
            {formatDistanceToNow(new Date(createdAt), { addSuffix: true, includeSeconds: true })}
          </Pill>
        )}
      </div>
    </div>
  );
};

export default AlertFooter;