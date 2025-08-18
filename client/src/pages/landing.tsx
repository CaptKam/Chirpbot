import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { 
  Zap, Bell, Shield, TrendingUp, Users, Activity, 
  ChevronRight, Star, Award, Globe, BarChart3, 
  Sparkles, Target, Trophy, Rocket, CheckCircle,
  ArrowRight, PlayCircle, Brain, Wifi
} from "lucide-react";
import { useState, useEffect } from "react";

// Animated counter component
function AnimatedCounter({ end, duration = 2000, suffix = "" }: { end: number, duration?: number, suffix?: string }) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration]);
  
  return <span>{count.toLocaleString()}{suffix}</span>;
}

export default function Landing() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Intelligence",
      description: "GPT-4o analyzes game situations with 85%+ confidence scoring",
      gradient: "from-purple-600 to-pink-600"
    },
    {
      icon: Wifi,
      title: "Real-Time ESPN Data",
      description: "Live feeds directly from ESPN's official API endpoints",
      gradient: "from-blue-600 to-cyan-600"
    },
    {
      icon: Target,
      title: "Precision Alerts",
      description: "Get notified only for the moments that truly matter",
      gradient: "from-orange-600 to-red-600"
    },
    {
      icon: Trophy,
      title: "Multi-League Coverage",
      description: "Complete coverage for MLB, NFL, NBA, and NHL games",
      gradient: "from-green-600 to-teal-600"
    }
  ];

  const stats = [
    { value: 24, label: "Hour Monitoring", suffix: "/7" },
    { value: 85, label: "AI Confidence", suffix: "%" },
    { value: 100, label: "Games Daily", suffix: "+" },
    { value: 1, label: "Second Updates", suffix: "s" }
  ];

  return (
    <div className="min-h-screen bg-black overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 animate-gradient opacity-50" />
      
      {/* Animated orbs */}
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-700 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-cyan-700 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-700 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{ animationDelay: "4s" }} />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Premium Header */}
        <motion.header 
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          className="glassmorphism border-b border-white/10"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-20">
              <motion.div 
                className="flex items-center space-x-4"
                whileHover={{ scale: 1.05 }}
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-orange-600 rounded-full blur animate-pulse-glow" />
                  <div className="relative w-12 h-12 bg-gradient-to-r from-red-600 to-orange-600 rounded-full flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white tracking-tight">ChirpBot</h1>
                  <p className="text-xs text-gray-400 uppercase tracking-widest">V2 Elite</p>
                </div>
              </motion.div>
              
              <div className="flex items-center space-x-6">
                <Link href="/login">
                  <Button 
                    variant="ghost" 
                    className="text-white hover:text-gray-300 font-medium"
                    data-testid="button-landing-login"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button 
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold px-6 py-2 rounded-full shadow-lg"
                      data-testid="button-landing-signup"
                    >
                      Get Started Free
                      <Sparkles className="ml-2 w-4 h-4" />
                    </Button>
                  </motion.div>
                </Link>
              </div>
            </div>
          </div>
        </motion.header>

        {/* Hero Section */}
        <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            {/* Premium badge */}
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="inline-flex items-center glassmorphism rounded-full px-6 py-3 mb-8"
            >
              <div className="w-2 h-2 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full animate-pulse mr-3" />
              <span className="text-sm font-medium text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                LIVE • 96 Games Monitoring Now
              </span>
            </motion.div>

            {/* Main headline */}
            <motion.h1 
              className="text-7xl sm:text-8xl font-black text-white mb-8 leading-tight"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              Never Miss
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500">
                The Action
              </span>
            </motion.h1>

            <motion.p 
              className="text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              AI-powered sports intelligence that tracks every game-changing moment 
              across MLB, NFL, NBA, and NHL in real-time.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div 
              className="flex flex-col sm:flex-row items-center justify-center gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Link href="/signup">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button 
                    size="lg" 
                    className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-10 py-7 text-xl font-bold rounded-full shadow-2xl group"
                    data-testid="button-hero-get-started"
                  >
                    Start Free Trial
                    <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </motion.div>
              </Link>
              
              <motion.button 
                whileHover={{ scale: 1.05 }}
                className="flex items-center space-x-3 text-white/80 hover:text-white transition-colors"
              >
                <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
                  <PlayCircle className="w-7 h-7" />
                </div>
                <span className="font-medium">Watch Demo</span>
              </motion.button>
            </motion.div>

            {/* Trust indicators */}
            <motion.div 
              className="flex items-center justify-center space-x-8 mt-16"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <div className="flex items-center space-x-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-yellow-500 text-yellow-500" />
                ))}
                <span className="ml-2 text-gray-400">4.9/5 Rating</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-gray-400" />
                <span className="text-gray-400">10K+ Active Users</span>
              </div>
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-gray-400" />
                <span className="text-gray-400">Bank-Level Security</span>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* Animated Stats Bar */}
        <section className="relative py-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/50 via-purple-900/50 to-pink-900/50" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 + index * 0.1 }}
                  className="text-center"
                >
                  <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 mb-2">
                    <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="text-gray-400 font-medium">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Premium Features Grid */}
        <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl font-black text-white mb-6">
              Enterprise-Grade
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400"> Technology</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Built with the same infrastructure powering professional sports analytics platforms
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + index * 0.1 }}
                whileHover={{ y: -10 }}
                className="group"
              >
                <Card className="glassmorphism-strong border-white/10 p-8 h-full hover-lift cursor-pointer">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
                  <p className="text-gray-400 text-lg">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Sports Coverage Showcase */}
        <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glassmorphism-strong rounded-3xl p-12 text-center"
          >
            <h2 className="text-5xl font-black text-white mb-4">
              Every League. Every Game.
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400"> Every Moment.</span>
            </h2>
            <p className="text-xl text-gray-400 mb-12">
              Professional-grade monitoring across all major sports leagues
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { league: "MLB", feature: "RISP Alerts", games: "2,430", color: "from-blue-500 to-indigo-500" },
                { league: "NFL", feature: "Red Zone", games: "272", color: "from-green-500 to-emerald-500" },
                { league: "NBA", feature: "Clutch Time", games: "1,230", color: "from-orange-500 to-red-500" },
                { league: "NHL", feature: "Power Plays", games: "1,312", color: "from-cyan-500 to-blue-500" }
              ].map((sport, index) => (
                <motion.div
                  key={index}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-white/5 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
                  <div className="relative glassmorphism rounded-2xl p-6">
                    <div className={`text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r ${sport.color} mb-2`}>
                      {sport.league}
                    </div>
                    <p className="text-white font-medium mb-1">{sport.feature}</p>
                    <p className="text-gray-500 text-sm">{sport.games} games/year</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Testimonials */}
        <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <motion.div className="text-center mb-16">
            <h2 className="text-5xl font-black text-white mb-6">
              Trusted by
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400"> Sports Fans</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: "Mike R.", role: "Fantasy League Champion", text: "ChirpBot's alerts helped me win my league. The AI predictions are incredibly accurate!" },
              { name: "Sarah L.", role: "Sports Analyst", text: "The real-time data integration is flawless. This is professional-grade sports monitoring." },
              { name: "James K.", role: "Die-Hard Fan", text: "Never missed a crucial moment since using ChirpBot. It's like having a personal sports assistant." }
            ].map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glassmorphism rounded-2xl p-8"
              >
                <div className="flex items-center space-x-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                  ))}
                </div>
                <p className="text-gray-300 mb-6 italic">"{testimonial.text}"</p>
                <div>
                  <p className="text-white font-bold">{testimonial.name}</p>
                  <p className="text-gray-500 text-sm">{testimonial.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Premium CTA Section */}
        <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <motion.div 
            className="relative overflow-hidden rounded-3xl"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-orange-600 to-yellow-600 animate-gradient" />
            <div className="relative glassmorphism-strong p-16 text-center">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Award className="w-16 h-16 text-white mx-auto mb-6" />
                <h2 className="text-5xl font-black text-white mb-6">
                  Join the Elite
                </h2>
                <p className="text-2xl text-white/90 mb-8 max-w-2xl mx-auto">
                  Start your free trial today and experience professional-grade sports monitoring
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                  <Link href="/signup">
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button 
                        size="lg" 
                        className="bg-white text-red-600 hover:bg-gray-100 px-10 py-7 text-xl font-bold rounded-full shadow-2xl"
                        data-testid="button-cta-signup"
                      >
                        Start Free Trial
                        <Rocket className="ml-3 w-6 h-6" />
                      </Button>
                    </motion.div>
                  </Link>
                </div>

                <div className="flex items-center justify-center space-x-8">
                  <div className="flex items-center space-x-2 text-white/80">
                    <CheckCircle className="w-5 h-5" />
                    <span>No credit card required</span>
                  </div>
                  <div className="flex items-center space-x-2 text-white/80">
                    <CheckCircle className="w-5 h-5" />
                    <span>Cancel anytime</span>
                  </div>
                  <div className="flex items-center space-x-2 text-white/80">
                    <CheckCircle className="w-5 h-5" />
                    <span>24/7 support</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* Premium Footer */}
        <footer className="relative border-t border-white/10 mt-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-red-600 to-orange-600 rounded-full flex items-center justify-center">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">ChirpBot V2</h3>
                    <p className="text-xs text-gray-500">Elite Sports Intelligence</p>
                  </div>
                </div>
                <p className="text-gray-400 text-sm">
                  Professional-grade sports monitoring powered by AI and real-time data.
                </p>
              </div>

              <div>
                <h4 className="text-white font-bold mb-4">Product</h4>
                <ul className="space-y-2 text-gray-400 text-sm">
                  <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">API Access</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Enterprise</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-bold mb-4">Company</h4>
                <ul className="space-y-2 text-gray-400 text-sm">
                  <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-bold mb-4">Connect</h4>
                <div className="flex space-x-4">
                  <Globe className="w-5 h-5 text-gray-400 hover:text-white cursor-pointer transition-colors" />
                  <BarChart3 className="w-5 h-5 text-gray-400 hover:text-white cursor-pointer transition-colors" />
                  <Users className="w-5 h-5 text-gray-400 hover:text-white cursor-pointer transition-colors" />
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between">
              <p className="text-gray-500 text-sm">
                © 2025 ChirpBot V2. All rights reserved.
              </p>
              <div className="flex items-center space-x-6 text-gray-500 text-sm mt-4 md:mt-0">
                <span>Powered by ESPN API</span>
                <span>•</span>
                <span>OpenAI GPT-4o</span>
                <span>•</span>
                <span>Neon Database</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}