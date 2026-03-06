
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
    <header className="bg-solidBackground/95 backdrop-blur-xl border-b border-[#1E293B] text-white p-4 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center space-x-3">
        <ChirpBotLogo size="md" showText={false} />
        <div>
          <h1 className="text-xl font-black text-white tracking-tight uppercase">{title}</h1>
          <p className="text-primaryBlue text-[10px] font-bold tracking-widest uppercase">{subtitle}</p>
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
