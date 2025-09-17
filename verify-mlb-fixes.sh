#!/bin/bash

echo "🔍 Verifying MLB Module Fixes..."
echo "================================"

echo ""
echo "1️⃣ Checking MLB_BASES_LOADED_TWO_OUTS module..."
if [ -f "server/services/engines/alert-cylinders/mlb/bases-loaded-two-outs-module.ts" ]; then
  echo "   ✅ Module file exists"
  
  # Check if it's registered in the MLB engine
  if grep -q "MLB_BASES_LOADED_TWO_OUTS" server/services/engines/mlb-engine.ts; then
    echo "   ✅ Module is registered in MLB engine"
  else
    echo "   ❌ Module NOT registered in MLB engine"
  fi
  
  # Check the module content
  if grep -q "alertType = 'MLB_BASES_LOADED_TWO_OUTS'" server/services/engines/alert-cylinders/mlb/bases-loaded-two-outs-module.ts; then
    echo "   ✅ Module has correct alert type"
  fi
  
  if grep -q "scoringProbability: 43" server/services/engines/alert-cylinders/mlb/bases-loaded-two-outs-module.ts; then
    echo "   ✅ Module has correct probability (43%)"
  fi
else
  echo "   ❌ Module file NOT found"
fi

echo ""
echo "2️⃣ Checking StrikeoutModule fixes..."
if [ -f "server/services/engines/alert-cylinders/mlb/strikeout-module.ts" ]; then
  echo "   ✅ Module file exists"
  
  # Check for correct field usage
  if grep -q "gameState.hasSecond" server/services/engines/alert-cylinders/mlb/strikeout-module.ts; then
    echo "   ✅ Uses gameState.hasSecond (correct)"
  else
    echo "   ❌ Does NOT use gameState.hasSecond"
  fi
  
  if grep -q "gameState.hasThird" server/services/engines/alert-cylinders/mlb/strikeout-module.ts; then
    echo "   ✅ Uses gameState.hasThird (correct)"
  else
    echo "   ❌ Does NOT use gameState.hasThird"
  fi
  
  # Check for old field references
  if grep -q "secondBase?.occupied" server/services/engines/alert-cylinders/mlb/strikeout-module.ts; then
    echo "   ❌ Still has old secondBase?.occupied reference"
  else
    echo "   ✅ No old secondBase?.occupied references"
  fi
  
  if grep -q "thirdBase?.occupied" server/services/engines/alert-cylinders/mlb/strikeout-module.ts; then
    echo "   ❌ Still has old thirdBase?.occupied reference"
  else
    echo "   ✅ No old thirdBase?.occupied references"
  fi
else
  echo "   ❌ Module file NOT found"
fi

echo ""
echo "3️⃣ Checking live system status..."
echo "   Looking for recent MLB_BASES_LOADED_TWO_OUTS alerts in logs..."
if tail -n 100 /tmp/logs/Start_application_*.log 2>/dev/null | grep -q "MLB_BASES_LOADED_TWO_OUTS triggered"; then
  echo "   ✅ MLB_BASES_LOADED_TWO_OUTS is actively triggering in the system!"
else
  echo "   ⚠️  No recent MLB_BASES_LOADED_TWO_OUTS triggers (might not have matching game state)"
fi

echo ""
echo "================================"
echo "✨ Verification complete!"