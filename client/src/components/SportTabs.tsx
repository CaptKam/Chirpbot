
import React from 'react';

interface SportTabsProps {
  sports: string[];
  activeSport: string;
  onSportChange: (sport: string) => void;
  onSportChangeCallback?: () => void;
}

// Sport-specific color mapping for tabs
function getSportTabColors(sport: string): { border: string; text: string; bg: string } {
  switch (sport.toUpperCase()) {
    case 'MLB':
      return { border: 'border-green-500', text: 'text-green-400', bg: 'bg-green-500/10' };
    case 'NFL':
      return { border: 'border-orange-500', text: 'text-orange-400', bg: 'bg-orange-500/10' };
    case 'NBA':
      return { border: 'border-purple-500', text: 'text-purple-400', bg: 'bg-purple-500/10' };
    case 'WNBA':
      return { border: 'border-pink-500', text: 'text-pink-400', bg: 'bg-pink-500/10' };
    case 'CFL':
      return { border: 'border-red-500', text: 'text-red-400', bg: 'bg-red-500/10' };
    case 'NCAAF':
      return { border: 'border-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/10' };
    case 'NHL':
      return { border: 'border-cyan-500', text: 'text-cyan-400', bg: 'bg-cyan-500/10' };
    default:
      return { border: 'border-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' };
  }
}

export function SportTabs({ 
  sports, 
  activeSport, 
  onSportChange, 
  onSportChangeCallback 
}: SportTabsProps) {
  const handleSportChange = (sport: string) => {
    onSportChange(sport);
    onSportChangeCallback?.();
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm border-b border-white/10">
      <div className="flex overflow-x-auto">
        {sports.map((sport) => {
          const colors = getSportTabColors(sport);
          return (
            <button
              key={sport}
              onClick={() => handleSportChange(sport)}
              data-testid={`sport-tab-${sport.toLowerCase()}`}
              className={`px-6 py-4 text-sm font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors ${
                activeSport === sport
                  ? `${colors.border} ${colors.text} ${colors.bg}`
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {sport}
            </button>
          );
        })}
      </div>
    </div>
  );
}
