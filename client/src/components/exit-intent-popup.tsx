import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Gift, Zap, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export function ExitIntentPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  
  useEffect(() => {
    // Check if popup has already been shown this session
    const shown = sessionStorage.getItem('exit-popup-shown');
    if (shown) {
      setHasShown(true);
      return;
    }
    
    const handleMouseLeave = (e: MouseEvent) => {
      // Only trigger when mouse leaves from the top of the page
      if (e.clientY < 50 && !hasShown) {
        setIsVisible(true);
        setHasShown(true);
        sessionStorage.setItem('exit-popup-shown', 'true');
      }
    };
    
    // Add event listener
    document.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [hasShown]);
  
  const handleClose = () => {
    setIsVisible(false);
  };
  
  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={handleClose}
          />
          
          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl mx-4"
          >
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border-2 border-emerald-500 shadow-2xl shadow-emerald-500/20 overflow-hidden">
              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
                aria-label="Close popup"
              >
                <X className="w-6 h-6" />
              </button>
              
              {/* Header with gift icon */}
              <div className="bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 p-6 text-center border-b border-emerald-500/30">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 mb-4"
                >
                  <Gift className="w-8 h-8 text-emerald-400 animate-pulse" />
                </motion.div>
                <h2 className="text-3xl font-black text-white mb-2">
                  Wait! Don't Miss This <span className="text-emerald-400">Limited Offer</span>
                </h2>
                <p className="text-lg text-slate-300">
                  Join now and get exclusive early-bird pricing
                </p>
              </div>
              
              {/* Content */}
              <div className="p-8">
                {/* Offer details */}
                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 rounded-xl p-6 mb-6 border border-emerald-500/30">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-sm text-slate-400 mb-1">Special Launch Price</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-emerald-400">$19</span>
                        <span className="text-xl text-slate-400 line-through">$49</span>
                        <span className="text-sm font-bold text-red-400 bg-red-500/20 px-2 py-1 rounded-full">61% OFF</span>
                      </div>
                      <div className="text-sm text-slate-400 mt-1">First month only</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-400 mb-2">Offer expires in:</div>
                      <div className="flex items-center gap-2 text-red-400 font-mono font-bold">
                        <Clock className="w-4 h-4 animate-pulse" />
                        <span>14:23</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Features included */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      <span>Unlimited teams & alerts</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      <span>2-second priority delivery</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      <span>Advanced AI insights</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      <span>Telegram + SMS alerts</span>
                    </div>
                  </div>
                  
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <p className="text-sm text-amber-300 text-center">
                      <strong>Only 14 spots left</strong> at this price. Regular price resumes after launch week.
                    </p>
                  </div>
                </div>
                
                {/* CTA Buttons */}
                <div className="space-y-3">
                  <Link href="/signup?plan=pro&promo=LAUNCH61" onClick={handleClose}>
                    <div className="relative">
                      <div className="absolute -inset-1 bg-emerald-500 rounded-xl opacity-50 blur animate-pulse" />
                      <Button className="relative w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 py-6 text-lg font-bold rounded-xl shadow-xl shadow-emerald-500/25 hover:scale-[1.02] transition-all duration-300 group">
                        <span className="flex items-center justify-center gap-2">
                          <Gift className="w-5 h-5" />
                          Claim My 61% Discount Now
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </span>
                      </Button>
                    </div>
                  </Link>
                  
                  <button
                    onClick={handleClose}
                    className="w-full text-sm text-slate-400 hover:text-slate-300 transition-colors py-2"
                  >
                    No thanks, I'll pay full price later
                  </button>
                </div>
                
                {/* Trust indicators */}
                <div className="mt-6 pt-6 border-t border-slate-700 flex items-center justify-center gap-6 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Secure checkout</span>
                  </div>
                  <div>30-day money-back guarantee</div>
                  <div>Cancel anytime</div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}