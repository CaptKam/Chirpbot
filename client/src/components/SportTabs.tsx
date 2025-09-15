
import React from 'react';
import { getSportTabColors } from '@shared/season-manager';

interface SportTabsProps {
  sports: string[];
  activeSport: string;
  onSportChange: (sport: string) => void;
  onSportChangeCallback?: () => void;
}

// Note: getSportTabColors is now imported from season-manager

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

  // Debug: Log sports array to console
  console.log('SportTabs: Received sports array:', sports, 'Count:', sports.length);

  return (
    <div className="bg-white/5 backdrop-blur-sm border-b border-white/10">
      <div className="flex overflow-x-auto scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600">
        {sports.map((sport) => {
          const colors = getSportTabColors(sport);
          console.log(`SportTabs: Rendering sport tab for ${sport}`);
          return (
            <button
              key={sport}
              onClick={() => handleSportChange(sport)}
              data-testid={`sport-tab-${sport.toLowerCase()}`}
              className={`flex-shrink-0 px-6 py-4 text-sm font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors ${
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
