
import { LucideIcon, Zap } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  iconRingColor?: string;
  children?: React.ReactNode;
}

export function PageHeader({ 
  title, 
  subtitle, 
  icon: Icon = Zap,
  iconColor = "text-emerald-400",
  iconBgColor = "bg-emerald-500/20",
  iconRingColor = "ring-emerald-500/30",
  children 
}: PageHeaderProps) {
  return (
    <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 text-slate-100 p-4 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 ${iconBgColor} ring-1 ${iconRingColor} rounded-full flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider text-slate-100">{title}</h1>
          <p className="text-emerald-300/80 text-xs font-semibold">{subtitle}</p>
        </div>
      </div>
      {children}
    </header>
  );
}

export function HeaderOnly({ 
  title, 
  subtitle, 
  icon: Icon = Zap,
  iconColor = "text-emerald-400",
  iconBgColor = "bg-emerald-500/20",
  iconRingColor = "ring-emerald-500/30"
}: Omit<PageHeaderProps, 'children'>) {
  return (
    <PageHeader 
      title={title} 
      subtitle={subtitle} 
      icon={Icon}
      iconColor={iconColor}
      iconBgColor={iconBgColor}
      iconRingColor={iconRingColor}
    />
  );
}
