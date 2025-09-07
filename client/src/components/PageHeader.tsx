
import React from 'react';
import { Zap } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  iconColor?: string;
  iconBgColor?: string;
  iconRingColor?: string;
  titleColor?: string;
  subtitleColor?: string;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  iconColor = 'text-emerald-400',
  iconBgColor = 'bg-emerald-500/20',
  iconRingColor = 'ring-emerald-500/30',
  titleColor = 'text-slate-100',
  subtitleColor = 'text-emerald-300/80',
  className = ''
}: PageHeaderProps) {
  return (
    <div className={`pb-20 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen ${className}`}>
      <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 text-slate-100 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 ${iconBgColor} ring-1 ${iconRingColor} rounded-full flex items-center justify-center`}>
            <Zap className={`w-5 h-5 ${iconColor}`} />
          </div>
          <div>
            <h1 className={`text-xl font-black uppercase tracking-wider ${titleColor}`}>{title}</h1>
            <p className={`text-xs font-semibold ${subtitleColor}`}>{subtitle}</p>
          </div>
        </div>
      </header>
    </div>
  );
}

// Alternative version that just returns the header without the main container
export function HeaderOnly({
  title,
  subtitle,
  iconColor = 'text-emerald-400',
  iconBgColor = 'bg-emerald-500/20',
  iconRingColor = 'ring-emerald-500/30',
  titleColor = 'text-slate-100',
  subtitleColor = 'text-emerald-300/80'
}: Omit<PageHeaderProps, 'className'>) {
  return (
    <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 text-slate-100 p-4 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 ${iconBgColor} ring-1 ${iconRingColor} rounded-full flex items-center justify-center`}>
          <Zap className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div>
          <h1 className={`text-xl font-black uppercase tracking-wider ${titleColor}`}>{title}</h1>
          <p className={`text-xs font-semibold ${subtitleColor}`}>{subtitle}</p>
        </div>
      </div>
    </header>
  );
}
