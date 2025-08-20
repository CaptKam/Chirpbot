import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Zap, Bell, Eye } from "lucide-react";

interface OnboardingTourProps {
  isVisible: boolean;
  onComplete: () => void;
}

const steps = [
  {
    title: "Welcome to ChirpBot! 👋",
    description: "Get instant alerts for critical game moments across MLB, NFL, NBA, and NHL. Let's get you started!",
    highlight: null,
    position: "center"
  },
  {
    title: "Choose Your Sports",
    description: "Tap any sport to see today's games. Each sport has live games ready for monitoring.",
    highlight: "[data-testid^='sport-tab-']",
    position: "bottom"
  },
  {
    title: "Monitor Games",
    description: "Tap the eye icon on any game to start monitoring. You'll get AI-powered alerts for critical moments.",
    highlight: "[data-testid^='toggle-monitoring-']",
    position: "top"
  },
  {
    title: "Check Alerts",
    description: "Your alerts appear here with AI analysis, player stats, and weather conditions. Never miss a key moment!",
    highlight: "[href='/alerts']",
    position: "left"
  }
];

export function OnboardingTour({ isVisible, onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (isVisible) {
      // Add overlay to body to prevent scrolling
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isVisible]);

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const nextStep = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const skipTour = () => {
    onComplete();
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Highlight overlay */}
        {currentStepData.highlight && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="absolute inset-0 pointer-events-none"
          >
            <div 
              className="absolute bg-emerald-400/20 ring-2 ring-emerald-400/50 rounded-lg"
              style={{
                top: 0,
                left: 0,
                width: '100px',
                height: '40px',
                // This would need JavaScript to calculate actual element position
                // For now, using fixed positions based on typical layout
              }}
            />
          </motion.div>
        )}

        {/* Tour modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={`absolute bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm mx-4 shadow-2xl ${
            currentStepData.position === 'center' 
              ? 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
              : currentStepData.position === 'top'
              ? 'top-32 left-4'
              : currentStepData.position === 'bottom' 
              ? 'bottom-32 left-4'
              : 'top-24 right-4'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-emerald-500/20 ring-1 ring-emerald-500/30 rounded-full flex items-center justify-center">
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="font-bold text-slate-100">{currentStepData.title}</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={skipTour}
              className="p-1 text-slate-400 hover:text-slate-200"
              data-testid="button-skip-tour"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            {currentStepData.description}
          </p>

          {/* Progress indicators */}
          <div className="flex justify-center space-x-2 mb-6">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep 
                    ? 'bg-emerald-400' 
                    : index < currentStep 
                    ? 'bg-emerald-500/50' 
                    : 'bg-slate-600'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={prevStep}
              disabled={isFirstStep}
              className="text-slate-400 disabled:opacity-50"
              data-testid="button-prev-step"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>

            <span className="text-xs text-slate-500">
              {currentStep + 1} of {steps.length}
            </span>

            <Button
              onClick={nextStep}
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-900"
              data-testid="button-next-step"
            >
              {isLastStep ? 'Get Started' : 'Next'}
              {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}