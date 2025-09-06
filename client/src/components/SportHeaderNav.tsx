
import React from 'react';
import { Zap, Bell, SettingsIcon } from 'lucide-react';

interface SportHeaderNavProps {
  activeSport: string;
  onSportChange: (sport: string) => void;
  title: string;
  subtitle: string;
  icon?: 'bell' | 'settings' | 'zap';
  sports?: string[];
}

const SPORTS = ["MLB", "NFL", "NBA", "NHL", "CFL", "NCAAF", "WNBA"];

export function SportHeaderNav({ 
  activeSport, 
  onSportChange, 
  title, 
  subtitle, 
  icon = 'zap',
  sports = SPORTS 
}: SportHeaderNavProps) {
  const getIcon = () => {
    switch (icon) {
      case 'bell':
        return <Bell className="w-5 h-5 text-emerald-400" />;
      case 'settings':
        return <SettingsIcon className="w-5 h-5 text-emerald-400" />;
      default:
        return <Zap className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <>
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 text-slate-100 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-emerald-500/20 ring-1 ring-emerald-500/30 rounded-full flex items-center justify-center">
            {getIcon()}
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide text-slate-100">{title}</h1>
            <p className="text-emerald-300/80 text-xs font-medium">{subtitle}</p>
          </div>
        </div>
      </header>

      {/* Sport Tabs */}
      <div className="bg-white/5 backdrop-blur-sm border-b border-white/10">
        <div className="flex overflow-x-auto">
          {sports.map((sport) => (
            <button
              key={sport}
              onClick={() => onSportChange(sport)}
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
    </>
  );
}
