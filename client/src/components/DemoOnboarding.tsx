import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, ChevronRight, Target, Activity, Bell, Smartphone, Brain, ArrowRight, CheckCircle2 } from "lucide-react";

interface DemoOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DemoOnboarding({ isOpen, onClose }: DemoOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  
  console.log("DemoOnboarding component - isOpen:", isOpen, "currentStep:", currentStep);

  const steps = [
    {
      id: "welcome",
      title: "Welcome to ChirpBot Demo!",
      subtitle: "Experience the power of AI-driven sports alerts",
      content: (
        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-500/20 ring-2 ring-emerald-500/30 rounded-full flex items-center justify-center mx-auto">
            <Zap className="w-10 h-10 text-emerald-400" />
          </div>
          <div className="space-y-4">
            <p className="text-slate-300 text-lg">
              You're about to see what makes ChirpBot the ultimate sports monitoring platform.
            </p>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
              <p className="text-emerald-400 font-semibold text-sm">
                ⚡ This demo showcases simulated alerts based on real game scenarios
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "features",
      title: "Real-Time Sports Intelligence",
      subtitle: "See what ChirpBot can do for you",
      content: (
        <div className="space-y-4">
          <div className="grid gap-4">
            <FeatureCard
              icon={<Target className="w-5 h-5 text-emerald-400" />}
              title="Smart Alert Targeting"
              description="AI filters 90% of noise - only get alerts that truly matter"
            />
            <FeatureCard
              icon={<Activity className="w-5 h-5 text-blue-400" />}
              title="Multi-Sport Coverage"
              description="MLB, NFL, NBA, NHL with sport-specific alert types"
            />
            <FeatureCard
              icon={<Brain className="w-5 h-5 text-purple-400" />}
              title="AI-Powered Analysis"
              description="85%+ confidence scoring with contextual insights"
            />
            <FeatureCard
              icon={<Smartphone className="w-5 h-5 text-orange-400" />}
              title="Instant Delivery"
              description="2-second WebSocket alerts with Telegram support"
            />
          </div>
        </div>
      )
    },
    {
      id: "howto",
      title: "How to Experience the Demo",
      subtitle: "Follow these steps to see simulated alerts",
      content: (
        <div className="space-y-6">
          <div className="space-y-4">
            <Step
              number="1"
              title="Select Games to Monitor"
              description="Go to the Calendar page and select 2-3 games you want to track"
              icon={<Target className="w-4 h-4" />}
            />
            <Step
              number="2"
              title="Watch for Simulated Alerts"
              description="Real-time alerts will appear based on your selections"
              icon={<Bell className="w-4 h-4" />}
            />
            <Step
              number="3"
              title="Check the Alerts Page"
              description="View your alert history and see the AI analysis"
              icon={<Activity className="w-4 h-4" />}
            />
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-blue-400 font-semibold text-sm">
              🎯 Demo alerts simulate real scenarios like RISP situations, red zone drives, and clutch moments
            </p>
          </div>
        </div>
      )
    },
    {
      id: "ready",
      title: "Ready to Explore!",
      subtitle: "Start monitoring games and see the magic happen",
      content: (
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-green-500/20 ring-2 ring-green-500/30 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <div className="space-y-4">
            <p className="text-slate-300 text-lg">
              You're all set! Head to the Calendar to select games and start experiencing ChirpBot's real-time alerts.
            </p>
            <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-4">
              <p className="text-emerald-400 font-semibold text-sm">
                💡 Remember: This is a live demo with simulated data designed to showcase our capabilities
              </p>
            </div>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#0B1220] border-slate-700 text-slate-100 z-[9999]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            {steps[currentStep].title}
          </DialogTitle>
          <p className="text-slate-400 text-center">
            {steps[currentStep].subtitle}
          </p>
        </DialogHeader>
        
        <div className="py-6">
          {/* Progress Indicators */}
          <div className="flex justify-center mb-8">
            <div className="flex space-x-2">
              {steps.map((_, index) => (
                <motion.div
                  key={index}
                  className={`w-2 h-2 rounded-full ${
                    index === currentStep 
                      ? 'bg-emerald-400' 
                      : index < currentStep 
                        ? 'bg-emerald-600' 
                        : 'bg-slate-600'
                  }`}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: index === currentStep ? 1.2 : 1 }}
                  transition={{ duration: 0.2 }}
                />
              ))}
            </div>
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="min-h-[300px]"
            >
              {steps[currentStep].content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-6 border-t border-slate-700">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Previous
          </Button>
          
          <span className="text-sm text-slate-400">
            {currentStep + 1} of {steps.length}
          </span>

          <Button
            onClick={handleNext}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold"
          >
            {currentStep === steps.length - 1 ? 'Start Demo' : 'Next'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
}) {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
          <div>
            <h4 className="font-semibold text-slate-100 text-sm">{title}</h4>
            <p className="text-slate-400 text-xs mt-1">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Step({ 
  number, 
  title, 
  description, 
  icon 
}: { 
  number: string; 
  title: string; 
  description: string; 
  icon: React.ReactNode; 
}) {
  return (
    <div className="flex items-start space-x-4">
      <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
        <span className="text-emerald-400 font-bold text-sm">{number}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center space-x-2 mb-1">
          {icon}
          <h4 className="font-semibold text-slate-100 text-sm">{title}</h4>
        </div>
        <p className="text-slate-400 text-sm">{description}</p>
      </div>
    </div>
  );
}