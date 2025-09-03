import { Clock } from "lucide-react";

interface AlertFooterProps {
  inning?: number;
  isTopInning?: boolean;
  balls?: number;
  strikes?: number;
  outs?: number;
  hasFirst?: boolean;
  hasSecond?: boolean;
  hasThird?: boolean;
  createdAt: string;
}

export function AlertFooter({
  inning = 1,
  isTopInning = true,
  balls = 0,
  strikes = 0,
  outs = 0,
  hasFirst = false,
  hasSecond = false,
  hasThird = false,
  createdAt
}: AlertFooterProps) {
  // Calculate time ago
  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - alertTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes === 1) return "1 minute ago";
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    
    const hours = Math.floor(diffInMinutes / 60);
    if (hours === 1) return "1 hour ago";
    return `${hours} hours ago`;
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
        {/* Left: Inning Info */}
        <div className="flex items-center space-x-3">
          <div className="font-medium">
            {isTopInning ? "Top" : "Bot"} {inning}
          </div>
          
          {/* Ball/Strike/Out Count */}
          <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">
            <span className="text-green-600 font-mono">{balls}B</span>
            <span className="text-red-600 font-mono">{strikes}S</span>
            <span className="text-gray-700 dark:text-gray-300 font-mono">{outs}O</span>
          </div>
        </div>

        {/* Center: Baseball Diamond */}
        <div className="flex-1 flex justify-center">
          <BaseballDiamond 
            hasFirst={hasFirst}
            hasSecond={hasSecond}
            hasThird={hasThird}
          />
        </div>

        {/* Right: Timestamp */}
        <div className="flex items-center space-x-1">
          <Clock className="w-3 h-3" />
          <span>{getTimeAgo(createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

interface BaseballDiamondProps {
  hasFirst: boolean;
  hasSecond: boolean;
  hasThird: boolean;
}

function BaseballDiamond({ hasFirst, hasSecond, hasThird }: BaseballDiamondProps) {
  return (
    <div className="relative w-8 h-8" data-testid="baseball-diamond">
      {/* Home Plate */}
      <div 
        className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-gray-400 rotate-45"
        style={{ bottom: '-1px' }}
      />
      
      {/* First Base */}
      <div 
        className={`absolute right-0 bottom-1/2 transform translate-y-1/2 w-1.5 h-1.5 rotate-45 ${
          hasFirst ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
        style={{ right: '-1px' }}
        data-testid="first-base"
      />
      
      {/* Second Base */}
      <div 
        className={`absolute top-0 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rotate-45 ${
          hasSecond ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
        style={{ top: '-1px' }}
        data-testid="second-base"
      />
      
      {/* Third Base */}
      <div 
        className={`absolute left-0 bottom-1/2 transform translate-y-1/2 w-1.5 h-1.5 rotate-45 ${
          hasThird ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
        style={{ left: '-1px' }}
        data-testid="third-base"
      />
      
      {/* Diamond outline */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 32 32">
        <path
          d="M16 2 L30 16 L16 30 L2 16 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-gray-400 dark:text-gray-600"
        />
      </svg>
    </div>
  );
}