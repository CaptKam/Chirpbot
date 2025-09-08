
import React from 'react';

interface SportTabsProps {
  sports: string[];
  activeSport: string;
  onSportChange: (sport: string) => void;
  onSportChangeCallback?: () => void;
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
        {sports.map((sport) => (
          <button
            key={sport}
            onClick={() => handleSportChange(sport)}
            data-testid={`sport-tab-${sport.toLowerCase()}`}
            className={`px-6 py-4 text-sm font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors ${
              activeSport === sport
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {sport}
          </button>
        ))}
      </div>
    </div>
  );
}
