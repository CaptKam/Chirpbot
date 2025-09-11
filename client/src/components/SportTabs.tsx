import React from 'react';
import { Badge } from '@/components/ui/badge';

interface SportTabsProps {
  sports: string[];
  activeSport: string;
  onSportChange: (sport: string) => void;
  onSportChangeCallback?: () => void;
  alertCounts?: Record<string, number>;
}

// Sport-specific color mapping for tabs with enhanced visibility
function getSportTabColors(sport: string): { 
  border: string; 
  text: string; 
  bg: string;
  activeBorder: string;
  activeText: string;
  activeBg: string;
  badgeBg: string;
} {
  switch (sport.toUpperCase()) {
    case 'MLB':
      return { 
        border: 'border-green-500', 
        text: 'text-green-400', 
        bg: 'bg-green-500/10',
        activeBorder: 'border-green-400',
        activeText: 'text-green-300',
        activeBg: 'bg-green-500/30',
        badgeBg: 'bg-green-600'
      };
    case 'NFL':
      return { 
        border: 'border-orange-500', 
        text: 'text-orange-400', 
        bg: 'bg-orange-500/10',
        activeBorder: 'border-orange-400',
        activeText: 'text-orange-300',
        activeBg: 'bg-orange-500/30',
        badgeBg: 'bg-orange-600'
      };
    case 'NBA':
      return { 
        border: 'border-purple-500', 
        text: 'text-purple-400', 
        bg: 'bg-purple-500/10',
        activeBorder: 'border-purple-400',
        activeText: 'text-purple-300',
        activeBg: 'bg-purple-500/30',
        badgeBg: 'bg-purple-600'
      };
    case 'WNBA':
      return { 
        border: 'border-pink-500', 
        text: 'text-pink-400', 
        bg: 'bg-pink-500/10',
        activeBorder: 'border-pink-400',
        activeText: 'text-pink-300',
        activeBg: 'bg-pink-500/30',
        badgeBg: 'bg-pink-600'
      };
    case 'CFL':
      return { 
        border: 'border-red-500', 
        text: 'text-red-400', 
        bg: 'bg-red-500/10',
        activeBorder: 'border-red-400',
        activeText: 'text-red-300',
        activeBg: 'bg-red-500/30',
        badgeBg: 'bg-red-600'
      };
    case 'NCAAF':
      return { 
        border: 'border-blue-500', 
        text: 'text-blue-400', 
        bg: 'bg-blue-500/10',
        activeBorder: 'border-blue-400',
        activeText: 'text-blue-300',
        activeBg: 'bg-blue-500/30',
        badgeBg: 'bg-blue-600'
      };
    case 'NHL':
      return { 
        border: 'border-cyan-500', 
        text: 'text-cyan-400', 
        bg: 'bg-cyan-500/10',
        activeBorder: 'border-cyan-400',
        activeText: 'text-cyan-300',
        activeBg: 'bg-cyan-500/30',
        badgeBg: 'bg-cyan-600'
      };
    default:
      return { 
        border: 'border-emerald-500', 
        text: 'text-emerald-400', 
        bg: 'bg-emerald-500/10',
        activeBorder: 'border-emerald-400',
        activeText: 'text-emerald-300',
        activeBg: 'bg-emerald-500/30',
        badgeBg: 'bg-emerald-600'
      };
  }
}

export function SportTabs({ 
  sports, 
  activeSport, 
  onSportChange, 
  onSportChangeCallback,
  alertCounts = {}
}: SportTabsProps) {
  const handleSportChange = (sport: string) => {
    onSportChange(sport);
    onSportChangeCallback?.();
  };

  return (
    <div className="relative bg-slate-900/60 backdrop-blur-md border-b border-white/20 shadow-lg">
      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
      
      {/* Scrollable tab container */}
      <div className="relative overflow-x-auto scrollbar-hide">
        <div className="flex min-w-full px-2 sm:px-4">
          {sports.map((sport) => {
            const colors = getSportTabColors(sport);
            const isActive = activeSport === sport;
            const count = alertCounts[sport] || 0;
            
            return (
              <button
                key={sport}
                onClick={() => handleSportChange(sport)}
                data-testid={`sport-tab-${sport.toLowerCase()}`}
                className={`
                  relative flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 
                  min-h-[44px] sm:min-h-[48px]
                  text-xs sm:text-sm font-semibold uppercase tracking-wider 
                  whitespace-nowrap border-b-3 transition-all duration-200 
                  ${isActive
                    ? `${colors.activeBorder} ${colors.activeText} ${colors.activeBg} shadow-inner font-bold border-b-2`
                    : `border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/10`
                  }
                `}
              >
                <span className={isActive ? 'scale-110 transition-transform' : ''}>
                  {sport}
                </span>
                {count > 0 && (
                  <Badge 
                    variant="secondary" 
                    className={`
                      ml-1 px-1.5 py-0 text-[10px] sm:text-xs font-bold
                      ${isActive 
                        ? `${colors.badgeBg} text-white border-white/40` 
                        : 'bg-slate-700/50 text-slate-300 border-slate-600/50'
                      }
                    `}
                  >
                    {count}
                  </Badge>
                )}
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent opacity-60" />
                )}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Fade edges for scroll indication on mobile */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-900/60 to-transparent pointer-events-none sm:hidden" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-900/60 to-transparent pointer-events-none sm:hidden" />
    </div>
  );
}