import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, SignalHigh, Zap, ShieldCheck, TimerReset, Activity, Wifi, ChevronDown, Play, Star, Users, TrendingUp, Award, Target, Clock, Globe, Eye, Bolt } from "lucide-react";
import { Button } from "@/components/ui/button";
import basketballArenaImage from '@assets/generated_images/Basketball_arena_game_moment_4c760cd5.png';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 antialiased selection:bg-emerald-500/30 overflow-x-hidden">
      <Nav />
      <Hero />
      <LogosStrip />
      <ValueProps />
      <LivePreview />
      <HowItWorks />
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
    alertsSent: 1247,
    activeUsers: 2843,
    responseTime: '247ms'
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveStats(prev => ({
        alertsSent: prev.alertsSent + Math.floor(Math.random() * 3),
        activeUsers: Math.max(2800, prev.activeUsers + Math.floor(Math.random() * 5) - 2),
        responseTime: `${245 + Math.floor(Math.random() * 10)}ms`
      }));
    }, 5000);
    return () => clearInterval(interval);
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
          <Badge>⚡ Live Sports Intelligence Platform</Badge>
          
          {/* Trust indicators */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.05, duration: 0.6 }} 
            className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-slate-400"
          >
            <div className="flex items-center gap-2">
              <Bolt className="w-4 h-4 text-[#10B981]" />
              <span data-testid="text-alerts-sent">{liveStats.alertsSent.toLocaleString()} total alerts sent today</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#10B981]" />
              <span data-testid="text-active-users">{liveStats.activeUsers.toLocaleString()} users monitoring live</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#10B981]" />
              <span data-testid="text-processing-time">Processing: &lt;250ms</span>
            </div>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }} 
            className="mt-8 font-black tracking-tight text-4xl sm:text-5xl md:text-6xl lg:text-7xl break-words"
          >
            Never Miss a <span className="text-[#10B981]">Game-Changing</span> Moment
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }} 
            className="mt-6 max-w-3xl mx-auto text-base sm:text-xl text-slate-300 px-4 sm:px-0 leading-relaxed"
          >
            Real-time alerts for <strong className="text-[#10B981]">6 major sports leagues</strong> delivered in 2-5 seconds with sub-250ms internal processing. Join <strong>10,000+ sports fans</strong> who get alerts 30 seconds before TV broadcasts.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
            className="mt-8 flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/signup">
              <Button 
                size="lg" 
                className="bg-emerald-500 hover:bg-[#10B981] text-slate-900 px-8 py-6 text-lg font-bold rounded-xl shadow-xl shadow-emerald-500/25 hover:scale-[1.02] transition-all duration-300 group relative overflow-hidden"
                data-testid="button-hero-signup"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-[#10B981] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative">Start Free Trial - No Credit Card</span>
                <ArrowRight className="ml-2 w-5 h-5 relative group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/login">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-emerald-500 hover:bg-emerald-500 hover:text-slate-900 px-8 py-6 text-lg font-bold rounded-xl text-[#10B981] transition-all duration-300"
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

function ValueProps() {
  const features = [
    {
      icon: <SignalHigh className="w-6 h-6" />,
      title: "Real-Time Alerts",
      description: "Instant notifications for RISP, red zone drives, and clutch situations with AI-powered context."
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: "Noise Reduction",
      description: "Smart filtering eliminates 90% of irrelevant alerts, focusing only on game-changing moments."
    },
    {
      icon: <Activity className="w-6 h-6" />,
      title: "6-League Coverage",
      description: "Complete coverage across MLB, NFL, NCAAF, NBA, WNBA, and CFL with sport-specific alert types tailored to each league."
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Fast Processing Pipeline",
      description: "Sub-250ms internal processing with 2-5 second end-to-end delivery via WebSocket. Get alerts before they hit TV broadcasts."
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "Precision Targeting",
      description: "85%+ AI confidence scoring ensures you only get alerts that truly matter."
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: "Enterprise Stability",
      description: "Production-grade reliability with automatic retries and failover systems."
    }
  ];

  return (
    <section id="features" className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4 px-4 sm:px-0">
            Built for <span className="text-[#10B981]">professional</span> sports monitoring
          </h2>
          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto px-4 sm:px-0">
            Every feature designed to give you the edge in fast-moving sports betting and trading markets.
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
              className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/50 transition-all duration-300 group hover:shadow-lg hover:shadow-emerald-500/10"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-all duration-300 group-hover:scale-110">
                <div className="text-[#10B981]">{feature.icon}</div>
              </div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-slate-400">{feature.description}</p>
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
      description: "Get real-time notifications via WebSocket and Telegram with AI-powered context."
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
  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black tracking-tight mb-4">
            Simple <span className="text-[#10B981]">pricing</span>
          </h2>
          <p className="text-lg text-slate-400">Start free, upgrade when you need more</p>
        </div>
        <div className="max-w-lg mx-auto">
          <div className="bg-slate-900/50 border border-emerald-500/50 rounded-2xl p-8 relative hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-emerald-500 text-slate-900 px-4 py-2 rounded-full text-sm font-bold">
                Free Forever
              </span>
            </div>
            <div className="text-center mb-8">
              <div className="text-5xl font-black mb-2">$0</div>
              <p className="text-slate-400">Free tier includes:</p>
            </div>
            <ul className="space-y-4 mb-8">
              {[
                "Real-time alerts for all sports",
                "AI-powered context analysis", 
                "WebSocket live updates",
                "Team monitoring dashboard",
                "Telegram integration"
              ].map((feature, index) => (
                <li key={index} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                  <span className="text-slate-300">{feature}</span>
                </li>
              ))}
            </ul>
            <Link href="/signup" className="block">
              <Button className="w-full bg-emerald-500 hover:bg-[#10B981] text-slate-900 py-6 text-lg font-bold rounded-xl shadow-lg shadow-emerald-500/25 hover:scale-[1.02] transition-all duration-300" data-testid="button-pricing-signup">
                Start Free Now
              </Button>
            </Link>
          </div>
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
      answer: "Our system polls ESPN and MLB APIs every 2 seconds and delivers alerts via WebSocket instantly. You'll typically receive alerts within 2-5 seconds of events happening."
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