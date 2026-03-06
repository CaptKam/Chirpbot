
import { LucideIcon, Zap } from 'lucide-react';
import { ChirpBotLogo } from '@/components/ChirpBotLogo';

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
  children
}: PageHeaderProps) {
  return (
    <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 text-slate-100 p-4 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <ChirpBotLogo size="md" showText={false} />
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
          <p className="text-emerald-400/80 text-xs font-semibold">{subtitle}</p>
        </div>
      </div>
      {children}
    </header>
  );
}

export function HeaderOnly({
  title,
  subtitle,
}: Omit<PageHeaderProps, 'children'>) {
  return (
    <PageHeader
      title={title}
      subtitle={subtitle}
    />
  );
}
