import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, Zap, ChevronDown, Activity, Bell, Clock, Star, Shield, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ChirpBotLogo } from "@/components/ChirpBotLogo";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] },
});

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0D0D0D] text-slate-100 antialiased selection:bg-emerald-500/30 overflow-x-hidden">
      <Nav />
      <Hero />
      <LivePreview />
      <Features />
      <SocialProof />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <Footer />
    </div>
  );
}

/* ─── Nav ─────────────────────────────────────────────────────────────────── */

function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-all duration-300 ${
      scrolled
        ? "bg-[#0D0D0D]/90 border-white/[0.06] shadow-lg shadow-black/20"
        : "bg-[#0D0D0D]/80 border-white/[0.04]"
    }`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <a href="#">
          <ChirpBotLogo size="sm" />
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          <a className="text-[14px] text-slate-400 hover:text-white transition-colors" href="#preview">Preview</a>
          <a className="text-[14px] text-slate-400 hover:text-white transition-colors" href="#features">Features</a>
          <a className="text-[14px] text-slate-400 hover:text-white transition-colors" href="#pricing">Pricing</a>
          <a className="text-[14px] text-slate-400 hover:text-white transition-colors" href="#faq">FAQ</a>
          <Link href="/login">
            <span className="text-[14px] text-slate-400 hover:text-white transition-colors cursor-pointer">Log in</span>
          </Link>
          <Link href="/signup">
            <Button
              className="rounded-full bg-white px-5 py-2 text-[14px] font-medium text-[#0D0D0D] hover:bg-slate-200 transition-colors"
              data-testid="button-nav-signup"
            >
              Get started
            </Button>
          </Link>
        </nav>

        <button className="md:hidden p-2 -mr-2" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-white">
            {open ? (
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="md:hidden overflow-hidden"
          >
            <div className="border-t border-white/[0.06] px-5 pb-6 pt-4 bg-[#0D0D0D]/95 backdrop-blur-xl">
              <div className="flex flex-col gap-5">
                <a className="text-[15px] text-slate-300" href="#preview" onClick={() => setOpen(false)}>Preview</a>
                <a className="text-[15px] text-slate-300" href="#features" onClick={() => setOpen(false)}>Features</a>
                <a className="text-[15px] text-slate-300" href="#pricing" onClick={() => setOpen(false)}>Pricing</a>
                <a className="text-[15px] text-slate-300" href="#faq" onClick={() => setOpen(false)}>FAQ</a>
                <div className="flex flex-col gap-3 pt-3 border-t border-white/[0.06]">
                  <Link href="/login">
                    <Button
                      variant="outline"
                      className="w-full rounded-full border-white/[0.12] text-white hover:bg-white/[0.06]"
                      data-testid="button-nav-mobile-login"
                    >
                      Log in
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button
                      className="w-full rounded-full bg-white text-[#0D0D0D] hover:bg-slate-200 font-medium"
                      data-testid="button-nav-mobile-signup"
                    >
                      Get started
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ─── Hero ────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative pt-24 pb-20 sm:pt-32 sm:pb-28 lg:pt-40 lg:pb-36">
      {/* Subtle gradient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-500/[0.04] rounded-full blur-[120px] pointer-events-none" />

      <div className="relative mx-auto max-w-3xl px-5 text-center">
        <motion.div {...fadeUp(0)} className="inline-flex items-center gap-2 rounded-full bg-emerald-500/[0.08] px-4 py-2 ring-1 ring-emerald-500/20 mb-8">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-[13px] font-medium text-emerald-400">Real-time sports alerts</span>
        </motion.div>

        <motion.h1 {...fadeUp(0.1)} className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display tracking-[-0.03em] leading-[1.1]">
          Know what's happening
          <br />
          <span className="text-emerald-400">before the odds move</span>
        </motion.h1>

        <motion.p {...fadeUp(0.2)} className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
          AI-powered alerts for critical game moments across MLB, NFL, NBA, and more.
          Get notified in seconds, not minutes.
        </motion.p>

        <motion.div {...fadeUp(0.3)} className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href="/signup">
            <Button
              size="lg"
              variant="emerald"
              className="rounded-full px-8 py-6 text-[16px]"
              data-testid="button-hero-signup"
            >
              Get started free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <a href="#preview">
            <Button
              size="lg"
              variant="ghost"
              className="rounded-full text-slate-400 hover:text-white px-8 py-6 text-[16px] font-medium transition-colors"
              data-testid="button-hero-preview"
            >
              See it in action
            </Button>
          </a>
        </motion.div>

        {/* Social proof stats */}
        <motion.div {...fadeUp(0.4)} className="mt-14 flex flex-wrap justify-center gap-8 sm:gap-12 text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white">12,000+</div>
            <div className="text-[13px] text-slate-500 mt-1">Active users</div>
          </div>
          <div className="w-px h-10 bg-white/[0.06] hidden sm:block" />
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white">2.3s</div>
            <div className="text-[13px] text-slate-500 mt-1">Avg delivery</div>
          </div>
          <div className="w-px h-10 bg-white/[0.06] hidden sm:block" />
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-emerald-400">98.7%</div>
            <div className="text-[13px] text-slate-500 mt-1">Uptime</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Live Preview ────────────────────────────────────────────────────────── */

function LivePreview() {
  const [visibleAlerts, setVisibleAlerts] = useState<number[]>([]);
  const [activeSport, setActiveSport] = useState("All");

  const alerts = [
    {
      type: "Bases Loaded",
      sport: "MLB",
      title: "Yankees @ Red Sox",
      description: "Two runners in scoring position, 2 outs. Aaron Judge at bat with a .301 average.",
      context: "Strong winds favoring home runs today. Judge bats .340 in clutch situations.",
      time: "2s ago",
      confidence: 87,
    },
    {
      type: "Red Zone",
      sport: "NFL",
      title: "Chiefs @ Bills",
      description: "Chiefs at the 8-yard line, 1st down. Mahomes targeting Kelce in the end zone.",
      context: "Chiefs convert 89% from this position. Kelce has 12 TDs this season.",
      time: "5s ago",
      confidence: 92,
    },
    {
      type: "Clutch Time",
      sport: "NBA",
      title: "Lakers @ Warriors",
      description: "Under 2 minutes, 3-point game. LeBron has the ball against Curry.",
      context: "LeBron shoots 45% in final 2 minutes. Warriors weak defensively late in games.",
      time: "8s ago",
      confidence: 79,
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleAlerts((prev) => {
        if (prev.length < alerts.length) {
          return [...prev, prev.length];
        }
        const next = (Math.max(...prev) + 1) % alerts.length;
        return [prev[1], prev[2], next];
      });
    }, 3500);
    return () => clearInterval(interval);
  }, [alerts.length]);

  return (
    <section id="preview" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-[-0.03em]">
            See it in action
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Live preview of the alerts you'll receive
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="bg-[#161B22] rounded-2xl ring-1 ring-white/[0.06] overflow-hidden shadow-2xl shadow-black/40">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.06]">
              <div className="w-3 h-3 rounded-full bg-white/[0.08]" />
              <div className="w-3 h-3 rounded-full bg-white/[0.08]" />
              <div className="w-3 h-3 rounded-full bg-white/[0.08]" />
              <span className="text-[13px] text-slate-500 ml-auto font-mono">ChirpBot</span>
            </div>

            {/* Sport filter tabs */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
              {["All", "MLB", "NFL", "NBA"].map((sport) => (
                <button
                  key={sport}
                  onClick={() => setActiveSport(sport)}
                  className={`text-[12px] font-medium px-3 py-1.5 rounded-full transition-colors duration-200 cursor-pointer ${
                    activeSport === sport
                      ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25"
                      : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]"
                  }`}
                >
                  {sport}
                </button>
              ))}
            </div>

            {/* Alert feed */}
            <div className="p-5 space-y-3 min-h-[420px]">
              {visibleAlerts.length === 0 && (
                <div className="flex items-center justify-center h-[380px] text-slate-500 text-[15px]">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Waiting for alerts...
                  </div>
                </div>
              )}
              {visibleAlerts
                .slice()
                .reverse()
                .filter((alertIndex) => activeSport === "All" || alerts[alertIndex].sport === activeSport)
                .map((alertIndex) => {
                  const alert = alerts[alertIndex];
                  return (
                    <div
                      key={`${alertIndex}-${visibleAlerts.join("-")}`}
                      className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] p-4 animate-[fadeSlideIn_0.4s_ease-out]"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                            {alert.sport}
                          </span>
                          <span className="text-[13px] font-medium text-slate-300">
                            {alert.type}
                          </span>
                        </div>
                        <span className="text-[12px] text-slate-500">{alert.time}</span>
                      </div>
                      <h4 className="text-[15px] font-semibold text-white mb-1">{alert.title}</h4>
                      <p className="text-[14px] text-slate-400 mb-3 leading-relaxed">{alert.description}</p>
                      <div className="bg-white/[0.03] rounded-lg px-3 py-2.5 ring-1 ring-white/[0.04]">
                        <div className="text-[12px] text-slate-500 mb-1">AI Analysis</div>
                        <div className="text-[13px] text-slate-300 leading-relaxed">{alert.context}</div>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] text-slate-500">Confidence</span>
                          <span className="text-[12px] font-medium text-emerald-400">{alert.confidence}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Features ────────────────────────────────────────────────────────────── */

function Features() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-[-0.03em]">
            Built for speed and clarity
          </h2>
          <p className="mt-4 text-lg text-slate-400 max-w-xl mx-auto">
            Everything you need to stay ahead of the game. Nothing you don't.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Speed — hero feature, spans 2 cols */}
          <div className="sm:col-span-2 group rounded-2xl bg-[#161B22] ring-1 ring-white/[0.06] p-8 hover:ring-emerald-500/20 hover:translate-y-[-2px] transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center mb-5 text-emerald-400 group-hover:bg-emerald-500/15 transition-colors">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Seconds, not minutes</h3>
            <p className="text-[15px] text-slate-400 leading-relaxed max-w-md">
              Alerts delivered within 2-5 seconds of game events. Sub-250ms processing beats TV broadcasts.
            </p>
            <div className="mt-6 flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-400">2s</div>
                <div className="text-[12px] text-slate-500">Delivery</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-400">&lt;250ms</div>
                <div className="text-[12px] text-slate-500">Processing</div>
              </div>
            </div>
          </div>

          {/* AI context */}
          <div className="group rounded-2xl bg-[#161B22] ring-1 ring-white/[0.06] p-7 hover:ring-emerald-500/20 hover:translate-y-[-2px] transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center mb-5 text-emerald-400 group-hover:bg-emerald-500/15 transition-colors">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-[17px] font-semibold text-white mb-2">AI-powered context</h3>
            <p className="text-[15px] text-slate-400 leading-relaxed">
              Every alert includes win probability, weather impact, and player matchup data so you can act with confidence.
            </p>
          </div>

          {/* Signal not noise */}
          <div className="group rounded-2xl bg-[#161B22] ring-1 ring-white/[0.06] p-7 hover:ring-emerald-500/20 hover:translate-y-[-2px] transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center mb-5 text-emerald-400 group-hover:bg-emerald-500/15 transition-colors">
              <Bell className="w-5 h-5" />
            </div>
            <h3 className="text-[17px] font-semibold text-white mb-2">Signal, not noise</h3>
            <p className="text-[15px] text-slate-400 leading-relaxed">
              Smart filtering surfaces only high-impact moments: bases loaded, red zone, clutch time, momentum shifts.
            </p>
          </div>

          {/* Multi-sport coverage — spans 2 cols */}
          <div className="sm:col-span-2 group rounded-2xl bg-[#161B22] ring-1 ring-white/[0.06] p-7 hover:ring-emerald-500/20 hover:translate-y-[-2px] transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center mb-5 text-emerald-400 group-hover:bg-emerald-500/15 transition-colors">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-[17px] font-semibold text-white mb-2">Multi-sport coverage</h3>
            <p className="text-[15px] text-slate-400 leading-relaxed">
              MLB, NFL, NBA, NHL, WNBA, CFL, and NCAAF — each with sport-specific alert types tuned for its most critical moments.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ────────────────────────────────────────────────────────── */

function HowItWorks() {
  const steps = [
    {
      number: "1",
      title: "Pick your sports",
      description: "Choose which teams and leagues you want to follow.",
    },
    {
      number: "2",
      title: "Set your alerts",
      description: "Configure which game situations matter to you.",
    },
    {
      number: "3",
      title: "Stay ahead",
      description: "Get real-time alerts with AI context via web and Telegram.",
    },
  ];

  return (
    <section className="py-20 sm:py-28 border-t border-white/[0.04]">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-[-0.03em]">
            Up and running in 2 minutes
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-10 sm:gap-8">
          {steps.map((step, index) => (
            <div key={index} className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center mx-auto mb-5">
                <span className="text-lg font-bold text-emerald-400">{step.number}</span>
              </div>
              <h3 className="text-[17px] font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-[15px] text-slate-400 leading-relaxed max-w-xs mx-auto">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing ─────────────────────────────────────────────────────────────── */

function Pricing() {
  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Get started with the basics",
      features: [
        "3 teams monitored",
        "Core alert types",
        "Web notifications",
        "Mobile-friendly dashboard",
      ],
      cta: "Get started",
      ctaLink: "/signup",
      featured: false,
    },
    {
      name: "Pro",
      price: "$29",
      period: "/mo",
      description: "For those who want every edge",
      features: [
        "Unlimited teams",
        "All alert types + AI Scanner",
        "Telegram + priority delivery",
        "Advanced AI insights",
        "Historical performance data",
        "Custom alert filters",
      ],
      cta: "Start 7-day trial",
      ctaLink: "/signup?plan=pro",
      featured: true,
    },
  ];

  return (
    <section id="pricing" className="py-20 sm:py-28 border-t border-white/[0.04]">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-[-0.03em]">
            Simple pricing
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Start free. Upgrade when you're ready.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-8 ${
                plan.featured
                  ? "bg-[#161B22] ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/[0.08]"
                  : "bg-[#161B22] ring-1 ring-white/[0.06]"
              }`}
            >
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                  {plan.featured && (
                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full ring-1 ring-emerald-500/20">
                      Popular
                    </span>
                  )}
                </div>
                <p className="text-[14px] text-slate-400 mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  {plan.period !== "forever" && (
                    <span className="text-[15px] text-slate-500">{plan.period}</span>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="text-emerald-400">
                        <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-[15px] text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href={plan.ctaLink} className="block">
                <Button
                  variant={plan.featured ? "emerald" : "outline"}
                  className={`w-full rounded-full py-5 text-[15px] ${
                    plan.featured
                      ? ""
                      : "bg-white/[0.06] hover:bg-white/[0.1] text-white ring-1 ring-white/[0.08] border-0"
                  }`}
                  data-testid={`button-pricing-${plan.name.toLowerCase()}`}
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ──────────────────────────────────────────────────────────────────── */

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: "How fast are the alerts?",
      answer:
        "Alerts are delivered within 2-5 seconds of game events. Our system polls live data feeds every 2 seconds with sub-250ms internal processing.",
    },
    {
      question: "Which sports are supported?",
      answer:
        "We currently support MLB, NFL, NBA, NHL, WNBA, CFL, and NCAAF with sport-specific alert types. Each sport has tailored alerts for its most critical moments.",
    },
    {
      question: "What does the AI analysis include?",
      answer:
        "Each alert includes a confidence score, contextual analysis (player stats, weather conditions, historical matchup data), and a plain-English summary of why the moment matters.",
    },
    {
      question: "Can I customize which alerts I receive?",
      answer:
        "Yes. You can select specific teams, configure alert types (bases loaded, red zone, clutch time, etc.), and set confidence thresholds to control what you see.",
    },
    {
      question: "Is there a mobile app?",
      answer:
        "ChirpBot is a responsive web app that works on any device. We also support Telegram bot integration for push notifications.",
    },
  ];

  return (
    <section id="faq" className="py-20 sm:py-28 border-t border-white/[0.04]">
      <div className="mx-auto max-w-2xl px-5">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-[-0.03em]">
            Questions
          </h2>
        </div>

        <div className="space-y-2">
          {faqs.map((faq, index) => (
            <div key={index} className="rounded-xl overflow-hidden">
              <button
                className="w-full p-5 text-left flex items-center justify-between hover:bg-white/[0.02] transition-colors rounded-xl cursor-pointer"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                aria-expanded={openIndex === index}
              >
                <span className="text-[15px] font-medium text-white pr-4">{faq.question}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform duration-200 ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence initial={false}>
                {openIndex === index && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 -mt-1">
                      <p className="text-[15px] text-slate-400 leading-relaxed">{faq.answer}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Social Proof ────────────────────────────────────────────────────────── */

function SocialProof() {
  const testimonials = [
    {
      quote: "I caught a bases-loaded situation 30 seconds before the odds shifted. Paid for a year of Pro in one play.",
      author: "Marcus T.",
      role: "MLB Bettor, 2 years",
      rating: 5,
    },
    {
      quote: "The AI context is what sets it apart. It doesn't just tell you what happened — it tells you why it matters.",
      author: "Sarah K.",
      role: "Multi-sport analyst",
      rating: 5,
    },
    {
      quote: "Replaced three different alert apps with ChirpBot. Faster, smarter, and half the price.",
      author: "Dev P.",
      role: "Daily bettor, NFL & NBA",
      rating: 5,
    },
  ];

  return (
    <section className="py-20 sm:py-28 border-t border-white/[0.04]">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-[-0.03em]">
            Trusted by sharp bettors
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            See why thousands choose ChirpBot for their edge.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="relative rounded-2xl bg-[#161B22] ring-1 ring-white/[0.06] p-7 hover:ring-emerald-500/20 hover:translate-y-[-2px] transition-all duration-300"
            >
              <div className="text-6xl text-emerald-500/20 absolute top-4 left-5 leading-none font-serif select-none">&ldquo;</div>
              <div className="flex gap-0.5 mb-4 mt-2">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                ))}
              </div>
              <p className="text-[15px] text-slate-300 leading-relaxed mb-6">{t.quote}</p>
              <div>
                <div className="text-[14px] font-semibold text-white">{t.author}</div>
                <div className="text-[13px] text-slate-500">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ──────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-white/[0.04] py-10">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <ChirpBotLogo size="xs" />
          <p className="text-[13px] text-slate-500">
            &copy; {new Date().getFullYear()} ChirpBot. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
