import { Zap } from 'lucide-react';

type LogoSize = 'xs' | 'sm' | 'md' | 'lg';

interface ChirpBotLogoProps {
  size?: LogoSize;
  showText?: boolean;
  className?: string;
}

const sizeConfig: Record<LogoSize, { box: string; icon: string; text: string }> = {
  xs: { box: 'h-7 w-7 rounded-lg', icon: 'w-3.5 h-3.5', text: 'text-[14px]' },
  sm: { box: 'h-8 w-8 rounded-lg', icon: 'w-4 h-4', text: 'text-[15px]' },
  md: { box: 'h-10 w-10 rounded-lg', icon: 'w-5 h-5', text: 'text-xl' },
  lg: { box: 'h-14 w-14 rounded-xl', icon: 'w-7 h-7', text: 'text-2xl' },
};

export function ChirpBotLogo({ size = 'sm', showText = true, className = '' }: ChirpBotLogoProps) {
  const cfg = sizeConfig[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`${cfg.box} bg-primaryBlue/15 ring-1 ring-primaryBlue/25 flex items-center justify-center`}>
        <Zap className={`${cfg.icon} text-primaryBlue`} />
      </div>
      {showText && (
        <span className={`${cfg.text} font-black text-white tracking-tight uppercase`}>
          Chirp.bet
        </span>
      )}
    </div>
  );
}
