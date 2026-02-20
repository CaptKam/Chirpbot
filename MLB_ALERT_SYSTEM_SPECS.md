# ChirpBot MLB Alert System — Complete Specifications

**Version:** 3.1  
**Last Updated:** February 2026  
**Purpose:** Standalone MLB betting intelligence app reference  

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Data Pipeline](#2-data-pipeline)
3. [MLB Engine](#3-mlb-engine)
4. [Alert Cylinders (29 Modules)](#4-alert-cylinders-29-modules)
5. [Probability Model](#5-probability-model)
6. [Performance Tracker](#6-performance-tracker)
7. [Game State Data Model](#7-game-state-data-model)
8. [AI Enhancement Pipeline](#8-ai-enhancement-pipeline)
9. [Gambling Insights Output](#9-gambling-insights-output)
10. [Weather Integration](#10-weather-integration)
11. [Alert Deduplication](#11-alert-deduplication)
12. [Notification Delivery](#12-notification-delivery)
13. [Database Schema](#13-database-schema)
14. [API Endpoints](#14-api-endpoints)
15. [Polling & Timing](#15-polling--timing)
16. [Performance Targets](#16-performance-targets)
17. [External Dependencies](#17-external-dependencies)
18. [File Inventory](#18-file-inventory)

---

## 1. System Overview

The MLB Alert System monitors live baseball games in real time and detects high-value betting situations using 29 specialized alert cylinders, a mathematical probability model, an in-game performance tracker, and AI-enhanced gambling insights powered by GPT-4o.

### Core Capabilities

- **29 alert cylinder modules** covering every base runner configuration, clutch situations, pitching changes, momentum shifts, weather impacts, and predictive analytics
- **Mathematical probability model** using logistic regression with batter ISO, pitcher HR/9, wind vectors, park factors, and platoon advantage
- **Real-time performance tracking** for batters (streaks, RISP stats, at-bat history), pitchers (pitch counts, velocity trends, efficiency), and teams (momentum, rally detection, scoring patterns)
- **Pattern detection** for rare events (grand slams, perfect innings, cycle alerts) and statistical anomalies
- **AI-enhanced gambling insights** with structured betting recommendations, confidence scores, and market context
- **Weather-aware alerting** with wind direction/speed impact on ball flight, temperature effects on pitcher stamina, and humidity tracking
- **Sub-250ms API response times** with intelligent caching

### Alert Flow (End to End)

```
MLB.com API ──► Calendar Sync ──► Game State Manager ──► MLB Engine
                                                            │
                  ┌─────────────────────────────────────────┘
                  ▼
          29 Alert Cylinders ──► Probability Model ──► Pre-AI Gate
                                                           │
                                                           ▼
                                                   Deduplication Check
                                                           │
                                                           ▼
                                            Unified AI Processor (GPT-4o)
                                                           │
                                                           ▼
                                             Gambling Insights Composer
                                                           │
                                              ┌────────────┼────────────┐
                                              ▼            ▼            ▼
                                          Dashboard    SSE Stream   Telegram
                                          (Polling)    (Real-time)  (Push)
```

---

## 2. Data Pipeline

### Data Source
- **Primary:** MLB.com Official API (live game data, play-by-play, lineups)
- **Fallback:** SportsData.io API

### Ingestion Flow

| Stage                  | Component              | Description                                    |
|------------------------|------------------------|------------------------------------------------|
| 1. Calendar Polling    | CalendarSyncService    | Polls MLB API every 5-30s depending on proximity |
| 2. State Management    | GameStateManager       | Manages SCHEDULED → PREWARM → LIVE → FINAL lifecycle |
| 3. Engine Activation   | EngineLifecycleManager | Spins up MLBEngine when game goes LIVE         |
| 4. Data Enhancement    | MLBEngine              | Fetches enhanced game data (play-by-play, lineups, weather) |
| 5. Alert Generation    | Alert Cylinders        | 29 modules evaluate game state every 1 second  |
| 6. AI Enhancement      | UnifiedAIProcessor     | GPT-4o adds gambling context                   |
| 7. Delivery            | Alert Store + SSE      | Persisted to DB, broadcast to clients          |

### Enhanced Game Data Fetched per Poll

```
- Score (home/away)
- Inning number + half (top/bottom)
- Ball/strike/out count
- Base runner positions (1st, 2nd, 3rd)
- Current batter (name, ID, stats)
- Current pitcher (name, ID, pitch count)
- On-deck batter
- Last play description
- Last pitch data (type, velocity, call)
- Weather conditions at venue
- Lineup data
```

---

## 3. MLB Engine

**File:** `server/services/engines/mlb-engine.ts` (799 LOC)  
**Extends:** `BaseSportEngine`

### Engine Responsibilities

1. **Game state enhancement** — Enriches raw API data with live play-by-play, lineups, and weather
2. **Performance tracking** — Updates batter, pitcher, and team performance metrics every evaluation cycle
3. **Alert generation** — Delegates to 29 loaded cylinder modules
4. **Alert enrichment** — Attaches batter performance, pitcher performance, team momentum, and unusual patterns to each alert
5. **Play parsing** — Classifies play outcomes (hit, walk, strikeout, homerun, double, triple, error, double play)
6. **Pitch parsing** — Classifies pitch outcomes (strike, ball, foul, hit) with velocity extraction
7. **RBI extraction** — Parses RBI counts from play descriptions (including grand slam detection)

### Probability Calculation

The engine calculates a composite probability score (15-90 range) based on:

| Factor               | Contribution              | Details                              |
|----------------------|---------------------------|--------------------------------------|
| Base probability     | 40                        | Starting baseline                    |
| Inning stage         | +5 to +20                 | Early (+5), Middle (+10), Late 7+ (+20) |
| Out count            | +5 to +20                 | 0 outs (+20), 1 out (+10), 2 outs (+5) |
| Score differential   | -10 to +25                | Within 1 (+25), within 3 (+15), within 6 (+5), blowout (-10) |
| Runner on 3rd        | +15                       | Immediate scoring threat             |
| Runner on 2nd        | +10                       | Scoring position                     |
| Runner on 1st        | +5                        | Base runner presence                 |

**Range:** Clamped to [15, 90]

### Performance Metrics Tracked

| Metric                          | Purpose                              |
|---------------------------------|--------------------------------------|
| `alertGenerationTime[]`         | Alert processing latency (last 100)  |
| `moduleLoadTime[]`              | Cylinder module load time            |
| `enhanceDataTime[]`             | Data enhancement latency             |
| `probabilityCalculationTime[]`  | Probability calc latency             |
| `gameStateEnhancementTime[]`    | Game state enhancement latency       |
| `totalRequests`                 | Total evaluation cycles              |
| `totalAlerts`                   | Total alerts generated               |
| `cacheHits` / `cacheMisses`    | API cache performance                |
| `basesLoadedSituations`         | Bases loaded detection count         |
| `seventhInningDetections`       | 7th inning detection count           |
| `runnerScoringOpportunities`    | RISP situation count                 |

---

## 4. Alert Cylinders (29 Modules)

Each module extends `BaseAlertModule` and implements:

```typescript
abstract class BaseAlertModule {
  alertType: string;              // Unique identifier (e.g., "MLB_BASES_LOADED_NO_OUTS")
  sport: string;                  // "MLB"
  isTriggered(gameState): boolean;         // Fast boolean check
  generateAlert(gameState): AlertResult;   // Create alert payload
  calculateProbability(gameState): number; // 0-100 score
  minConfidence?: number;                  // Optional gate threshold
  dedupeWindowMs?: number;                 // Optional cooldown (ms)
}
```

### 4.1 Base Runner Situation Alerts (13 modules)

These detect every possible base runner configuration with out count context.

| # | Module | Alert Type | Trigger Condition | Betting Relevance |
|---|--------|-----------|-------------------|-------------------|
| 1 | `bases-loaded-no-outs-module` | `MLB_BASES_LOADED_NO_OUTS` | 1B + 2B + 3B occupied, 0 outs | Highest run expectancy (~2.3 expected runs). Over/total line impact. |
| 2 | `bases-loaded-one-out-module` | `MLB_BASES_LOADED_ONE_OUT` | 1B + 2B + 3B occupied, 1 out | Grand slam risk. Sac fly guaranteed run. Spread impact. |
| 3 | `bases-loaded-two-outs-module` | `MLB_BASES_LOADED_TWO_OUTS` | 1B + 2B + 3B occupied, 2 outs | All-or-nothing. Big swing potential. Clutch batter matters. |
| 4 | `runner-on-third-no-outs-module` | `MLB_RUNNER_ON_THIRD_NO_OUTS` | 3B occupied, 0 outs | ~85% chance of scoring. Near-guaranteed run. |
| 5 | `runner-on-third-one-out-module` | `MLB_RUNNER_ON_THIRD_ONE_OUT` | 3B occupied, 1 out | Sac fly opportunity. ~65% scoring chance. |
| 6 | `runner-on-third-two-outs-module` | `MLB_RUNNER_ON_THIRD_TWO_OUTS` | 3B occupied, 2 outs | Pressure at-bat. ~30% scoring chance. |
| 7 | `runner-on-second-no-outs-module` | `MLB_RUNNER_ON_SECOND_NO_OUTS` | 2B occupied, 0 outs | Scoring position, multiple chances to drive in. |
| 8 | `first-and-second-module` | `MLB_FIRST_AND_SECOND` | 1B + 2B occupied | Double play risk. Rally building. |
| 9 | `first-and-third-no-outs-module` | `MLB_FIRST_AND_THIRD_NO_OUTS` | 1B + 3B occupied, 0 outs | Squeeze play potential. Steal of home. |
| 10 | `first-and-third-one-out-module` | `MLB_FIRST_AND_THIRD_ONE_OUT` | 1B + 3B occupied, 1 out | Double play threat vs. sac fly. |
| 11 | `first-and-third-two-outs-module` | `MLB_FIRST_AND_THIRD_TWO_OUTS` | 1B + 3B occupied, 2 outs | Clutch hitting situation. |
| 12 | `second-and-third-no-outs-module` | `MLB_SECOND_AND_THIRD_NO_OUTS` | 2B + 3B occupied, 0 outs | Multiple runs likely. Big inning setup. |
| 13 | `second-and-third-one-out-module` | `MLB_SECOND_AND_THIRD_ONE_OUT` | 2B + 3B occupied, 1 out | Intentional walk possible. Strategic situation. |

### 4.2 Scoring & Situation Alerts (6 modules)

| # | Module | Alert Type | Trigger Condition | Betting Relevance |
|---|--------|-----------|-------------------|-------------------|
| 14 | `risp-prob-enhanced-module` | `MLB_RISP_PROB_ENHANCED` | Runners in scoring position (probability-enhanced) | Probability-weighted RISP with batter/pitcher matchup context. |
| 15 | `scoring-opportunity-module` | `MLB_SCORING_OPPORTUNITY` | General scoring opportunity detected | Broad scoring situation with run expectancy calculation. |
| 16 | `high-scoring-situation-module` | `MLB_HIGH_SCORING_SITUATION` | High-scoring game situation | Total/over line alert. Game pace trending high. |
| 17 | `clutch-situation-module` | `MLB_CLUTCH_SITUATION` | Late-game clutch moment | Close game, late innings, high leverage. Moneyline impact. |
| 18 | `late-inning-close-module` | `MLB_LATE_INNING_CLOSE` | 7th inning+, score within 1-2 runs | Critical for live moneyline and spread bets. |
| 19 | `momentum-shift-module` | `MLB_MOMENTUM_SHIFT` | Momentum change detected | Scoring run, big play, error sequence. Live line movement trigger. |

### 4.3 Player & Matchup Alerts (5 modules)

| # | Module | Alert Type | Trigger Condition | Betting Relevance |
|---|--------|-----------|-------------------|-------------------|
| 20 | `batter-due-module` | `MLB_BATTER_DUE` | Key batter due up in order | Star player approaching with RISP or leverage. Prop bet impact. |
| 21 | `on-deck-prediction-module` | `MLB_ON_DECK_PREDICTION` | On-deck batter prediction | Anticipate next at-bat. `minConfidence: 65`, `dedupeWindowMs: 15,000ms`. |
| 22 | `pitching-change-module` | `MLB_PITCHING_CHANGE` | Pitching change detected | Bullpen entry changes matchup dynamics. Spread/total impact. |
| 23 | `strikeout-module` | `MLB_STRIKEOUT` | High strikeout situation | Strikeout prop bets. Pitcher dominance or struggling indicator. |
| 24 | `steal-likelihood-module` | `MLB_STEAL_LIKELIHOOD` | Stolen base probability elevated | Stolen base prop bets. Runner speed vs. catcher arm. |

### 4.4 Game Phase Alerts (2 modules)

| # | Module | Alert Type | Trigger Condition | Betting Relevance |
|---|--------|-----------|-------------------|-------------------|
| 25 | `game-start-module` | `MLB_GAME_START` | Game starting / first pitch | Pre-game lines locked. Opening action begins. |
| 26 | `seventh-inning-stretch-module` | `MLB_SEVENTH_INNING_STRETCH` | 7th inning reached | Traditional stretch. Late-game strategy changes begin. |

### 4.5 Environmental Alerts (1 module)

| # | Module | Alert Type | Trigger Condition | Betting Relevance |
|---|--------|-----------|-------------------|-------------------|
| 27 | `wind-change-module` | `MLB_WIND_CHANGE` | Wind direction or speed shift | Wind blowing out = HR boost. Wind in = pitching advantage. Total line impact. |

### 4.6 AI & Advanced Analytics (2 modules)

| # | Module | Alert Type | Trigger Condition | Betting Relevance |
|---|--------|-----------|-------------------|-------------------|
| 28 | `ai-scanner-module` | `MLB_AI_SCANNER` | AI detects novel opportunity | Catches situations no rule-based module covers. |
| 29 | `mlb-prob-integration` | `MLB_PROB` | Mathematical probability model triggers | Logistic regression model with batter/pitcher/park/weather inputs. |

---

## 5. Probability Model

**File:** `server/services/engines/mlb-prob-model.ts` (300 LOC)

### Alert Variants

| Variant             | Trigger Condition                      | Description                        |
|---------------------|----------------------------------------|------------------------------------|
| `MLB_RISP`          | Runner on 2nd or 3rd                   | Runners in scoring position        |
| `MLB_BASES_LOADED`  | All 3 bases occupied                   | Maximum run potential              |
| `MLB_FULL_COUNT_RISP` | 3-2 count with RISP                  | Full count pressure with runners   |
| `MLB_HR_THREAT`     | HR probability ≥ 8%                    | Home run threat this at-bat        |
| `MLB_LATE_PRESSURE` | Late + close + no other variant fires  | Late-game pressure situation       |

### Core Probability Functions

#### `probRunNextPA(state)` — Run Probability This Plate Appearance
Logistic regression model:

```
logit = -0.35
  + 0.85 × hasRISP
  + 0.35 × basesLoaded
  + 0.22 × batterISO_Z        (batter isolated power Z-score)
  + 0.18 × pitcherHR9_Z       (pitcher HR/9 Z-score)
  + 0.30 × windOutComponent   (outbound wind factor 0-1)
  + 0.15 × parkHRFactor       (park HR factor 0-1)
  - outs × 0.25               (out penalty)
  + 0.08 × platoonAdvantage   (if applicable)

P(run) = sigmoid(logit) × 0.98
```

#### `probHRThisPA(state)` — Home Run Probability This At-Bat

```
logit = -3.65
  + 0.55 × batterISO_Z
  + 0.40 × pitcherHR9_Z
  + 0.60 × windOutComponent
  + 0.25 × parkHRFactor
  + 0.10 × platoonAdvantage

P(HR) = sigmoid(logit)
```

#### `probMultiRunHalfInning(state)` — Multi-Run Half Inning

```
baseWeight = (on3B × 0.55) + (on2B × 0.42) + (on1B × 0.28)
outsFactor = [0.55, 0.33, 0.12][outs]

logit = -1.60
  + 1.25 × baseWeight
  + 0.35 × batterISO_Z
  + 0.20 × pitcherHR9_Z
  + 0.40 × windOutComponent
  + 0.18 × parkHRFactor
  + 0.95 × outsFactor

P(multi-run) = sigmoid(logit)
```

### Input Variables

| Variable             | Source            | Normalization                          |
|----------------------|-------------------|----------------------------------------|
| Batter ISO           | MLB API / stats   | Z-score: `(iso - 0.170) / 0.060`, clamped [-2.5, 3] |
| Pitcher HR/9         | MLB API / stats   | Z-score: `(hr9 - 1.10) / 0.40`, clamped [-2.5, 3]   |
| Wind (out component) | Weather API       | `(mph / 20) × dirMultiplier`, clamped [0, 1]          |
| Park HR Factor       | Park data         | `(hrFactor - 0.9) / 0.5`, clamped [0, 1]              |
| Platoon Advantage    | Batter/Pitcher    | Boolean (L vs R matchup advantage)                     |

### Wind Direction Multipliers

| Direction | Multiplier | Impact |
|-----------|-----------|--------|
| Out       | 1.0       | Full carry boost for fly balls |
| Cross/Left/Right | 0.35 | Partial effect |
| In        | -0.7      | Suppresses fly ball distance |
| Unknown   | 0.0       | Neutral |

### Output Scoring

```typescript
interface MLBAlertScore {
  variant: MLBAlertVariant;     // Which alert type
  p_event: number;              // Probability (0-1)
  leverage: number;             // Game leverage (0-1)
  confidence: number;           // Calibrated confidence (0-100)
  priority: 'P90' | 'P75' | 'P50' | 'P25';  // Priority bucket
  aiText: string;               // One-liner summary (≤25 words)
  dedupeKey: string;            // Deduplication key
}
```

### Priority Buckets

```
score = 0.45 × p_event + 0.35 × leverage + 0.20 × (confidence / 100)

P90: score ≥ 0.80  (highest priority)
P75: score ≥ 0.65
P50: score ≥ 0.50
P25: score < 0.50  (lowest priority)
```

### Leverage Score Calculation

```
late = inning ≥ 7 ? 1.0 : inning ≥ 6 ? 0.7 : 0.3
close = |scoreDiff| ≤ 1 ? 1.0 : |scoreDiff| = 2 ? 0.6 : 0.25
leverage = 0.6 × late + 0.4 × close

Bonuses: BASES_LOADED +0.10, FULL_COUNT_RISP +0.08
```

### Confidence Calibration

```
Missing data penalty: 15% per missing input (batter ISO, pitcher HR/9, wind speed)
Maximum penalty: 30%
Floor: 5% (never zero confidence)
Ceiling: 95% (1 - floor)
```

---

## 6. Performance Tracker

**File:** `server/services/engines/mlb-performance-tracker.ts` (1,354 LOC)

Tracks in-game performance for every batter, pitcher, and team across all active games.

### 6.1 Batter Performance

Tracked per batter per game:

| Stat                | Type                | Description                           |
|---------------------|---------------------|---------------------------------------|
| `atBats`            | number              | Total at-bats this game               |
| `hits`              | number              | Total hits                            |
| `runs`              | number              | Runs scored                           |
| `rbis`              | number              | Runs batted in                        |
| `walks`             | number              | Walks drawn                           |
| `strikeouts`        | number              | Strikeouts                            |
| `homeRuns`          | number              | Home runs                             |
| `doubles`           | number              | Doubles                               |
| `triples`           | number              | Triples                               |
| `stolenBases`       | number              | Stolen bases                          |
| `caughtStealing`    | number              | Caught stealing                       |
| `leftOnBase`        | number              | Runners left on base                  |
| `lastFiveAtBats`    | Array               | Last 5 at-bat outcomes with context (inning, pitcher, pitch count, RBIs) |
| `currentStreak`     | Object              | Type (`hitting`, `on-base`, `strikeout`, `hitless`) + count |
| `runnersInScoringPosition` | Object       | At-bats and hits with RISP            |
| `twoOutRBI`         | number              | RBIs with 2 outs                      |

### 6.2 Pitcher Performance

Tracked per pitcher per game:

| Stat                   | Type             | Description                          |
|------------------------|------------------|--------------------------------------|
| `totalPitches`         | number           | Total pitches thrown                  |
| `strikes`              | number           | Total strikes                        |
| `balls`                | number           | Total balls                          |
| `pitchesThisInning`    | number           | Pitches in current inning            |
| `strikeouts`           | number           | Total strikeouts                     |
| `walks`                | number           | Total walks                          |
| `hits`                 | number           | Hits allowed                         |
| `homeRuns`             | number           | Home runs allowed                    |
| `earnedRuns`           | number           | Earned runs allowed                  |
| `battersFaced`         | number           | Total batters faced                  |
| `recentPitches`        | Array (last 10)  | Type, velocity, location, batter     |
| `firstPitchStrikes`    | number           | First pitch strike count             |
| `threeBallCounts`      | number           | 3-ball count occurrences             |
| `fullCounts`           | number           | Full count (3-2) occurrences         |
| `pitchesPerInning`     | number           | Average pitches per inning           |
| `consecutiveBalls`     | number           | Current consecutive ball streak      |
| `consecutiveStrikes`   | number           | Current consecutive strike streak    |
| `currentTrend`         | enum             | `improving`, `declining`, `stable`   |
| `inningsPitched`       | number           | Total innings pitched                |
| `pitchVelocityTrend`   | number[] (last 5)| Velocity trend tracking              |

### 6.3 Team Momentum

Tracked per team per game:

| Stat                  | Type            | Description                           |
|-----------------------|-----------------|---------------------------------------|
| `runsByInning`        | number[]        | Runs scored per inning                |
| `totalRuns`           | number          | Total runs                            |
| `hits`                | number          | Total hits                            |
| `errors`              | number          | Total errors                          |
| `leftOnBase`          | number          | Runners stranded                      |
| `lastThreeInnings`    | Object          | Runs, hits, strikeouts for last 3 innings |
| `currentRally`        | Object          | Active rally: runs scored, hits in inning, outs when started |
| `scoringStreak`       | Object          | Consecutive innings with runs + total runs in streak |
| `scorelessStreak`     | Object          | Consecutive scoreless innings + last scored inning |
| `twoOutRuns`          | number          | Runs scored with 2 outs               |
| `runnersScoredFromThird` | number       | Runners who scored from 3rd base      |
| `doublePlaysTurned`   | number          | Double plays turned                   |
| `biggestInning`       | Object          | Inning number + runs for biggest inning |

### 6.4 Pattern Detection

Automatic detection of unusual in-game patterns:

| Pattern Category     | Tracked Events                                       |
|----------------------|------------------------------------------------------|
| **Sequences**        | Consecutive strikeouts, walks, hits (current + max)  |
| **Pitcher Dominance**| K's last 3 innings, hits allowed last 3 innings      |
| **Pitcher Struggles**| Walks last 2 innings, pitches last 2 innings         |
| **Rally Mode**       | Active rally, start inning, runs scored, consecutive baserunners |
| **Defensive Gem**    | Innings without error, double plays in game          |
| **Rare Events**      | Triple play, grand slam, perfect inning, 4-strikeout inning, stolen home, cycle alert |
| **Anomalies**        | Statistical anomalies with severity (low/medium/high) |

### Cache Management

| Parameter          | Value    | Description                     |
|--------------------|----------|---------------------------------|
| Cleanup interval   | 1 hour   | Periodic stale game cleanup     |
| Max game age       | 4 hours  | Games older than this are purged |

---

## 7. Game State Data Model

### Core Game State (per evaluation cycle)

```typescript
interface GameState {
  gameId: string;
  sport: "MLB";
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: "scheduled" | "live" | "final";
  isLive: boolean;

  // Inning context
  inning: number;                    // Current inning (1-9+)
  isTopInning: boolean;              // Top or bottom of inning
  inningState: string;               // Inning state description

  // Count
  balls: number;                     // 0-3
  strikes: number;                   // 0-2
  outs: number;                      // 0-2 (3 = inning end)

  // Base runners
  hasFirst: boolean;                 // Runner on 1st
  hasSecond: boolean;                // Runner on 2nd
  hasThird: boolean;                 // Runner on 3rd

  // Player context
  currentBatter: string;             // Batter name
  currentBatterId: string;           // Batter ID
  currentPitcher: string;            // Pitcher name
  currentPitcherId: string;          // Pitcher ID
  onDeckBatter: string;              // On-deck batter name
  pitchCount: number;                // Pitcher's pitch count

  // Play data
  lastPlay: {
    description: string;             // Play-by-play text
  };
  lastPitch: {
    call: string;                    // Pitch result description
  };

  // Weather context
  weatherContext: {
    windSpeed: number;               // MPH
    windDirection: string;           // N, NE, E, SE, S, SW, W, NW
    temperature: number;             // Fahrenheit
    humidity: number;                // Percentage
    conditions: string;              // Clear, cloudy, rain, etc.
  };

  // Flags
  inningJustEnded: boolean;          // 3rd out just recorded
  gamePk: number;                    // MLB game primary key
}
```

### Alert Result (output of each cylinder)

```typescript
interface AlertResult {
  alertKey: string;                  // Unique key for deduplication
  type: string;                      // Alert type (e.g., "MLB_BASES_LOADED_NO_OUTS")
  message: string;                   // Human-readable alert message
  displayMessage?: string;           // Optional formatted display text
  context: {
    // Enriched by engine:
    batterPerformance?: BatterSummary;
    pitcherPerformance?: PitcherSummary;
    teamMomentum?: MomentumSummary;
    unusualPatterns?: string[];
    // Cylinder-specific context data
    [key: string]: any;
  };
  priority: number;                  // Priority score (0-100)
  gamblingInsights?: GamblingInsights; // Added by AI pipeline
  hasComposerEnhancement?: boolean;
}
```

---

## 8. AI Enhancement Pipeline

### Processing Flow

```
Raw Alert ──► Quality Gate (is alert worth AI processing?)
                │
                ▼
         Cross-Sport Context Builder
                │ Builds context object with:
                │ - Sport: MLB
                │ - Game state (inning, outs, score)
                │ - Base runners
                │ - Current batter/pitcher
                │ - Weather conditions
                │ - Performance tracker data
                ▼
         OpenAI GPT-4o API Call
                │ Prompt includes:
                │ - Situation description
                │ - Batter/pitcher matchup
                │ - Weather impact analysis
                │ - Historical probability
                ▼
         Quality Validator
                │ - Schema validation (Zod)
                │ - XSS protection
                │ - Jaccard similarity check (dedup AI text)
                ▼
         Gambling Insights Composer
                │ - Sport-specific bullet points
                │ - Market impact analysis
                │ - Confidence scoring
                ▼
         Enhanced Alert (stored + delivered)
```

### Caching Strategy
- **Cache Key:** `sport:gameId:alertType:stateHash`
- **Cache Hit:** Returns instantly (0ms)
- **Cache TTL:** Configurable per alert type
- **Circuit Breaker:** Disables AI calls after repeated API failures
- **Timeout Protection:** AI calls timeout after configured limit

---

## 9. Gambling Insights Output

Each alert is enhanced with structured gambling insights:

```typescript
interface GamblingInsights {
  structuredTemplate?: string;       // Pre-formatted with emojis for display

  market?: {
    moneyline?: { home?: number; away?: number };
    spread?: { points?: number; home?: number; away?: number };
    total?: { points?: number; over?: number; under?: number };
  };

  weather?: {
    impact: string;                  // "Wind blowing out at 16mph boosts HR probability"
    conditions: string;              // "Clear, 72°F, wind 16mph NW"
    severity: "low" | "medium" | "high";
  };

  keyPlayers?: Array<{
    name: string;                    // "Aaron Judge"
    position: string;                // "RF"
    relevance: string;               // "3-for-4 today, HR streak"
  }>;

  momentum?: {
    recent: string;                  // "3 runs in last 2 innings"
    trend: "positive" | "negative" | "neutral";
    timeframe: string;               // "Last 3 innings"
  };

  situation?: {
    context: string;                 // "Bases loaded, 1 out in the 7th"
    significance: string;            // "Run expectancy 1.65, sac fly guarantees run"
    timing: string;                  // "7th inning, critical late-game window"
  };

  bullets?: string[];                // Actionable betting insights
  confidence?: number;               // 0-1 confidence score
  tags?: string[];                   // ["RISP", "late-inning", "close-game"]
}
```

### Example Bullet Points (MLB-specific)

```
- "Bases loaded, 0 outs — run expectancy 2.3. Over line highly pressured."
- "Judge at bat vs. lefty — platoon advantage, ISO .280. HR prop +320 has value."
- "Wind blowing out at 16mph at Yankee Stadium. Park factor 1.12 for fly balls."
- "Pitcher at 98 pitches, velocity dropping 2mph. Bullpen change imminent."
- "Home team on 4-inning scoring streak. Live moneyline shifting."
```

---

## 10. Weather Integration

### MLB Weather Thresholds

| Parameter               | Threshold  | Impact on Betting                       |
|-------------------------|------------|-----------------------------------------|
| Wind direction shift    | ≥20°       | Ball flight path changes                |
| Minimum wind relevance  | ≥8 MPH     | Wind becomes factor in fly balls        |
| Wind blowing out        | ≥14 MPH    | HR carry boost — favor Over/HR props    |
| Wind blowing in         | ≥14 MPH    | HR suppressed — favor Under/pitching    |
| Cold temperature        | ≤45°F      | Dead ball, reduced carry                |
| Hot temperature         | ≥90°F      | Pitcher fatigue, slightly livelier ball |
| Humidity spike          | ≥10% in 15min | Air density change affects flight    |
| Precipitation           | Any start/stop | Game delay risk, footing, grip      |
| Retractable roof change | Open ↔ Closed | Wind/temperature suddenly changes   |

### Weather Data Source
- **API:** OpenWeatherMap
- **Polling:** Every 90 seconds (live games), 20 seconds when weather-sensitive alert is armed
- **Cache TTL:** 60 seconds

---

## 11. Alert Deduplication

| Parameter       | Value          | Description                              |
|-----------------|----------------|------------------------------------------|
| Alert TTL       | 5 minutes      | Same alert can't fire again within 5min  |
| Request TTL     | 30 seconds     | Prevents duplicate API requests          |
| Key format      | `alertType:gameId:sport:contextHash` | Composite dedup key     |
| Module override | `dedupeWindowMs` | Per-module custom cooldown (e.g., On-Deck = 15s) |

### Dedup Key Example
```
MLB:401234567:MLB_BASES_LOADED:Bot|7|1|1|1|1|3|4
```
(Variant : GameID : Frame|Inning|Outs|1B|2B|3B|AwayScore|HomeScore)

---

## 12. Notification Delivery

| Channel          | Method                     | Latency                         |
|------------------|----------------------------|---------------------------------|
| Dashboard        | HTTP Polling (`/api/alerts`) | ~5 seconds (frontend poll rate) |
| SSE Stream       | `/realtime-alerts-sse`     | < 1 second (server push)        |
| Telegram         | Telegram Bot API           | 1-3 seconds                     |

### Alert Persistence
- Stored in `alerts` table with 5-minute default expiry
- Sequence number for reconnection recovery
- User-scoped (each user sees only their monitored game alerts)

---

## 13. Database Schema

### `alerts` table (primary alert storage)

| Column           | Type       | Description                         |
|------------------|------------|-------------------------------------|
| id               | varchar PK | UUID                                |
| alertKey         | varchar    | Dedup key                           |
| sequenceNumber   | integer    | Auto-increment for ordering         |
| sport            | text       | "MLB"                               |
| gameId           | text       | MLB game ID                         |
| type             | text       | Alert type (e.g., MLB_BASES_LOADED) |
| state            | text       | Alert state                         |
| score            | integer    | Priority score                      |
| payload          | jsonb      | Full alert data + gambling insights |
| userId           | varchar FK | User who receives this alert        |
| createdAt        | timestamp  | Creation time                       |
| expiresAt        | timestamp  | Expiry (NOW + 5 minutes)            |

### `user_monitored_teams` table (game selection)

| Column         | Type       | Description                |
|----------------|------------|----------------------------|
| id             | varchar PK | UUID                       |
| userId         | varchar FK | User ID                    |
| gameId         | text       | MLB game ID to monitor     |
| sport          | text       | "MLB"                      |
| homeTeamName   | text       | Home team name             |
| awayTeamName   | text       | Away team name             |
| createdAt      | timestamp  | When monitoring started    |

### `user_alert_preferences` table (per-alert toggles)

| Column    | Type       | Description                     |
|-----------|------------|---------------------------------|
| id        | varchar PK | UUID                            |
| userId    | varchar FK | User ID                         |
| sport     | text       | "MLB"                           |
| alertType | text       | Alert type to toggle            |
| enabled   | boolean    | User's on/off preference        |
| createdAt | timestamp  | Created                         |
| updatedAt | timestamp  | Last changed                    |

### `global_alert_settings` table (admin controls)

| Column    | Type       | Description                     |
|-----------|------------|---------------------------------|
| id        | varchar PK | UUID                            |
| sport     | text       | "MLB"                           |
| alertType | text       | Alert type                      |
| enabled   | boolean    | Global on/off                   |
| updatedAt | timestamp  | Last changed                    |
| updatedBy | varchar FK | Admin who changed it            |

### `game_states` table (live game snapshots)

| Column          | Type       | Description                    |
|-----------------|------------|--------------------------------|
| id              | varchar PK | UUID                           |
| extGameId       | text       | MLB game ID                    |
| sport           | text       | "MLB"                          |
| homeTeam        | text       | Home team name                 |
| awayTeam        | text       | Away team name                 |
| homeScore       | integer    | Home score                     |
| awayScore       | integer    | Away score                     |
| status          | text       | scheduled / live / final       |
| inning          | integer    | Current inning                 |
| isTopInning     | boolean    | Top or bottom                  |
| balls           | integer    | Ball count                     |
| strikes         | integer    | Strike count                   |
| outs            | integer    | Out count                      |
| hasFirst        | boolean    | Runner on 1st                  |
| hasSecond       | boolean    | Runner on 2nd                  |
| hasThird        | boolean    | Runner on 3rd                  |
| currentBatter   | text       | Batter name                    |
| currentPitcher  | text       | Pitcher name                   |
| onDeckBatter    | text       | On-deck batter                 |
| windSpeed       | integer    | Wind MPH                       |
| windDirection   | text       | Wind direction                 |
| temperature     | integer    | Temperature F                  |
| humidity        | integer    | Humidity %                     |
| enhancedData    | jsonb      | Extended data payload          |
| createdAt       | timestamp  | Created                        |
| updatedAt       | timestamp  | Last updated                   |

---

## 14. API Endpoints

### Game Data
| Method | Endpoint                       | Description                     |
|--------|--------------------------------|---------------------------------|
| GET    | `/api/games/today?sport=MLB`   | Today's MLB games               |
| GET    | `/api/games/:gameId/enhanced`  | Enhanced game data              |
| GET    | `/api/games/:gameId/live`      | Live game state                 |
| GET    | `/api/server-date`             | Server date/time                |

### Game Monitoring
| Method | Endpoint                                    | Description                |
|--------|---------------------------------------------|----------------------------|
| GET    | `/api/user/:userId/monitored-games`         | Get monitored games        |
| POST   | `/api/user/:userId/monitored-games`         | Add game to monitoring     |
| DELETE | `/api/user/:userId/monitored-games/:gameId` | Remove game               |

### Alerts
| Method | Endpoint                  | Description                     |
|--------|---------------------------|---------------------------------|
| GET    | `/api/alerts`             | Get active alerts for user      |
| GET    | `/api/alerts/snapshot`    | Alert snapshot                  |
| GET    | `/api/alerts/stats`       | Alert statistics                |
| GET    | `/api/alerts/count`       | Alert count                     |
| DELETE | `/api/alerts/:alertId`    | Delete an alert                 |
| GET    | `/realtime-alerts-sse`    | SSE real-time stream            |

### Alert Preferences
| Method | Endpoint                                     | Description               |
|--------|----------------------------------------------|---------------------------|
| GET    | `/api/user/:userId/alert-preferences`        | Get all preferences       |
| GET    | `/api/user/:userId/alert-preferences/MLB`    | Get MLB preferences       |
| POST   | `/api/user/:userId/alert-preferences`        | Update preference         |
| POST   | `/api/user/:userId/alert-preferences/bulk`   | Bulk update               |

### Weather
| Method | Endpoint                          | Description                  |
|--------|-----------------------------------|------------------------------|
| GET    | `/api/weather/team/:teamName`     | Weather at team venue        |
| GET    | `/api/test-weather/:team`         | Test weather for team        |
| GET    | `/api/test-wind-speeds`           | Test wind speed data         |

### Authentication
| Method | Endpoint              | Description          |
|--------|-----------------------|----------------------|
| POST   | `/api/auth/login`     | Login                |
| POST   | `/api/auth/signup`    | Register             |
| POST   | `/api/auth/logout`    | Logout               |
| GET    | `/api/auth/user`      | Current user         |

### System
| Method | Endpoint                             | Description              |
|--------|--------------------------------------|--------------------------|
| GET    | `/health`                            | Health check             |
| GET    | `/api/diagnostics/ingestion-status`  | Ingestion status         |

---

## 15. Polling & Timing

### Game Lifecycle Polling

| Phase                    | Interval  | Description                              |
|--------------------------|-----------|------------------------------------------|
| Far from start           | 30s       | Baseline calendar polling                |
| Pre-start (T-10min)      | 5s        | Approaching game time                    |
| Critical (T-2min to T+5min) | 1s     | Ultra-fast live detection                |
| Live confirmation        | 250ms     | State transition verification            |
| Live game (engine tick)  | 1s        | Alert cylinder evaluation rate           |
| Final confirmation       | 2s        | Game end verification                    |

### Game State Machine

```
SCHEDULED ──► PREWARM (T-5min) ──► LIVE ──► FINAL ──► TERMINATED
                                     │  ▲
                                     ▼  │
                                   PAUSED (rain delay)
```

### Engine Lifecycle

| Event              | Timing          | Description                     |
|--------------------|-----------------|----------------------------------|
| Pre-warm start     | T-5min          | Engine begins initialization     |
| Lazy data fetch    | T-2min          | Fetch lineups, weather           |
| Engine spinup      | < 1 second      | Full engine activation           |
| Cylinder evaluation| Every 1 second  | All 29 modules evaluated         |
| Health check       | Every 30s       | Engine health verification       |
| Engine shutdown    | < 5 seconds     | Cleanup after game ends          |

---

## 16. Performance Targets

| Metric                    | Target        | Description                        |
|---------------------------|---------------|------------------------------------|
| API response              | < 250ms       | All endpoints                      |
| Live detection (critical) | ≤ 5 seconds   | T-2min to T+5min guaranteed        |
| Engine startup            | < 1 second    | From PREWARM to LIVE               |
| First alert after LIVE    | < 3 seconds   | First alert generated              |
| AI cache hit              | 0ms           | Instant from intelligent cache     |
| Cylinder evaluation       | < 1 second    | All 29 modules per tick            |
| Probability calculation   | < 10ms        | Mathematical model execution       |

---

## 17. External Dependencies

| Service              | Purpose                              | Required |
|----------------------|--------------------------------------|----------|
| MLB.com Official API | Live game data, play-by-play         | Yes      |
| SportsData.io        | Fallback data source                 | Optional |
| OpenAI GPT-4o        | AI-enhanced gambling insights        | Optional (degrades gracefully) |
| OpenWeatherMap       | Venue weather data                   | Optional (weather alerts disabled without it) |
| Telegram Bot API     | Push notification delivery           | Optional (per-user config) |
| PostgreSQL (Neon)    | Data persistence                     | Yes      |

### Required Environment Variables

| Variable                 | Description                    |
|--------------------------|--------------------------------|
| `DATABASE_URL`           | PostgreSQL connection string   |
| `SESSION_SECRET`         | Express session secret         |
| `OPENAI_API_KEY`         | OpenAI API key (optional)      |
| `OPENWEATHERMAP_API_KEY` | Weather API key (optional)     |

---

## 18. File Inventory

### MLB-Specific Files

```
server/services/engines/
├── mlb-engine.ts                              (799 LOC)  — Main MLB engine
├── mlb-performance-tracker.ts                 (1,354 LOC) — In-game performance tracking
├── mlb-prob-model.ts                          (300 LOC)  — Mathematical probability model
└── alert-cylinders/mlb/
    ├── ai-scanner-module.ts                   — AI opportunity scanner
    ├── bases-loaded-no-outs-module.ts          — Bases loaded, 0 outs
    ├── bases-loaded-one-out-module.ts          — Bases loaded, 1 out
    ├── bases-loaded-two-outs-module.ts         — Bases loaded, 2 outs
    ├── batter-due-module.ts                    — Key batter due up
    ├── clutch-situation-module.ts              — Late-game clutch moments
    ├── first-and-second-module.ts              — Runners on 1st and 2nd
    ├── first-and-third-no-outs-module.ts       — 1st and 3rd, 0 outs
    ├── first-and-third-one-out-module.ts       — 1st and 3rd, 1 out
    ├── first-and-third-two-outs-module.ts      — 1st and 3rd, 2 outs
    ├── game-start-module.ts                    — Game start alert
    ├── high-scoring-situation-module.ts        — High-scoring game
    ├── late-inning-close-module.ts             — Late inning, close game
    ├── mlb-prob-integration.ts                 — Prob model integration
    ├── momentum-shift-module.ts                — Momentum shift detection
    ├── on-deck-prediction-module.ts            — On-deck batter prediction
    ├── pitching-change-module.ts               — Pitching change
    ├── risp-prob-enhanced-module.ts            — RISP (probability enhanced)
    ├── runner-on-second-no-outs-module.ts      — Runner on 2nd, 0 outs
    ├── runner-on-third-no-outs-module.ts       — Runner on 3rd, 0 outs
    ├── runner-on-third-one-out-module.ts       — Runner on 3rd, 1 out
    ├── runner-on-third-two-outs-module.ts      — Runner on 3rd, 2 outs
    ├── scoring-opportunity-module.ts           — Scoring opportunity
    ├── second-and-third-no-outs-module.ts      — 2nd and 3rd, 0 outs
    ├── second-and-third-one-out-module.ts      — 2nd and 3rd, 1 out
    ├── seventh-inning-stretch-module.ts        — 7th inning stretch
    ├── steal-likelihood-module.ts              — Steal probability
    ├── strikeout-module.ts                     — Strikeout situation
    └── wind-change-module.ts                   — Wind change detection
```

### Shared Infrastructure Files (used by MLB)

```
server/services/
├── calendar-sync-service.ts          (817 LOC)   — Data ingestion
├── game-state-manager.ts             (1,189 LOC) — State machine
├── unified-ai-processor.ts           (2,030 LOC) — AI pipeline
├── gambling-insights-composer.ts     (1,439 LOC) — Betting insights
├── unified-deduplicator.ts           (245 LOC)   — Alert dedup
├── weather-service.ts                             — Weather API
├── weather-on-live-service.ts                     — Live weather
├── mlb-api.ts                                     — MLB data API
├── ai-situation-parser.ts                         — AI parsing
├── quality-validator.ts                           — Output validation
├── telegram.ts                                    — Push notifications
├── base-sport-api.ts                              — API base class
└── engines/base-engine.ts            (377 LOC)   — Engine base class

shared/
├── schema.ts                         (394 LOC)   — Database schema + types
└── season-manager.ts                              — Season scheduling

server/config/
└── runtime.ts                        (171 LOC)   — Timing/threshold config
```

---

**Total MLB-specific code:** ~2,453 LOC (engine + tracker + prob model)  
**Total alert cylinder code:** ~29 module files  
**Supporting infrastructure:** ~6,500+ LOC (shared services)
