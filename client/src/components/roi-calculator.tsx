import { useState } from "react";
import { motion } from "framer-motion";
import { Calculator, TrendingUp, DollarSign, Percent } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export function ROICalculator() {
  const [bankroll, setBankroll] = useState([1000]);
  const [betsPerWeek, setBetsPerWeek] = useState([10]);
  const [avgBetSize, setAvgBetSize] = useState([50]);
  
  // Calculate potential earnings
  const baseWinRate = 0.52; // Without ChirpBot
  const improvedWinRate = 0.68; // With ChirpBot (based on testimonials)
  const weeksPerMonth = 4.33;
  
  const monthlyBets = betsPerWeek[0] * weeksPerMonth;
  const monthlyWager = monthlyBets * avgBetSize[0];
  
  // Calculate profit with standard odds (-110)
  const odds = -110;
  const payoutMultiplier = odds < 0 ? 100 / Math.abs(odds) : odds / 100;
  
  const baseMonthlyProfit = monthlyWager * ((baseWinRate * (1 + payoutMultiplier)) - 1);
  const improvedMonthlyProfit = monthlyWager * ((improvedWinRate * (1 + payoutMultiplier)) - 1);
  const additionalProfit = improvedMonthlyProfit - baseMonthlyProfit;
  
  const yearlyAdditionalProfit = additionalProfit * 12;
  const roiPercentage = (yearlyAdditionalProfit / bankroll[0]) * 100;

  return (
    <section className="py-24 bg-gradient-to-b from-transparent to-slate-900/30">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black tracking-tight mb-4">
            Calculate your <span className="text-[#10B981]">potential profits</span>
          </h2>
          <p className="text-lg text-slate-400">
            See how much extra you could earn with ChirpBot's 30-second advantage
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <Card className="bg-slate-900/50 border-slate-800 p-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Calculator inputs */}
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-300">
                      Starting Bankroll
                    </label>
                    <span className="text-lg font-bold text-[#10B981]">
                      ${bankroll[0].toLocaleString()}
                    </span>
                  </div>
                  <Slider
                    value={bankroll}
                    onValueChange={setBankroll}
                    min={100}
                    max={10000}
                    step={100}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-300">
                      Bets per Week
                    </label>
                    <span className="text-lg font-bold text-[#10B981]">
                      {betsPerWeek[0]}
                    </span>
                  </div>
                  <Slider
                    value={betsPerWeek}
                    onValueChange={setBetsPerWeek}
                    min={1}
                    max={50}
                    step={1}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-300">
                      Average Bet Size
                    </label>
                    <span className="text-lg font-bold text-[#10B981]">
                      ${avgBetSize[0]}
                    </span>
                  </div>
                  <Slider
                    value={avgBetSize}
                    onValueChange={setAvgBetSize}
                    min={10}
                    max={500}
                    step={10}
                    className="w-full"
                  />
                </div>
                
                <div className="pt-4 border-t border-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Percent className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-400">Win Rate Comparison</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Without ChirpBot:</span>
                      <span className="text-sm font-bold text-red-400">52%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">With ChirpBot:</span>
                      <span className="text-sm font-bold text-[#10B981]">68%</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Results display */}
              <div className="space-y-4">
                <motion.div
                  key={additionalProfit}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="bg-gradient-to-br from-primaryBlue/20 to-primaryBlue/10 rounded-2xl p-6 border border-primaryBlue/30"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-[#10B981]" />
                    <h3 className="font-bold text-white">Additional Monthly Profit</h3>
                  </div>
                  <div className="text-4xl font-black text-[#10B981] mb-2">
                    +${Math.round(additionalProfit).toLocaleString()}
                  </div>
                  <p className="text-sm text-slate-400">
                    Extra profit with ChirpBot's alerts
                  </p>
                </motion.div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs text-slate-400">Yearly Extra</span>
                    </div>
                    <div className="text-2xl font-bold text-yellow-400">
                      +${Math.round(yearlyAdditionalProfit).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Calculator className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-slate-400">ROI</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-400">
                      {Math.round(roiPercentage)}%
                    </div>
                  </div>
                </div>
                
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <p className="text-sm text-amber-300">
                    <strong>Pro Tip:</strong> At just $29/month, ChirpBot pays for itself {Math.round(additionalProfit / 29)}x over
                  </p>
                </div>
                
                <Link href="/signup?plan=pro">
                  <Button className="w-full bg-primaryBlue hover:bg-blue-600 text-white py-6 text-lg font-bold rounded-xl shadow-sm shadow-primaryBlue/10 hover:scale-[1.02] transition-all duration-300">
                    Start Earning +${Math.round(additionalProfit)}/month
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}