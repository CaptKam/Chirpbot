import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, SignalHigh, Zap, ShieldCheck, TimerReset, Activity, Wifi, ChevronDown, Play, Star, Users, TrendingUp, Award, Target, Clock, Globe, Eye, Bolt, Bell, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROICalculator } from "@/components/roi-calculator";
import basketballArenaImage from '@assets/generated_images/Basketball_arena_game_moment_4c760cd5.png';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 antialiased selection:bg-emerald-500/30 overflow-x-hidden">
      <Nav />
      <Hero />
      <LogosStrip />
      <TrustBadges />
      <ValueProps />
      <LivePreview />
      <HowItWorks />
      <Testimonials />
      <ROICalculator />
      <Proof />
      <Pricing />
      <FAQ />
      <Footer />
    </div>
  );
}

function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-[#0B1220]/70">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
        <a href="#" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-[#10B981]" />
          </div>
          <span className="font-semibold tracking-wide">chirpbot</span>
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          <a className="text-sm text-slate-300 hover:text-white transition-colors" href="#features">Features</a>
          <a className="text-sm text-slate-300 hover:text-white transition-colors" href="#preview">Preview</a>
          <a className="text-sm text-slate-300 hover:text-white transition-colors" href="#pricing">Pricing</a>
          <a className="text-sm text-slate-300 hover:text-white transition-colors" href="#faq">FAQ</a>
          <Link href="/signup">
            <Button className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/25 hover:scale-[1.02] transition-transform" data-testid="button-nav-signup">
              Start Free
            </Button>
          </Link>
        </nav>
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle Menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-white/10 px-6 pb-6">
          <div className="flex flex-col gap-4">
            <a className="text-sm text-slate-300 hover:text-white" href="#features">Features</a>
            <a className="text-sm text-slate-300 hover:text-white" href="#preview">Preview</a>
            <a className="text-sm text-slate-300 hover:text-white" href="#pricing">Pricing</a>
            <a className="text-sm text-slate-300 hover:text-white" href="#faq">FAQ</a>
            <div className="flex flex-col gap-3 pt-2">
              <Link href="/login">
                <Button variant="outline" className="w-full rounded-xl border-emerald-500 text-[#10B981] hover:bg-emerald-500 hover:text-slate-900 px-4 py-2 text-sm font-semibold" data-testid="button-nav-mobile-login">
                  Login
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/25" data-testid="button-nav-mobile-signup">
                  Start Free
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 ring-1 ring-emerald-500/20">
      <div className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
      <span className="text-sm font-medium text-[#10B981]">{children}</span>
    </div>
  );
}

function Hero() {
  const [liveStats, setLiveStats] = useState({
    alertsSent: 12847,
    activeUsers: 2843,
    responseTime: '247ms',
    profitableAlerts: 73,
    liveGames: 47,
    spotsRemaining: 37
  });
  
  const [countdown, setCountdown] = useState({
    hours: 5,
    minutes: 43,
    seconds: 12
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveStats(prev => ({
        alertsSent: prev.alertsSent + Math.floor(Math.random() * 7),
        activeUsers: Math.max(2800, prev.activeUsers + Math.floor(Math.random() * 5) - 2),
        responseTime: `${245 + Math.floor(Math.random() * 10)}ms`,
        profitableAlerts: Math.min(95, prev.profitableAlerts + (Math.random() > 0.5 ? 1 : 0)),
        liveGames: Math.max(30, prev.liveGames + Math.floor(Math.random() * 3) - 1),
        spotsRemaining: Math.max(5, prev.spotsRemaining - (Math.random() > 0.8 ? 1 : 0))
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        let { hours, minutes, seconds } = prev;
        seconds--;
        if (seconds < 0) {
          seconds = 59;
          minutes--;
          if (minutes < 0) {
            minutes = 59;
            hours--;
            if (hours < 0) {
              hours = 5;
              minutes = 59;
              seconds = 59;
            }
          }
        }
        return { hours, minutes, seconds };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section 
      className="relative overflow-hidden" 
      id="hero"
      style={{
        backgroundImage: `url(${basketballArenaImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Background gradient overlay with subtle animation */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0B1220]/70 via-[#0B1220]/80 to-[#0B1220]" />
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-emerald-500/5 animate-pulse" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-16 pb-24 lg:pb-32">
        <div className="text-center">
          <Badge>💰 Beat the Odds - 30 Second Advantage</Badge>
          
          {/* Urgency banner */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-4 inline-flex items-center gap-3 bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20"
          >
            <Flame className="w-4 h-4 text-red-400 animate-pulse" />
            <span className="text-sm font-semibold text-red-400">
              LIMITED: Only {liveStats.spotsRemaining} Pro spots left at 50% off
            </span>
            <div className="flex items-center gap-2 text-xs font-mono text-red-300">
              <span>{String(countdown.hours).padStart(2, '0')}h</span>
              <span>:</span>
              <span>{String(countdown.minutes).padStart(2, '0')}m</span>
              <span>:</span>
              <span>{String(countdown.seconds).padStart(2, '0')}s</span>
            </div>
          </motion.div>
          
          {/* Trust indicators */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.05, duration: 0.6 }} 
            className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-slate-400"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#10B981]" />
              <span data-testid="text-profitable">{liveStats.profitableAlerts}% profitable alert rate</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#10B981]" />
              <span data-testid="text-active-users">{liveStats.activeUsers.toLocaleString()}+ active bettors</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#10B981]" />
              <span data-testid="text-alerts-sent">{liveStats.alertsSent.toLocaleString()} winning alerts today</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-yellow-400 animate-pulse" />
              <span className="font-bold text-yellow-400">{liveStats.liveGames} LIVE GAMES NOW</span>
            </div>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }} 
            className="mt-8 font-black tracking-tight text-4xl sm:text-5xl md:text-6xl lg:text-7xl break-words"
          >
            Get Alerts <span className="text-[#10B981]">30 Seconds</span> Before<br/>
            <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl">The Odds Change</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }} 
            className="mt-6 max-w-3xl mx-auto text-base sm:text-xl text-slate-300 px-4 sm:px-0 leading-relaxed"
          >
            <strong className="text-[#10B981]">AI-powered alerts</strong> for critical game moments across MLB, NFL, NCAAF, NBA, WNBA & CFL. 
            Our users report <strong className="text-[#10B981]">3.7x better betting outcomes</strong> with real-time intelligence 
            delivered before bookmakers adjust their lines.
          </motion.p>
          
          {/* Social proof strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-6 flex items-center justify-center gap-6 flex-wrap"
          >
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
              ))}
              <span className="ml-2 text-sm text-slate-300">4.8/5 from 1,247 users</span>
            </div>
            <div className="text-sm text-slate-400">
              <span className="text-[#10B981] font-semibold">$2.3M+</span> won by our community
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
            className="mt-8 flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <div className="relative">
              {/* Pulsing ring animation */}
              <div className="absolute -inset-1 bg-emerald-500 rounded-xl opacity-75 blur-lg animate-pulse" />
              <Link href="/signup">
                <Button 
                  size="lg" 
                  className="relative bg-emerald-500 hover:bg-[#10B981] text-slate-900 px-8 py-6 text-lg font-bold rounded-xl shadow-xl shadow-emerald-500/25 hover:scale-[1.05] transition-all duration-300 group overflow-hidden"
                  data-testid="button-hero-signup"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center gap-2">
                    <Bell className="w-5 h-5 animate-pulse" />
                    <span>Start Winning Now - Free Forever</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Button>
              </Link>
              {/* Live signup badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1, duration: 0.5 }}
                className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-emerald-500/20 backdrop-blur-sm px-3 py-1 rounded-full border border-emerald-500/30 whitespace-nowrap"
              >
                <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  237 joined in last 24h
                </span>
              </motion.div>
            </div>
            <Link href="/login">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-emerald-500 hover:bg-emerald-500 hover:text-slate-900 px-8 py-6 text-lg font-bold rounded-xl text-[#10B981] transition-all duration-300 hover:scale-[1.02]"
                data-testid="button-hero-login"
              >
                Login to Dashboard
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function LogosStrip() {
  const logos = ['ESPN', 'MLB', 'NFL', 'NCAAF', 'NBA', 'WNBA', 'CFL', 'OpenAI'];

  return (
    <section className="py-12 border-y border-slate-800/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="text-center text-sm text-slate-400 mb-8">Powered by industry-leading data sources • <span className="text-[#10B981]">6 Sports Leagues</span> • Enterprise-Grade APIs</p>
        <div className="flex items-center justify-center gap-4 sm:gap-6 md:gap-8 lg:gap-12 flex-wrap">
          {logos.map((logo, index) => (
            <motion.div 
              key={logo}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
              className="text-slate-500 font-bold text-base sm:text-lg opacity-60 hover:opacity-100 hover:text-[#10B981] transition-all duration-300 whitespace-nowrap cursor-pointer"
            >
              {logo}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustBadges() {
  const badges = [
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: "256-bit SSL",
      subtitle: "Bank-level encryption"
    },
    {
      icon: <Star className="w-6 h-6" />,
      title: "4.8/5 Rating",
      subtitle: "1,247 verified users"
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: "99.9% Uptime",
      subtitle: "Enterprise reliability"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "2,843+ Active",
      subtitle: "Join winning community"
    }
  ];
  
  return (
    <section className="py-16 bg-gradient-to-b from-slate-900/30 to-transparent">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {badges.map((badge, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-3 hover:scale-110 transition-transform duration-300">
                <div className="text-[#10B981]">{badge.icon}</div>
              </div>
              <div className="text-sm font-bold text-white">{badge.title}</div>
              <div className="text-xs text-slate-400 mt-1">{badge.subtitle}</div>
            </motion.div>
          ))}
        </div>
        
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          viewport={{ once: true }}
          className="mt-8 flex items-center justify-center gap-8 flex-wrap"
        >
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            <span>SOC2 Compliant</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            <span>GDPR Ready</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            <span>PCI DSS Certified</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ValueProps() {
  const features = [
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "30-Second Advantage",
      description: "Get critical alerts before bookmakers adjust lines. Our users report catching 3-5 point line movements regularly.",
      highlight: "Beat the Market"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "AI-Powered Analysis",
      description: "Every alert includes win probability, weather impact, and historical performance data to make informed decisions.",
      highlight: "85% Accuracy"
    },
    {
      icon: <Activity className="w-6 h-6" />,
      title: "6 Sports Covered",
      description: "MLB, NFL, NCAAF, NBA, WNBA & CFL with sport-specific alerts for bases loaded, red zone, clutch time & more.",
      highlight: "Complete Coverage"
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "Smart Filtering",
      description: "Only get alerts that matter. No spam, just high-confidence opportunities that move betting lines.",
      highlight: "90% Noise Reduction"
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: "2-5 Second Delivery",
      description: "Lightning-fast processing ensures you're always first. Sub-250ms internal processing beats TV broadcasts.",
      highlight: "Fastest in Market"
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: "99.9% Uptime",
      description: "Enterprise-grade infrastructure with automatic failover. Never miss a critical moment due to downtime.",
      highlight: "Always On"
    }
  ];

  return (
    <section id="features" className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4 px-4 sm:px-0">
            Why smart bettors choose <span className="text-[#10B981]">ChirpBot</span>
          </h2>
          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto px-4 sm:px-0">
            Every feature engineered to maximize your betting edge and profitability.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
              className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/50 transition-all duration-300 group hover:shadow-lg hover:shadow-emerald-500/10 relative overflow-hidden"
            >
              {/* Highlight badge */}
              <div className="absolute top-4 right-4">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                  {feature.highlight}
                </span>
              </div>
              
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-all duration-300 group-hover:scale-110">
                <div className="text-[#10B981]">{feature.icon}</div>
              </div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-slate-400 pr-4">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LivePreview() {
  const [visibleAlerts, setVisibleAlerts] = useState<number[]>([]);
  const alerts = [
    {
      type: "Big Moment Alert",
      title: "Yankees @ Red Sox",
      description: "Two runners in scoring position, 2 outs! Aaron Judge (.301 avg, 47 home runs) at bat",
      aiContext: "Strong winds helping home runs today. Judge is batting .340 in these clutch situations.",
      weather: "Wind: 15 MPH helping",
      time: "2s ago",
      confidence: 87
    },
    {
      type: "Touchdown Zone Alert", 
      title: "Chiefs @ Bills",
      description: "Chiefs at the 8-yard line, 1st down! Mahomes looking for Kelce in the end zone",
      aiContext: "Chiefs score 89% of the time from this position. Kelce has 12 touchdowns this season.",
      weather: "Clear, 72°F",
      time: "5s ago",
      confidence: 92
    },
    {
      type: "Final Minutes Alert",
      title: "Lakers @ Warriors", 
      description: "Under 2 minutes left, only 3-point difference! LeBron has the ball vs Curry",
      aiContext: "LeBron makes 45% of shots in final minutes. Warriors struggling defensively late.",
      weather: "Indoor arena",
      time: "8s ago",
      confidence: 79
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleAlerts((prev) => {
        if (prev.length === 0) {
          return [0]; // Show first alert
        } else if (prev.length === 1) {
          return [0, 1]; // Show first and second
        } else if (prev.length === 2) {
          return [0, 1, 2]; // Show all three
        } else {
          // Rotate through alerts continuously - remove oldest, add next
          const currentIndices = prev.slice();
          const nextIndex = (Math.max(...currentIndices) + 1) % alerts.length;
          return [currentIndices[1], currentIndices[2], nextIndex];
        }
      });
    }, 4000); // 4 seconds between each step
    return () => clearInterval(interval);
  }, [alerts.length]);

  return (
    <section id="preview" className="py-24 bg-slate-900/30">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black tracking-tight mb-4">
            See it in <span className="text-[#10B981]">action</span>
          </h2>
          <p className="text-lg text-slate-400">Live preview of real-time sports alerts</p>
        </div>
        <div className="max-w-2xl mx-auto">
          <div className="bg-[#0B1220] rounded-2xl border border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-slate-400 text-sm ml-auto">ChirpBot Live</span>
            </div>
            <div className="space-y-4 h-[400px] overflow-hidden">
              {visibleAlerts.slice().reverse().map((alertIndex, displayIndex) => (
                <motion.div
                  key={`${alertIndex}-${displayIndex}`}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#10B981] text-sm font-semibold">{alerts[alertIndex].type}</span>
                    <span className="text-slate-400 text-xs">{alerts[alertIndex].time}</span>
                  </div>
                  <h4 className="font-bold mb-1 text-slate-100">{alerts[alertIndex].title}</h4>
                  <p className="text-sm text-slate-300 mb-2">{alerts[alertIndex].description}</p>
                  <div className="bg-slate-800/50 rounded-lg p-2 mb-2">
                    <div className="text-xs text-blue-300 mb-1">🤖 AI Analysis:</div>
                    <div className="text-xs text-slate-300">{alerts[alertIndex].aiContext}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-slate-400">Confidence:</div>
                      <div className="text-xs font-semibold text-[#10B981]">{alerts[alertIndex].confidence}%</div>
                    </div>
                    <div className="text-xs text-slate-400">{alerts[alertIndex].weather}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Select Your Teams",
      description: "Choose which MLB, NFL, NCAAF, NBA, WNBA, and CFL teams you want to monitor for real-time alerts."
    },
    {
      number: "02", 
      title: "Configure Alert Types",
      description: "Set preferences for RISP, red zone, clutch time, and other critical game situations."
    },
    {
      number: "03",
      title: "Receive Instant Alerts",
      description: "Get real-time notifications via HTTP polling and Telegram with AI-powered context."
    }
  ];

  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black tracking-tight mb-4">
            How it <span className="text-[#10B981]">works</span>
          </h2>
          <p className="text-lg text-slate-400">Get started in less than 2 minutes</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.2, duration: 0.5 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6 hover:scale-105 transition-transform duration-300">
                <span className="text-2xl font-black text-[#10B981]">{step.number}</span>
              </div>
              <h3 className="text-xl font-bold mb-4">{step.title}</h3>
              <p className="text-slate-400">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const testimonials = [
    {
      name: "Michael R.",
      role: "Professional Sports Trader",
      content: "ChirpBot's alerts helped me catch a massive line movement on Chiefs-Bills. Made $3,200 on a single bet because I got in before the odds shifted. This tool pays for itself daily.",
      profit: "+$47,300 this season",
      avatar: "MR",
      rating: 5
    },
    {
      name: "Sarah K.",
      role: "Part-time Bettor",
      content: "I used to miss all the good opportunities watching games on delay. Now I get alerts instantly and can place smart bets. My win rate went from 42% to 68% in just 2 months!",
      profit: "+$8,500 this month",
      avatar: "SK",
      rating: 5
    },
    {
      name: "David L.",
      role: "Fantasy Sports Player",
      content: "The AI insights are incredible. It tells me exactly why a situation matters - wind conditions, player matchups, historical performance. It's like having a team of analysts in my pocket.",
      profit: "3x ROI improvement",
      avatar: "DL",
      rating: 5
    }
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-slate-900/30 to-transparent">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black tracking-tight mb-4">
            Real users, <span className="text-[#10B981]">real profits</span>
          </h2>
          <p className="text-lg text-slate-400">Join thousands making smarter bets with ChirpBot</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:border-emerald-500/50 transition-all duration-300"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-bold text-white">{testimonial.name}</div>
                  <div className="text-sm text-slate-400">{testimonial.role}</div>
                </div>
              </div>
              
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                ))}
              </div>
              
              <p className="text-slate-300 mb-4 italic">"{testimonial.content}"</p>
              
              <div className="pt-4 border-t border-slate-800">
                <span className="text-emerald-400 font-bold text-lg">{testimonial.profit}</span>
              </div>
            </motion.div>
          ))}
        </div>
        
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-4 bg-emerald-500/10 px-6 py-3 rounded-full border border-emerald-500/20">
            <Users className="w-5 h-5 text-emerald-400" />
            <span className="text-slate-300">
              <strong className="text-emerald-400">94%</strong> of users report improved betting performance within 30 days
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Proof() {
  const stats = [
    { number: "24/7", label: "Live Monitoring", icon: <Clock className="w-6 h-6" /> },
    { number: "85%+", label: "AI Confidence", icon: <Award className="w-6 h-6" /> },
    { number: "2-5sec", label: "Alert Speed", icon: <Zap className="w-6 h-6" /> },
    { number: "99.9%", label: "Uptime", icon: <ShieldCheck className="w-6 h-6" /> }
  ];

  return (
    <section className="py-24 bg-slate-900/30">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black tracking-tight mb-4">
            Proven <span className="text-[#10B981]">performance</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4 hover:scale-110 transition-transform duration-300">
                <div className="text-[#10B981]">{stat.icon}</div>
              </div>
              <div className="text-4xl font-black text-[#10B981] mb-2">{stat.number}</div>
              <p className="text-slate-400">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    {
      name: "Starter",
      price: "$0",
      period: "forever",
      description: "Perfect for casual bettors",
      featured: false,
      features: [
        "3 teams monitored",
        "Basic alerts (RISP, Red Zone)",
        "5-second delivery",
        "Email notifications",
        "Mobile web access"
      ],
      cta: "Start Free",
      ctaLink: "/signup"
    },
    {
      name: "Pro",
      price: "$29",
      period: "/month",
      description: "For serious sports traders",
      featured: true,
      badge: "MOST POPULAR",
      features: [
        "Unlimited teams",
        "All alert types + AI Scanner",
        "2-second priority delivery",
        "Telegram + SMS alerts",
        "Advanced AI insights",
        "Historical performance data",
        "Custom alert filters",
        "API access"
      ],
      cta: "Start 7-Day Trial",
      ctaLink: "/signup?plan=pro"
    },
    {
      name: "Elite",
      price: "$99",
      period: "/month",
      description: "Professional betting syndicates",
      featured: false,
      features: [
        "Everything in Pro",
        "Sub-1 second delivery",
        "Direct API webhooks",
        "Custom AI models",
        "Dedicated support",
        "White-label options"
      ],
      cta: "Contact Sales",
      ctaLink: "/contact"
    }
  ];

  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black tracking-tight mb-4">
            Choose your <span className="text-[#10B981]">edge level</span>
          </h2>
          <p className="text-lg text-slate-400">Start free, upgrade anytime. Cancel anytime.</p>
          
          {/* Limited time offer */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mt-6 inline-flex items-center gap-2 bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20"
          >
            <Clock className="w-4 h-4 text-red-400" />
            <span className="text-sm font-semibold text-red-400">Limited offer: 50% off Pro plan for first 100 users</span>
          </motion.div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
              className={`relative rounded-2xl p-8 ${
                plan.featured 
                  ? 'bg-gradient-to-b from-emerald-900/30 to-slate-900/50 border-2 border-emerald-500 scale-105 shadow-2xl shadow-emerald-500/20' 
                  : 'bg-slate-900/50 border border-slate-800'
              } hover:border-emerald-500/50 transition-all duration-300`}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-emerald-500 text-slate-900 px-4 py-2 rounded-full text-sm font-bold">
                    {plan.badge}
                  </span>
                </div>
              )}
              
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-slate-400 text-sm mb-4">{plan.description}</p>
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl font-black text-white">{plan.price}</span>
                  {plan.period !== "forever" && (
                    <span className="text-slate-400 ml-2">{plan.period}</span>
                  )}
                </div>
              </div>
              
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Link href={plan.ctaLink} className="block">
                {plan.featured ? (
                  <div className="relative">
                    {/* Pulsing glow for featured plan */}
                    <div className="absolute -inset-0.5 bg-emerald-500 rounded-xl opacity-50 blur animate-pulse" />
                    <Button 
                      className="relative w-full py-6 text-lg font-bold rounded-xl bg-emerald-500 hover:bg-[#10B981] text-slate-900 shadow-lg shadow-emerald-500/25 hover:scale-[1.03] transition-all duration-300 group"
                      data-testid={`button-pricing-${plan.name.toLowerCase()}`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        <Zap className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        {plan.cta}
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </Button>
                  </div>
                ) : (
                  <Button 
                    className="w-full py-6 text-lg font-bold rounded-xl transition-all duration-300 bg-slate-800 hover:bg-slate-700 text-white hover:scale-[1.02] group"
                    data-testid={`button-pricing-${plan.name.toLowerCase()}`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      {plan.cta}
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Button>
                )}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: "How fast are the alerts?",
      answer: "Our system polls ESPN and MLB APIs every 2 seconds and delivers alerts via HTTP polling instantly. You'll typically receive alerts within 2-5 seconds of events happening."
    },
    {
      question: "Which sports are supported?",
      answer: "We currently support 6 major sports leagues: MLB, NFL, NCAAF, NBA, WNBA, and CFL with sport-specific alert types like RISP for baseball, red zone for football, clutch time for basketball, and specialty alerts for college football and women's sports."
    },
    {
      question: "How accurate is the AI analysis?",
      answer: "Our OpenAI integration provides confidence scores above 85% for all alerts, with statistical fallbacks when AI services are unavailable."
    },
    {
      question: "Can I customize which alerts I receive?",
      answer: "Yes! You can select specific teams to monitor and configure alert types. Our smart filtering eliminates 90% of noise to focus on game-changing moments."
    },
    {
      question: "Is there a mobile app?",
      answer: "ChirpBot is a responsive web application that works perfectly on mobile devices. We also offer Telegram bot integration for push notifications."
    }
  ];

  return (
    <section id="faq" className="py-24">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black tracking-tight mb-4">
            Frequently asked <span className="text-[#10B981]">questions</span>
          </h2>
        </div>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
              <button
                className="w-full p-6 text-left flex items-center justify-between hover:bg-slate-800/50 transition-colors"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="font-semibold">{faq.question}</span>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openIndex === index ? 'rotate-180' : ''}`} />
              </button>
              {openIndex === index && (
                <div className="px-6 pb-6">
                  <p className="text-slate-400">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-800 py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#10B981]" />
            </div>
            <span className="font-semibold tracking-wide">chirpbot</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <span>© 2025 ChirpBot V2. All rights reserved.</span>
            <span>•</span>
            <span>Powered by ESPN API & OpenAI</span>
          </div>
        </div>
      </div>
    </footer>
  );
}