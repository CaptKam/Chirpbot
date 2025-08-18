import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Zap, Bell, Shield, TrendingUp, Users, Activity, ChevronRight } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-chirp-blue via-blue-600 to-blue-800">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-chirp-red rounded-full flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black uppercase tracking-wide text-white">ChirpBot</h1>
                <p className="text-blue-200 text-xs font-medium">V2 Alert System</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button 
                  variant="ghost" 
                  className="text-white hover:text-blue-200 hover:bg-white/10"
                  data-testid="button-landing-login"
                >
                  Log In
                </Button>
              </Link>
              <Link href="/signup">
                <Button 
                  className="bg-chirp-red hover:bg-red-700 text-white"
                  data-testid="button-landing-signup"
                >
                  Sign Up Free
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <div className="inline-flex items-center bg-white/10 backdrop-blur-md rounded-full px-4 py-2 mb-6">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
            <span className="text-sm font-medium text-white">Live Sports Monitoring Active</span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-black text-white mb-6">
            Never Miss a
            <span className="text-chirp-red"> Game-Changing</span> Moment
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
            Real-time AI-powered sports alerts for MLB, NFL, NBA, and NHL. 
            Get instant notifications for runners in scoring position, red zone drives, 
            and clutch time situations.
          </p>
          <div className="flex items-center justify-center space-x-4">
            <Link href="/signup">
              <Button 
                size="lg" 
                className="bg-chirp-red hover:bg-red-700 text-white px-8 py-6 text-lg font-bold"
                data-testid="button-hero-get-started"
              >
                Get Started Free
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white text-white hover:bg-white hover:text-chirp-blue px-8 py-6 text-lg font-bold"
                data-testid="button-hero-login"
              >
                Log In to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-black text-white text-center mb-12">
          Powered by Advanced Technology
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-white/10 backdrop-blur-md border-white/20 p-6 hover:bg-white/20 transition-colors">
            <div className="w-12 h-12 bg-chirp-red rounded-lg flex items-center justify-center mb-4">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Real-Time ESPN Data</h3>
            <p className="text-blue-100">
              Live game data directly from ESPN's API for accurate, up-to-the-second alerts
            </p>
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-white/20 p-6 hover:bg-white/20 transition-colors">
            <div className="w-12 h-12 bg-chirp-red rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">AI-Powered Analysis</h3>
            <p className="text-blue-100">
              OpenAI integration provides contextual insights with 85%+ confidence scoring
            </p>
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-white/20 p-6 hover:bg-white/20 transition-colors">
            <div className="w-12 h-12 bg-chirp-red rounded-lg flex items-center justify-center mb-4">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Multi-Channel Alerts</h3>
            <p className="text-blue-100">
              WebSocket real-time updates plus Telegram bot integration for push notifications
            </p>
          </Card>
        </div>
      </section>

      {/* Sports Coverage */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
          <h2 className="text-3xl font-black text-white text-center mb-8">
            Complete Coverage Across All Major Leagues
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-20 h-20 bg-chirp-red rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-black text-white">MLB</span>
              </div>
              <p className="text-sm text-blue-100">RISP & Late Innings</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-chirp-red rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-black text-white">NFL</span>
              </div>
              <p className="text-sm text-blue-100">Red Zone Alerts</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-chirp-red rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-black text-white">NBA</span>
              </div>
              <p className="text-sm text-blue-100">Clutch Time</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-chirp-red rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-black text-white">NHL</span>
              </div>
              <p className="text-sm text-blue-100">Power Plays</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-5xl font-black text-chirp-red mb-2">24/7</div>
            <p className="text-xl text-white font-medium">Live Monitoring</p>
          </div>
          <div>
            <div className="text-5xl font-black text-chirp-red mb-2">85%+</div>
            <p className="text-xl text-white font-medium">AI Confidence</p>
          </div>
          <div>
            <div className="text-5xl font-black text-chirp-red mb-2">Real-Time</div>
            <p className="text-xl text-white font-medium">ESPN Data</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-chirp-red rounded-2xl p-12 text-center">
          <h2 className="text-4xl font-black text-white mb-4">
            Start Monitoring Your Teams Today
          </h2>
          <p className="text-xl text-red-100 mb-8">
            Join sports fans who never miss the action
          </p>
          <Link href="/signup">
            <Button 
              size="lg" 
              className="bg-white text-chirp-red hover:bg-gray-100 px-8 py-6 text-lg font-bold"
              data-testid="button-cta-signup"
            >
              Create Free Account
              <ChevronRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/20 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-chirp-red rounded-full flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm text-blue-200">© 2025 ChirpBot V2. All rights reserved.</span>
            </div>
            <div className="flex items-center space-x-6">
              <span className="text-sm text-blue-200">Powered by ESPN API & OpenAI</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}