import React, { useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, ExternalLink, Download } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Import sportsbook logos
import bet365Logo from '@assets/bet365.jpg';
import draftkingsLogo from '@assets/draftkings.png';
import fanaticsLogo from '@assets/fanatics.png';
import fanduelLogo from '@assets/fanduel.png';

interface SwipeableCardProps {
  children: React.ReactNode;
  alertId: string;
  className?: string;
  [key: string]: any;
}

interface Sportsbook {
  name: string;
  logo: string;
  appUrl: string;
  storeUrl: string;
  color: string;
}

const sportsbooks: Sportsbook[] = [
  {
    name: 'Bet365',
    logo: bet365Logo,
    appUrl: 'bet365://',
    storeUrl: 'https://apps.apple.com/app/bet365-sportsbook-casino/id454638411',
    color: '#1E5F2F'
  },
  {
    name: 'DraftKings',
    logo: draftkingsLogo,
    appUrl: 'draftkings://',
    storeUrl: 'https://apps.apple.com/app/draftkings-sportsbook-casino/id1051014021',
    color: '#FF6B35'
  },
  {
    name: 'Fanatics',
    logo: fanaticsLogo,
    appUrl: 'fanatics://',
    storeUrl: 'https://apps.apple.com/app/fanatics-sportsbook-casino/id1601393479',
    color: '#E31837'
  },
  {
    name: 'FanDuel',
    logo: fanduelLogo,
    appUrl: 'fanduel://',
    storeUrl: 'https://apps.apple.com/app/fanduel-sportsbook-casino/id1273132976',
    color: '#0D7EFF'
  }
];

export function SwipeableCard({ children, alertId, className, ...props }: SwipeableCardProps) {
  const [dragX, setDragX] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSportsbookClick = (sportsbook: Sportsbook) => {
    // Try to open the app first
    const link = document.createElement('a');
    link.href = sportsbook.appUrl;
    link.click();
    
    // Fallback to app store after a short delay
    setTimeout(() => {
      window.open(sportsbook.storeUrl, '_blank');
    }, 1000);

    toast({
      title: `Opening ${sportsbook.name}`,
      description: `Redirecting to ${sportsbook.name} sportsbook...`,
    });
  };

  const handleDeleteAlert = async () => {
    setIsDeleting(true);
    try {
      await apiRequest("DELETE", `/api/alerts/${alertId}`);
      
      // Invalidate and refetch alerts
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/alerts/unseen/count'] });
      
      toast({
        title: "Alert deleted",
        description: "The alert has been removed from your feed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete alert. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    const threshold = 100;
    if (Math.abs(info.offset.x) < threshold) {
      setDragX(0);
    } else if (info.offset.x > threshold) {
      // Swiped right - show delete
      setDragX(120);
    } else if (info.offset.x < -threshold) {
      // Swiped left - show sportsbooks
      setDragX(-280);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Sportsbook Menu (Left Swipe) */}
      <div className="absolute inset-y-0 right-0 w-80 bg-gradient-to-l from-emerald-500/20 to-transparent backdrop-blur-sm flex items-center justify-end pr-4 space-x-2">
        {sportsbooks.map((sportsbook) => (
          <Button
            key={sportsbook.name}
            onClick={() => handleSportsbookClick(sportsbook)}
            className="h-12 w-12 p-0 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm ring-1 ring-white/20 transition-all"
            data-testid={`sportsbook-${sportsbook.name.toLowerCase()}`}
          >
            <img 
              src={sportsbook.logo} 
              alt={sportsbook.name}
              className="w-8 h-8 rounded object-cover"
            />
          </Button>
        ))}
      </div>

      {/* Delete Menu (Right Swipe) */}
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-red-500/20 to-transparent backdrop-blur-sm flex items-center justify-start pl-4">
        <Button
          onClick={handleDeleteAlert}
          disabled={isDeleting}
          className="h-12 w-12 p-0 rounded-full bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm ring-1 ring-red-500/30 transition-all"
          data-testid={`delete-alert-${alertId}`}
        >
          <Trash2 className="w-5 h-5 text-red-400" />
        </Button>
      </div>

      {/* Main Card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -300, right: 140 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={{ x: dragX }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="relative z-10"
        whileDrag={{ scale: 1.02 }}
      >
        <Card className={className} {...props}>
          {children}
        </Card>
      </motion.div>
    </div>
  );
}
