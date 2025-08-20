import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, SignalHigh, Zap, ShieldCheck, TimerReset, Activity, Wifi, ChevronDown, Play, Star, Users, TrendingUp, Award, Target, Clock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

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
            <Zap className="w-4 h-4 text-emerald-400" />
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
                <Button variant="outline" className="w-full rounded-xl border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-slate-900 px-4 py-2 text-sm font-semibold" data-testid="button-nav-mobile-login">
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
      <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
      <span className="text-sm font-medium text-emerald-200">{children}</span>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden" id="hero">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0B1220]/60 to-[#0B1220]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-16 pb-24 lg:pb-32">
        <div className="text-center">
          <Badge>Live Sports Signals</Badge>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.6, ease: "easeOut" }} 
            className="mt-6 font-black tracking-tight text-4xl sm:text-5xl md:text-6xl lg:text-7xl break-words"
          >
            Catch the <span className="text-emerald-400">moment</span>. Bet the <span className="text-emerald-400">edge</span>.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.1, duration: 0.6, ease: "easeOut" }} 
            className="mt-5 max-w-2xl mx-auto text-base sm:text-lg text-slate-300 px-4 sm:px-0"
          >
            Real‑time MLB/NFL alerts with ruthless noise‑reduction. Built for sharps, teams, and high‑tempo traders.
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
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 px-8 py-6 text-lg font-bold rounded-xl shadow-xl shadow-emerald-500/25 hover:scale-[1.02] transition-transform"
                data-testid="button-hero-signup"
              >
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-emerald-500 hover:bg-emerald-500 hover:text-slate-900 px-8 py-6 text-lg font-bold rounded-xl text-emerald-400"
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
  const logos = ['ESPN', 'MLB', 'NFL', 'NBA', 'NHL', 'OpenAI'];
  
  return (
    <section className="py-12 border-y border-slate-800/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="text-center text-sm text-slate-400 mb-8">Powered by industry-leading data sources</p>
        <div className="flex items-center justify-center gap-4 sm:gap-6 md:gap-8 lg:gap-12 flex-wrap">
          {logos.map((logo) => (
            <div key={logo} className="text-slate-500 font-bold text-base sm:text-lg opacity-60 hover:opacity-100 transition-opacity whitespace-nowrap">
              {logo}
            </div>
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
      title: "Multi-Sport Coverage",
      description: "Complete coverage across MLB, NFL, NBA, and NHL with sport-specific alert types."
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Ultra-Fast Delivery",
      description: "2-second polling intervals with WebSocket delivery for the fastest possible alerts."
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
            Built for <span className="text-emerald-400">serious</span> sports monitoring
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
              className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/50 transition-colors group"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                <div className="text-emerald-400">{feature.icon}</div>
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
  const [showSportsbook, setShowSportsbook] = useState(false);
  const alerts = [
    {
      type: "RISP Alert",
      title: "Yankees @ Red Sox",
      description: "RUNNERS ON 2ND & 3RD, 2 OUTS! Aaron Judge (.301 BA, 47 HRs) up to bat",
      aiContext: "15 MPH wind blowing out to right field. Judge has .340 BA with RISP this season.",
      weather: "Wind: 15 MPH → RF",
      time: "2s ago",
      confidence: 87
    },
    {
      type: "Red Zone Alert", 
      title: "Chiefs @ Bills",
      description: "1ST & GOAL at 8-yard line! Mahomes targeting Kelce in critical formation",
      aiContext: "Chiefs are 89% successful from this position. Kelce has 12 red zone TDs this season.",
      weather: "Clear, 72°F",
      time: "5s ago",
      confidence: 92
    },
    {
      type: "Clutch Time",
      title: "Lakers @ Warriors", 
      description: "Under 2 minutes, 3-point game! LeBron has the ball, Curry defending",
      aiContext: "LeBron shoots 45% in clutch time. Warriors allowing 1.02 PPP in final 2 minutes.",
      weather: "Indoor venue",
      time: "8s ago",
      confidence: 79
    }
  ];

  const sportsbooks = [
    {
      name: "DraftKings",
      game: "Yankees @ Red Sox", 
      yankees: "-145",
      redSox: "+125",
      over: "8.5 (-110)",
      under: "8.5 (-110)"
    },
    {
      name: "FanDuel",
      game: "Chiefs @ Bills",
      chiefs: "-3.5 (-108)",
      bills: "+3.5 (-112)", 
      over: "54.5 (-105)",
      under: "54.5 (-115)"
    },
    {
      name: "BetMGM",
      game: "Lakers @ Warriors",
      Lakers: "+4.5 (-110)",
      warriors: "-4.5 (-110)",
      over: "225.5 (-108)",
      under: "225.5 (-112)"
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleAlerts((prev) => {
        if (prev.length === 0) {
          setShowSportsbook(false);
          return [0]; // Show first alert
        } else if (prev.length === 1) {
          return [0, 1]; // Show first and second
        } else if (prev.length === 2) {
          return [0, 1, 2]; // Show all three
        } else {
          // After showing all alerts, slide to show sportsbook
          setTimeout(() => setShowSportsbook(true), 1000);
          setTimeout(() => setShowSportsbook(false), 4000);
          setTimeout(() => setVisibleAlerts([]), 5000);
          return [0, 1, 2]; // Keep all visible while sportsbook shows
        }
      });
    }, 4000); // 4 seconds between each step
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="preview" className="py-24 bg-slate-900/30">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black tracking-tight mb-4">
            See it in <span className="text-emerald-400">action</span>
          </h2>
          <p className="text-lg text-slate-400">Live preview of real-time sports alerts</p>
        </div>
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#0B1220] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 p-6 pb-6">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-slate-400 text-sm ml-auto">ChirpBot Live</span>
            </div>
            
            <div className="relative h-[400px] overflow-hidden">
              {/* Alerts Panel */}
              <motion.div
                animate={{ 
                  x: showSportsbook ? "-50%" : "0%" 
                }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                className="absolute inset-0 px-6 pb-6"
              >
                <div className="space-y-4 min-h-[120px]">
                  {visibleAlerts.slice().reverse().map((alertIndex, displayIndex) => (
                    <motion.div
                      key={`${alertIndex}-${displayIndex}`}
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.1 }}
                      className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-emerald-400 text-sm font-semibold">{alerts[alertIndex].type}</span>
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
                          <div className="text-xs font-semibold text-emerald-400">{alerts[alertIndex].confidence}%</div>
                        </div>
                        <div className="text-xs text-slate-400">{alerts[alertIndex].weather}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Sportsbook Panel */}
              <motion.div
                animate={{ 
                  x: showSportsbook ? "0%" : "100%" 
                }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                className="absolute inset-0 px-6 pb-6 bg-gradient-to-r from-purple-900/20 to-indigo-900/20"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-purple-400 text-lg font-bold">📊 Live Odds</span>
                  <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full">UPDATED</span>
                </div>
                
                <div className="space-y-3">
                  {sportsbooks.map((book, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: showSportsbook ? 1 : 0, x: showSportsbook ? 0 : 20 }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                      className="p-3 rounded-xl border bg-purple-500/5 border-purple-500/20"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-purple-400 text-sm font-semibold">{book.name}</span>
                        <span className="text-slate-400 text-xs">Live</span>
                      </div>
                      <h4 className="font-bold text-slate-100 text-sm mb-2">{book.game}</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-800/30 rounded px-2 py-1">
                          <span className="text-slate-400">ML: </span>
                          <span className="text-green-400 font-semibold">
                            {book.yankees || book.chiefs || book.Lakers}
                          </span>
                        </div>
                        <div className="bg-slate-800/30 rounded px-2 py-1">
                          <span className="text-slate-400">ML: </span>
                          <span className="text-red-400 font-semibold">
                            {book.redSox || book.bills || book.warriors}
                          </span>
                        </div>
                        <div className="bg-slate-800/30 rounded px-2 py-1">
                          <span className="text-slate-400">O: </span>
                          <span className="text-blue-400 font-semibold">{book.over}</span>
                        </div>
                        <div className="bg-slate-800/30 rounded px-2 py-1">
                          <span className="text-slate-400">U: </span>
                          <span className="text-blue-400 font-semibold">{book.under}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
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
      description: "Choose which MLB, NFL, NBA, and NHL teams you want to monitor for alerts."
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
            How it <span className="text-emerald-400">works</span>
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
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-black text-emerald-400">{step.number}</span>
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
    { number: "2sec", label: "Alert Speed", icon: <Zap className="w-6 h-6" /> },
    { number: "99.9%", label: "Uptime", icon: <ShieldCheck className="w-6 h-6" /> }
  ];

  return (
    <section className="py-24 bg-slate-900/30">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black tracking-tight mb-4">
            Proven <span className="text-emerald-400">performance</span>
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
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <div className="text-emerald-400">{stat.icon}</div>
              </div>
              <div className="text-4xl font-black text-emerald-400 mb-2">{stat.number}</div>
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
            Simple <span className="text-emerald-400">pricing</span>
          </h2>
          <p className="text-lg text-slate-400">Start free, upgrade when you need more</p>
        </div>
        <div className="max-w-lg mx-auto">
          <div className="bg-slate-900/50 border border-emerald-500/50 rounded-2xl p-8 relative">
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
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-slate-300">{feature}</span>
                </li>
              ))}
            </ul>
            <Link href="/signup" className="block">
              <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 py-6 text-lg font-bold rounded-xl" data-testid="button-pricing-signup">
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
      answer: "We currently support MLB, NFL, NBA, and NHL with sport-specific alert types like RISP for baseball, red zone for football, and clutch time for basketball."
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
            Frequently asked <span className="text-emerald-400">questions</span>
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
              <Zap className="w-4 h-4 text-emerald-400" />
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