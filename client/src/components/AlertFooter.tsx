import React from 'react';

export interface AlertFooterProps {
  half: 'Top' | 'Bottom';
  inning: number;
  bases: {
    first: boolean;
    second: boolean;
    third: boolean;
    home?: boolean;   // optional, if you want to show home plate too
  };
  balls: number;   // 0..4
  strikes: number; // 0..3
  outs: number;    // 0..3
}

// Reusable indicator for B/S/O lights
const Indicator: React.FC<{ label: string; count: number; max: number }> = ({
  label,
  count,
  max,
}) => (
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
}) => {
  // In order: first, second, third, home (home is optional).
  const baseOrder: (keyof typeof bases)[] = ['first', 'second', 'third', 'home'];

  return (
    <div className="flex items-center justify-between w-full px-4 py-2 bg-gray-800 text-white rounded-b-xl">
      <div className="flex items-center space-x-3">
        <span className="text-base font-semibold whitespace-nowrap">
          {half} of {inning}
        </span>
        {/* Base diamonds */}
        <div className="flex space-x-1">
          {baseOrder.map((base) =>
            bases[base] !== undefined ? (
              <div
                key={base}
                className={`w-3 h-3 transform rotate-45 border border-gray-500 ${
                  bases[base] ? 'bg-green-500' : 'bg-gray-700'
                }`}
              ></div>
            ) : null
          )}
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <Indicator label="B" count={balls} max={4} />
        <Indicator label="S" count={strikes} max={3} />
        <Indicator label="O" count={outs} max={3} />
      </div>
    </div>
  );
};

export default AlertFooter;