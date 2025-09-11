import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, Settings, RefreshCw, AlertCircle, Clock, Sparkles, TrendingUp, Activity, Zap } from 'lucide-react';
import { Link } from 'wouter';
import { Badge } from '@/components/ui/badge';

interface EmptyStateProps {
  sport: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
  lastRefreshTime?: Date;
}

export function EmptyState({ sport, onRefresh, isRefreshing, lastRefreshTime }: EmptyStateProps) {
  const getSportSpecificMessage = () => {
    if (sport === 'all') {
      return {
        title: "No Active Alerts",
        message: "Your alert feed is quiet right now. This could mean:",
        reasons: [
          "No games are currently in critical situations",
          "Your monitored teams aren't playing",
          "Alert settings need configuration"
        ],
        icon: <Bell className="h-16 w-16 text-slate-400" />
      };
    }
    
    const sportMessages: Record<string, any> = {
      MLB: {
        title: "No MLB Alerts",
        message: "No critical baseball situations detected",
        reasons: [
          "No bases loaded scenarios active",
          "No late-inning pressure situations",
          "Games may be between innings"
        ],
        icon: <div className="text-6xl">⚾</div>
      },
      NFL: {
        title: "No NFL Alerts",
        message: "No critical football plays happening",
        reasons: [
          "No red zone opportunities",
          "No two-minute warnings active",
          "Games may be at halftime"
        ],
        icon: <div className="text-6xl">🏈</div>
      },
      NBA: {
        title: "No NBA Alerts",
        message: "No clutch basketball moments right now",
        reasons: [
          "No close games in final minutes",
          "No overtime situations",
          "Games may be in early quarters"
        ],
        icon: <div className="text-6xl">🏀</div>
      },
      NHL: {
        title: "No NHL Alerts",
        message: "No critical hockey action detected",
        reasons: [
          "No power play opportunities",
          "No overtime situations",
          "No empty net scenarios"
        ],
        icon: <div className="text-6xl">🏒</div>
      },
      NCAAF: {
        title: "No NCAAF Alerts",
        message: "No college football alerts active",
        reasons: [
          "No upset opportunities developing",
          "No critical fourth downs",
          "Games may not be in session"
        ],
        icon: <div className="text-6xl">🎓</div>
      },
      WNBA: {
        title: "No WNBA Alerts",
        message: "No WNBA game alerts right now",
        reasons: [
          "No clutch time situations",
          "No comeback scenarios active",
          "Games may not be scheduled"
        ],
        icon: <div className="text-6xl">🏀</div>
      },
      CFL: {
        title: "No CFL Alerts",
        message: "No Canadian football alerts",
        reasons: [
          "No rouge opportunities",
          "No critical third downs",
          "Games may not be active"
        ],
        icon: <div className="text-6xl">🍁</div>
      }
    };
    
    return sportMessages[sport] || sportMessages.all;
  };

  const content = getSportSpecificMessage();
  const timeSinceRefresh = lastRefreshTime 
    ? Math.floor((Date.now() - lastRefreshTime.getTime()) / 1000 / 60)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="bg-gradient-to-br from-slate-800/50 via-slate-800/30 to-slate-900/50 backdrop-blur-sm border-slate-700/50">
        <CardContent className="p-12 text-center">
          {/* Animated Icon */}
          <motion.div 
            className="mb-6 flex justify-center"
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 4,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          >
            {content.icon}
          </motion.div>

          {/* Title & Message */}
          <h3 className="text-2xl font-bold text-slate-100 mb-3">{content.title}</h3>
          <p className="text-slate-300 mb-4 text-lg">{content.message}</p>

          {/* Reasons List */}
          <div className="mb-8 max-w-md mx-auto">
            {content.reasons.map((reason: string, idx: number) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-start text-left mb-2"
              >
                <Sparkles className="h-4 w-4 text-emerald-400 mr-2 mt-1 flex-shrink-0" />
                <span className="text-sm text-slate-400">{reason}</span>
              </motion.div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button 
              onClick={onRefresh}
              disabled={isRefreshing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Alerts
                </>
              )}
            </Button>
            
            <Link href="/settings">
              <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700 min-w-[140px]">
                <Settings className="h-4 w-4 mr-2" />
                Configure Alerts
              </Button>
            </Link>
          </div>

          {/* Last Refresh Time */}
          {timeSinceRefresh !== null && (
            <div className="mt-4 flex items-center justify-center text-xs text-slate-500">
              <Clock className="h-3 w-3 mr-1" />
              Last checked {timeSinceRefresh === 0 ? 'just now' : `${timeSinceRefresh} minute${timeSinceRefresh !== 1 ? 's' : ''} ago`}
            </div>
          )}

          {/* Onboarding Hint */}
          {sport === 'all' && (
            <motion.div 
              className="mt-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg max-w-md mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-sm text-blue-300">
                <strong>💡 Pro Tip:</strong> Enable alerts for your favorite teams in Settings to never miss critical game moments!
              </p>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Skeleton loader for alert cards
export function AlertSkeleton() {
  return (
    <div className="relative overflow-hidden">
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="p-6">
          {/* Header skeleton */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-700 rounded-full animate-pulse" />
              <div>
                <div className="h-4 w-24 bg-slate-700 rounded animate-pulse mb-2" />
                <div className="h-3 w-16 bg-slate-700 rounded animate-pulse" />
              </div>
            </div>
            <div className="h-6 w-16 bg-slate-700 rounded-full animate-pulse" />
          </div>

          {/* Content skeleton */}
          <div className="space-y-3">
            <div className="h-3 w-full bg-slate-700 rounded animate-pulse" />
            <div className="h-3 w-4/5 bg-slate-700 rounded animate-pulse" />
            <div className="h-3 w-3/4 bg-slate-700 rounded animate-pulse" />
          </div>

          {/* Score skeleton */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-8 w-20 bg-slate-700 rounded animate-pulse" />
              <div className="h-6 w-6 bg-slate-700 rounded animate-pulse" />
              <div className="h-8 w-20 bg-slate-700 rounded animate-pulse" />
            </div>
            <div className="h-6 w-24 bg-slate-700 rounded animate-pulse" />
          </div>

          {/* Footer skeleton */}
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <div className="h-10 w-full bg-slate-700 rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>

      {/* Shimmer effect overlay */}
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}

// Loading grid with multiple skeletons
export function AlertLoadingGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
        >
          <AlertSkeleton />
        </motion.div>
      ))}
    </div>
  );
}

// Error state component
export function ErrorState({ 
  message = "Failed to load alerts", 
  onRetry 
}: { 
  message?: string; 
  onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <Card className="bg-red-500/10 border-red-500/30">
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-red-300 mb-2">Oops! Something went wrong</h3>
          <p className="text-slate-300 mb-6">{message}</p>
          <Button 
            onClick={onRetry}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <p className="text-xs text-slate-500 mt-4">
            If this problem persists, please check your connection or contact support.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Progressive loading indicator
export function LoadingMore() {
  return (
    <motion.div 
      className="py-4 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="inline-flex items-center gap-2 text-slate-400">
        <Activity className="h-4 w-4 animate-pulse" />
        <span className="text-sm">Loading more alerts...</span>
      </div>
    </motion.div>
  );
}