import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, Bell, TrendingUp, Shield, Brain, DollarSign, 
  ChevronRight, ArrowRight, Trophy, Target, Timer,
  Flame, BarChart3, Sparkles, Activity, Gamepad2,
  Lock, Eye, Smartphone, CheckCircle
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

const FEATURES = [
  {
    icon: Brain,
    title: "AI-Powered Analysis",
    description: "Advanced AI provides strategic insights and betting implications",
    gradient: "from-purple-500 to-pink-500"
  },
  {
    icon: Zap,
    title: "Real-Time Alerts",
    description: "Lightning-fast notifications for high-value betting opportunities",
    gradient: "from-yellow-500 to-orange-500"
  },
  {
    icon: Target,
    title: "Smart Filtering",
    description: "Focus on what matters with precision alert targeting",
    gradient: "from-blue-500 to-cyan-500"
  },
  {
    icon: Trophy,
    title: "Multi-Sport Coverage",
    description: "MLB, NFL, NBA, NHL - all major leagues covered",
    gradient: "from-green-500 to-emerald-500"
  }
];

const STATS = [
  { value: "95%", label: "Accuracy Rate", icon: Target },
  { value: "< 2s", label: "Alert Speed", icon: Zap },
  { value: "24/7", label: "Live Coverage", icon: Activity },
  { value: "4+", label: "Sports Covered", icon: Gamepad2 }
];

const ALERT_TYPES = [
  { name: "RISP", sport: "MLB", color: "from-red-500 to-orange-500" },
  { name: "RED ZONE", sport: "NFL", color: "from-orange-500 to-red-500" },
  { name: "CLUTCH TIME", sport: "NBA", color: "from-blue-500 to-cyan-500" },
  { name: "POWER PLAY", sport: "NHL", color: "from-yellow-500 to-orange-500" }
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F1419] via-[#1a1f2e] to-[#0F1419] overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-[#00DC82]/10 to-transparent rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-[#3B82F6]/10 to-transparent rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Hero Section */}
      <div className="relative z-10">
        <div className="px-4 pt-20 pb-16 text-center">
          {/* Logo Animation */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", duration: 0.8 }}
            className="inline-block mb-8"
          >
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-[#00DC82] to-[#36D399] rounded-2xl blur-xl opacity-50 animate-pulse"></div>
              <div className="relative bg-[#0F1419] p-4 rounded-2xl border border-[#00DC82]/20">
                <Zap className="w-16 h-16 text-[#00DC82]" />
              </div>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-5xl md:text-7xl font-black text-white mb-4">
              <span className="bg-gradient-to-r from-[#00DC82] to-[#36D399] bg-clip-text text-transparent">
                CHIRPBOT
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-400 mb-2">
              Next-Gen Sports Alert Intelligence
            </p>
            <div className="flex items-center justify-center space-x-2 mb-8">
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-1"></div>
                LIVE
              </Badge>
              <Badge className="bg-[#00DC82]/20 text-[#00DC82] border-[#00DC82]/30">
                AI ENHANCED
              </Badge>
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                REAL-TIME
              </Badge>
            </div>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-12"
          >
            <Link href="/login">
              <Button 
                size="lg"
                className="bg-gradient-to-r from-[#00DC82] to-[#36D399] text-black font-bold px-8 py-6 text-lg rounded-xl hover:shadow-2xl hover:shadow-[#00DC82]/30 transition-all transform hover:scale-105"
              >
                <DollarSign className="w-5 h-5 mr-2" />
                START WINNING
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/signup">
              <Button 
                size="lg"
                variant="outline"
                className="border-gray-700 text-white hover:bg-gray-900 px-8 py-6 text-lg rounded-xl"
              >
                <Lock className="w-5 h-5 mr-2" />
                Create Account
              </Button>
            </Link>
          </motion.div>

          {/* Live Alert Types Preview */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-wrap justify-center gap-2 mb-12"
          >
            {ALERT_TYPES.map((alert, index) => (
              <motion.div
                key={alert.name}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className={`bg-gradient-to-r ${alert.color} p-[1px] rounded-full`}
              >
                <div className="bg-[#0F1419] px-4 py-2 rounded-full">
                  <span className={`font-bold text-sm bg-gradient-to-r ${alert.color} bg-clip-text text-transparent`}>
                    {alert.name}
                  </span>
                  <span className="text-gray-500 text-xs ml-2">{alert.sport}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Stats Section */}
        <div className="px-4 pb-16">
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATS.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                >
                  <Card className="bg-gray-900/50 border-gray-800 p-6 text-center backdrop-blur-sm">
                    <Icon className="w-8 h-8 text-[#00DC82] mx-auto mb-2" />
                    <div className="text-3xl font-black text-white mb-1">{stat.value}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Features Grid */}
        <div className="px-4 pb-16">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-3xl font-black text-white text-center mb-8"
          >
            Why Professionals Choose ChirpBot
          </motion.h2>
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
            {FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.2 + index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  className="group"
                >
                  <Card className="bg-gray-900/50 border-gray-800 p-6 backdrop-blur-sm hover:border-gray-700 transition-all">
                    <div className="flex items-start space-x-4">
                      <div className={`relative flex-shrink-0`}>
                        <div className={`absolute -inset-2 bg-gradient-to-r ${feature.gradient} rounded-lg blur opacity-30 group-hover:opacity-50 transition-opacity`}></div>
                        <div className={`relative bg-gradient-to-r ${feature.gradient} p-3 rounded-lg`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                        <p className="text-gray-400">{feature.description}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Live Demo Section */}
        <div className="px-4 pb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.5 }}
            className="max-w-4xl mx-auto"
          >
            <Card className="bg-gradient-to-r from-gray-900 to-gray-800 border-gray-700 p-8 text-center">
              <Flame className="w-12 h-12 text-orange-400 mx-auto mb-4 animate-pulse" />
              <h3 className="text-2xl font-black text-white mb-4">
                See It In Action
              </h3>
              <p className="text-gray-400 mb-6">
                Join thousands of sports enthusiasts who never miss a critical moment
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                <Link href="/login">
                  <Button 
                    size="lg"
                    className="bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold px-6 py-3 rounded-lg hover:shadow-lg hover:shadow-orange-500/25 transition-all"
                  >
                    <Eye className="w-5 h-5 mr-2" />
                    View Live Alerts
                  </Button>
                </Link>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <CheckCircle className="w-4 h-4 text-[#00DC82]" />
                  <span>No credit card required</span>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Trust Indicators */}
        <div className="px-4 pb-16">
          <div className="max-w-6xl mx-auto flex flex-wrap justify-center items-center gap-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.7 }}
              className="flex items-center space-x-2"
            >
              <Shield className="w-5 h-5 text-[#00DC82]" />
              <span className="text-gray-400">Bank-Level Security</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8 }}
              className="flex items-center space-x-2"
            >
              <Smartphone className="w-5 h-5 text-[#00DC82]" />
              <span className="text-gray-400">Mobile Optimized</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.9 }}
              className="flex items-center space-x-2"
            >
              <Activity className="w-5 h-5 text-[#00DC82]" />
              <span className="text-gray-400">99.9% Uptime</span>
            </motion.div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="px-4 pb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2 }}
          >
            <h2 className="text-3xl font-black text-white mb-4">
              Ready to Level Up Your Game?
            </h2>
            <p className="text-gray-400 mb-8">
              Join the elite community of sports enthusiasts who stay ahead of the game
            </p>
            <Link href="/signup">
              <Button 
                size="lg"
                className="bg-gradient-to-r from-[#00DC82] to-[#36D399] text-black font-black px-12 py-6 text-xl rounded-xl hover:shadow-2xl hover:shadow-[#00DC82]/30 transition-all transform hover:scale-105"
              >
                GET STARTED FREE
                <Sparkles className="w-6 h-6 ml-3" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}