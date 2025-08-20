import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronRight, Play, AlertCircle, Zap, Trophy, Target } from "lucide-react";

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  highlight?: string;
}

const steps: OnboardingStep[] = [
  {
    title: "Welcome to ChirpBot V2!",
    description: "Get real-time sports alerts powered by AI. We'll show you how it works in just 3 quick steps.",
    icon: <Trophy className="w-8 h-8 text-emerald-400" />,
    highlight: "3-second understanding rule"
  },
  {
    title: "Select Your Games",
    description: "Click on any game card to start monitoring. You'll instantly receive AI-powered alerts with player stats, weather conditions, and predictive insights.",
    icon: <Target className="w-8 h-8 text-blue-400" />,
    highlight: "Live demos for all sports"
  },
  {
    title: "Smart Alerts in Action",
    description: "Experience alerts with important batter data, wind conditions, scoring probabilities, and AI predictions - all within 3 seconds of understanding.",
    icon: <Zap className="w-8 h-8 text-yellow-400" />,
    highlight: "Real-time AI analysis"
  },
  {
    title: "Try It Now!",
    description: "Click on any game below to see ChirpBot in action. Each game will generate 5 realistic alerts showing our advanced capabilities.",
    icon: <Play className="w-8 h-8 text-emerald-400" />,
    highlight: "Click a game to start"
  }
];

interface DemoOnboardingProps {
  isOpen: boolean;
  onComplete: () => void;
  username?: string;
}

export function DemoOnboarding({ isOpen, onComplete, username = "Demo User" }: DemoOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(isOpen);

  useEffect(() => {
    setIsVisible(isOpen);
  }, [isOpen]);

  useEffect(() => {
    console.log("DemoOnboarding component - isOpen:", isOpen, "currentStep:", currentStep);
  }, [isOpen, currentStep]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    setTimeout(() => {
      onComplete();
      setCurrentStep(0);
    }, 300);
  };

  const handleSkip = () => {
    handleComplete();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <Dialog open={isVisible} onOpenChange={(open) => !open && handleComplete()}>
          <DialogContent className="max-w-lg p-0 overflow-hidden bg-slate-900 border-slate-700">
            <div className="relative">
              {/* Progress bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-500 to-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Content */}
              <div className="p-8 pt-12">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    {/* Icon and step indicator */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {steps[currentStep].icon}
                        <span className="text-sm text-slate-400">
                          Step {currentStep + 1} of {steps.length}
                        </span>
                      </div>
                      {currentStep === 0 && (
                        <span className="text-sm text-emerald-400 font-semibold">
                          Hello, {username}!
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-bold text-slate-100">
                      {steps[currentStep].title}
                    </h2>

                    {/* Description */}
                    <p className="text-slate-300 leading-relaxed">
                      {steps[currentStep].description}
                    </p>

                    {/* Highlight box */}
                    {steps[currentStep].highlight && (
                      <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="p-4 rounded-lg bg-slate-800/50 border border-slate-700"
                      >
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-blue-400" />
                          <span className="text-sm font-semibold text-blue-400">
                            Key Feature
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-300">
                          {steps[currentStep].highlight}
                        </p>
                      </motion.div>
                    )}

                    {/* Demo examples for step 2 */}
                    {currentStep === 2 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="space-y-2 text-sm"
                      >
                        <div className="flex items-center gap-2 text-slate-400">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                          <span>Aaron Judge batting (.301 AVG, 47 HRs)</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                          <span>15 MPH wind blowing to right field</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                          <span>78% scoring probability with RISP</span>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Actions */}
                <div className="flex items-center justify-between mt-8">
                  <Button
                    variant="ghost"
                    onClick={handleSkip}
                    className="text-slate-400 hover:text-slate-300"
                  >
                    Skip tour
                  </Button>
                  
                  <div className="flex gap-2">
                    {currentStep > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep(currentStep - 1)}
                        className="border-slate-700 text-slate-300 hover:bg-slate-800"
                      >
                        Back
                      </Button>
                    )}
                    <Button
                      onClick={handleNext}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
                    >
                      {currentStep === steps.length - 1 ? (
                        <>
                          Get Started
                          <Play className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
}