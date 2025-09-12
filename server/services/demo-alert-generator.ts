import { storage } from "../storage";
import type { InsertAlert } from "../../shared/schema";

export class DemoAlertGenerator {
  private demoUserId: string;

  constructor(demoUserId: string) {
    this.demoUserId = demoUserId;
  }

  async generateAllDemoAlerts(): Promise<void> {
    console.log('🎯 Starting demo alert generation for user:', this.demoUserId);
    
    // Clear existing demo alerts first
    await storage.clearDemoAlerts();
    
    const alerts: Omit<InsertAlert, 'isDemo'>[] = [
      ...this.getMLBDemoAlerts(),
      ...this.getNFLDemoAlerts(), 
      ...this.getNBADemoAlerts(),
      ...this.getNCAAFDemoAlerts(),
      ...this.getWNBADemoAlerts(),
      ...this.getCFLDemoAlerts()
    ];

    // Create alerts with staggered timestamps
    for (let i = 0; i < alerts.length; i++) {
      const alertData = {
        ...alerts[i],
        userId: this.demoUserId
      };
      
      await storage.createDemoAlert(alertData);
      
      // Add small delay to avoid overwhelming the database
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    console.log(`✅ Generated ${alerts.length} demo alerts successfully`);
  }

  private getMLBDemoAlerts(): Omit<InsertAlert, 'isDemo'>[] {
    return [
      // High-stakes situations (8 alerts)
      {
        alertKey: 'demo_mlb_bases_loaded_001',
        sport: 'MLB',
        gameId: 'demo_game_mlb_001',
        type: 'BASES_LOADED_NO_OUTS',
        state: 'active',
        score: 94,
        payload: {
          homeTeam: 'New York Yankees',
          awayTeam: 'Boston Red Sox',
          homeScore: 4,
          awayScore: 3,
          inning: 8,
          isTopInning: false,
          priority: 94,
          confidence: 87,
          message: 'BASES LOADED, 0 OUTS! Yankees threatening in bottom 8th.',
          context: '2-1 count, Aaron Judge at bat, 85% historical scoring rate',
          aiAdvice: 'Strong OVER 8.5 value. Yankees excel in clutch situations. Live momentum shift opportunity.',
          betting: { home: -140, away: +120, total: 8.5 }
        }
      },
      {
        alertKey: 'demo_mlb_bases_loaded_002',
        sport: 'MLB',
        gameId: 'demo_game_mlb_002',
        type: 'BASES_LOADED_TWO_OUTS',
        state: 'active',
        score: 91,
        payload: {
          homeTeam: 'Los Angeles Dodgers',
          awayTeam: 'San Francisco Giants',
          homeScore: 2,
          awayScore: 2,
          inning: 9,
          isTopInning: true,
          priority: 91,
          confidence: 84,
          message: 'BASES LOADED, 2 OUTS! Mookie Betts at bat with the lead.',
          context: 'Full count, closer struggling, 78% clutch average',
          aiAdvice: 'LAD +1.5 live shows exceptional value. Betts excels under pressure.',
          betting: { home: +105, away: -125, total: 7.0 }
        }
      },
      {
        alertKey: 'demo_mlb_walk_off_setup',
        sport: 'MLB',
        gameId: 'demo_game_mlb_003',
        type: 'WALK_OFF_OPPORTUNITY',
        state: 'active',
        score: 96,
        payload: {
          homeTeam: 'Chicago Cubs',
          awayTeam: 'Milwaukee Brewers',
          homeScore: 5,
          awayScore: 6,
          inning: 9,
          isTopInning: false,
          priority: 96,
          confidence: 89,
          message: 'WALK-OFF SETUP! Runner on 3rd, 1 out. Cubs down by 1.',
          context: 'Seiya Suzuki batting .340 in clutch situations',
          aiAdvice: 'CHC ML +180 offers massive value. Historical walk-off rate: 32%',
          betting: { home: +180, away: -220, total: 9.5 }
        }
      },
      {
        alertKey: 'demo_mlb_cycle_alert',
        sport: 'MLB',
        gameId: 'demo_game_mlb_004',
        type: 'CYCLE_ALERT',
        state: 'active',
        score: 88,
        payload: {
          homeTeam: 'Houston Astros',
          awayTeam: 'Seattle Mariners',
          homeScore: 7,
          awayScore: 4,
          inning: 7,
          isTopInning: false,
          priority: 88,
          confidence: 75,
          message: 'CYCLE ALERT! Alex Bregman needs only a TRIPLE.',
          context: 'Single, double, homer already. 4th at-bat coming up.',
          aiAdvice: 'Bregman cycle prop +2500 if available. Rare achievement opportunity.',
          betting: { home: -165, away: +145, total: 10.5 }
        }
      },
      {
        alertKey: 'demo_mlb_perfect_game',
        sport: 'MLB',
        gameId: 'demo_game_mlb_005',
        type: 'PERFECT_GAME_ALERT',
        state: 'active',
        score: 99,
        payload: {
          homeTeam: 'Detroit Tigers',
          awayTeam: 'Cleveland Guardians',
          homeScore: 3,
          awayScore: 0,
          inning: 7,
          isTopInning: true,
          priority: 99,
          confidence: 95,
          message: 'PERFECT GAME ALERT! Tarik Skubal: 21 up, 21 down.',
          context: '97 pitches, 13 strikeouts, dominant command',
          aiAdvice: 'Historical perfect game odds: 1 in 15,000+. Witnessing greatness.',
          betting: { home: -280, away: +240, total: 7.0 }
        }
      },
      {
        alertKey: 'demo_mlb_risp_clutch',
        sport: 'MLB',
        gameId: 'demo_game_mlb_006',
        type: 'RISP_CLUTCH',
        state: 'active',
        score: 85,
        payload: {
          homeTeam: 'Atlanta Braves',
          awayTeam: 'Philadelphia Phillies',
          homeScore: 3,
          awayScore: 4,
          inning: 8,
          isTopInning: false,
          priority: 85,
          confidence: 82,
          message: 'CLUTCH RISP! Ronald Acuña Jr. with 2 on, 2 outs.',
          context: 'Acuña batting .385 with RISP this season',
          aiAdvice: 'ATL +1.5 live line trending. Acuña props all showing value.',
          betting: { home: +135, away: -155, total: 8.0 }
        }
      },
      {
        alertKey: 'demo_mlb_comeback_alert',
        sport: 'MLB',
        gameId: 'demo_game_mlb_007',
        type: 'COMEBACK_ALERT',
        state: 'active',
        score: 87,
        payload: {
          homeTeam: 'Tampa Bay Rays',
          awayTeam: 'Toronto Blue Jays',
          homeScore: 8,
          awayScore: 5,
          inning: 6,
          isTopInning: false,
          priority: 87,
          confidence: 79,
          message: 'MASSIVE COMEBACK! Rays score 6 in bottom 6th!',
          context: 'From 5-2 deficit to 8-5 lead. 12-hit rally.',
          aiAdvice: 'TB ML was +340, now -120. Live total exploding past 12.5.',
          betting: { home: -120, away: +100, total: 13.5 }
        }
      },
      {
        alertKey: 'demo_mlb_milestone_hr',
        sport: 'MLB',
        gameId: 'demo_game_mlb_008',
        type: 'MILESTONE_ALERT',
        state: 'active',
        score: 92,
        payload: {
          homeTeam: 'St. Louis Cardinals',
          awayTeam: 'Pittsburgh Pirates',
          homeScore: 4,
          awayScore: 2,
          inning: 5,
          isTopInning: false,
          priority: 92,
          confidence: 88,
          message: 'MILESTONE! Nolan Arenado just hit his 300th career HR!',
          context: 'Historic achievement, emotional moment for Cardinals',
          aiAdvice: 'STL momentum surge. Team props showing unexpected value.',
          betting: { home: -180, away: +160, total: 9.0 }
        }
      },

      // Weather impact alerts (4 alerts)
      {
        alertKey: 'demo_mlb_wind_advantage',
        sport: 'MLB',
        gameId: 'demo_game_mlb_009',
        type: 'WEATHER_ADVANTAGE',
        state: 'active',
        score: 78,
        payload: {
          homeTeam: 'Chicago White Sox',
          awayTeam: 'Kansas City Royals',
          homeScore: 2,
          awayScore: 1,
          inning: 4,
          isTopInning: true,
          priority: 78,
          confidence: 71,
          message: 'WIND ALERT! 25 MPH gusts blowing out to right field.',
          context: 'Perfect conditions for power hitters, 4 HRs already',
          aiAdvice: 'OVER 9.5 trending up. HR props showing massive value.',
          betting: { home: -115, away: -105, total: 9.5 }
        }
      },
      {
        alertKey: 'demo_mlb_rain_delay',
        sport: 'MLB',
        gameId: 'demo_game_mlb_010',
        type: 'WEATHER_DELAY',
        state: 'delayed',
        score: 65,
        payload: {
          homeTeam: 'Miami Marlins',
          awayTeam: 'Washington Nationals',
          homeScore: 1,
          awayScore: 0,
          inning: 3,
          isTopInning: false,
          priority: 65,
          confidence: 60,
          message: 'RAIN DELAY! Game suspended, resuming in 45 minutes.',
          context: 'Bullpen impact: both starters likely done',
          aiAdvice: 'Total may drop significantly. Live betting suspended.',
          betting: { home: -130, away: +110, total: 8.0 }
        }
      },
      {
        alertKey: 'demo_mlb_dome_advantage',
        sport: 'MLB',
        gameId: 'demo_game_mlb_011',
        type: 'VENUE_ADVANTAGE',
        state: 'active',
        score: 73,
        payload: {
          homeTeam: 'Minnesota Twins',
          awayTeam: 'Oakland Athletics',
          homeScore: 5,
          awayTeam: 'Oakland Athletics',
          awayScore: 2,
          inning: 6,
          isTopInning: false,
          priority: 73,
          confidence: 68,
          message: 'DOME EFFECT! Twins hitting .340 at Target Field this month.',
          context: 'Controlled conditions favor Minnesota hitters',
          aiAdvice: 'MIN team total OVER showing consistent value.',
          betting: { home: -195, away: +175, total: 8.5 }
        }
      },
      {
        alertKey: 'demo_mlb_temperature_impact',
        sport: 'MLB',
        gameId: 'demo_game_mlb_012',
        type: 'TEMPERATURE_ALERT',
        state: 'active',
        score: 69,
        payload: {
          homeTeam: 'Arizona Diamondbacks',
          awayTeam: 'Colorado Rockies',
          homeScore: 6,
          awayScore: 5,
          inning: 7,
          isTopInning: true,
          priority: 69,
          confidence: 65,
          message: 'HEAT WAVE! 105°F affecting pitcher stamina and ball flight.',
          context: 'Thin air + heat = offensive explosion expected',
          aiAdvice: 'OVER 11.5 was sharp money. Physics favor offense.',
          betting: { home: -105, away: -115, total: 11.5 }
        }
      },

      // Momentum and streaks (6 alerts)
      {
        alertKey: 'demo_mlb_hitting_streak',
        sport: 'MLB',
        gameId: 'demo_game_mlb_013',
        type: 'HITTING_STREAK',
        state: 'active',
        score: 81,
        payload: {
          homeTeam: 'San Diego Padres',
          awayTeam: 'Los Angeles Angels',
          homeScore: 3,
          awayScore: 1,
          inning: 8,
          isTopInning: false,
          priority: 81,
          confidence: 76,
          message: 'STREAK ALIVE! Fernando Tatis Jr. extends to 25 games.',
          context: 'Longest active streak in MLB, clutch 2-run double',
          aiAdvice: 'Tatis props consistently profitable. Momentum building.',
          betting: { home: -145, away: +125, total: 7.5 }
        }
      },
      {
        alertKey: 'demo_mlb_team_streak',
        sport: 'MLB',
        gameId: 'demo_game_mlb_014',
        type: 'TEAM_STREAK',
        state: 'active',
        score: 83,
        payload: {
          homeTeam: 'Baltimore Orioles',
          awayTeam: 'New York Mets',
          homeScore: 7,
          awayScore: 4,
          inning: 9,
          isTopInning: true,
          priority: 83,
          confidence: 78,
          message: 'WIN STREAK! Orioles extend to 12 consecutive victories.',
          context: 'Franchise record within reach, confidence soaring',
          aiAdvice: 'BAL momentum unstoppable. Public money following.',
          betting: { home: -165, away: +145, total: 9.0 }
        }
      },
      {
        alertKey: 'demo_mlb_rookie_record',
        sport: 'MLB',
        gameId: 'demo_game_mlb_015',
        type: 'ROOKIE_RECORD',
        state: 'active',
        score: 79,
        payload: {
          homeTeam: 'Texas Rangers',
          awayTeam: 'Los Angeles Dodgers',
          homeScore: 2,
          awayScore: 0,
          inning: 6,
          isTopInning: true,
          priority: 79,
          confidence: 74,
          message: 'ROOKIE RECORD! Kumar Rocker: 14 strikeouts through 6 innings.',
          context: 'Breaking franchise rookie strikeout record',
          aiAdvice: 'Rocker K props maxed out. Historic performance.',
          betting: { home: +110, away: -130, total: 6.5 }
        }
      },
      {
        alertKey: 'demo_mlb_no_hitter_watch',
        sport: 'MLB',
        gameId: 'demo_game_mlb_016',
        type: 'NO_HITTER_WATCH',
        state: 'active',
        score: 95,
        payload: {
          homeTeam: 'Cincinnati Reds',
          awayTeam: 'Milwaukee Brewers',
          homeScore: 4,
          awayScore: 0,
          inning: 8,
          isTopInning: true,
          priority: 95,
          confidence: 91,
          message: 'NO-HITTER WATCH! Hunter Greene: 24 up, 24 down.',
          context: '116 pitches, overpowering fastball command',
          aiAdvice: 'Historic achievement building. Crowd on their feet.',
          betting: { home: -340, away: +290, total: 6.0 }
        }
      },
      {
        alertKey: 'demo_mlb_playoff_race',
        sport: 'MLB',
        gameId: 'demo_game_mlb_017',
        type: 'PLAYOFF_IMPLICATIONS',
        state: 'active',
        score: 86,
        payload: {
          homeTeam: 'Seattle Mariners',
          awayTeam: 'Houston Astros',
          homeScore: 3,
          awayScore: 3,
          inning: 9,
          isTopInning: true,
          priority: 86,
          confidence: 82,
          message: 'PLAYOFF RACE! Win puts Mariners 1 game back of wild card.',
          context: 'Season on the line, emotional intensity peak',
          aiAdvice: 'SEA desperation factor. Public backing underdogs.',
          betting: { home: +115, away: -135, total: 8.0 }
        }
      },
      {
        alertKey: 'demo_mlb_division_clinch',
        sport: 'MLB',
        gameId: 'demo_game_mlb_018',
        type: 'DIVISION_CLINCH',
        state: 'active',
        score: 88,
        payload: {
          homeTeam: 'Philadelphia Phillies',
          awayTeam: 'Atlanta Braves',
          homeScore: 6,
          awayScore: 3,
          inning: 8,
          isTopInning: false,
          priority: 88,
          confidence: 84,
          message: 'CLINCH ALERT! Phillies can win NL East with victory.',
          context: 'Champagne on ice, crowd electric',
          aiAdvice: 'PHI motivation maximum. Celebration mode incoming.',
          betting: { home: -185, away: +165, total: 8.5 }
        }
      },

      // Miscellaneous exciting situations (7 alerts)
      {
        alertKey: 'demo_mlb_extra_innings_marathon',
        sport: 'MLB',
        gameId: 'demo_game_mlb_019',
        type: 'EXTRA_INNINGS_MARATHON',
        state: 'active',
        score: 80,
        payload: {
          homeTeam: 'Colorado Rockies',
          awayTeam: 'San Francisco Giants',
          homeScore: 8,
          awayScore: 8,
          inning: 14,
          isTopInning: true,
          priority: 80,
          confidence: 75,
          message: 'MARATHON! 14th inning, both bullpens exhausted.',
          context: 'Position players may pitch, chaos factor rising',
          aiAdvice: 'Total exploded from 9.5 to 16.5. Endurance test.',
          betting: { home: -105, away: -115, total: 16.5 }
        }
      },
      {
        alertKey: 'demo_mlb_grand_slam_setup',
        sport: 'MLB',
        gameId: 'demo_game_mlb_020',
        type: 'GRAND_SLAM_SETUP',
        state: 'active',
        score: 89,
        payload: {
          homeTeam: 'Toronto Blue Jays',
          awayTeam: 'Boston Red Sox',
          homeScore: 2,
          awayScore: 5,
          inning: 8,
          isTopInning: false,
          priority: 89,
          confidence: 85,
          message: 'GRAND SLAM SETUP! Vlad Jr. up with bases loaded.',
          context: 'Down 3, season highs in grand slam opportunities',
          aiAdvice: 'TOR +2.5 live huge value. Guerrero Sr. watching.',
          betting: { home: +220, away: -270, total: 9.0 }
        }
      },
      {
        alertKey: 'demo_mlb_stolen_base_record',
        sport: 'MLB',
        gameId: 'demo_game_mlb_021',
        type: 'STOLEN_BASE_RECORD',
        state: 'active',
        score: 76,
        payload: {
          homeTeam: 'Miami Marlins',
          awayTeam: 'Tampa Bay Rays',
          homeScore: 4,
          awayScore: 2,
          inning: 7,
          isTopInning: false,
          priority: 76,
          confidence: 70,
          message: 'SPEED RECORD! Jazz Chisholm steals base #65 of season.',
          context: 'Modern era single-season record in sight',
          aiAdvice: 'Chisholm steal props limited but profitable.',
          betting: { home: -125, away: +105, total: 8.5 }
        }
      },
      {
        alertKey: 'demo_mlb_pitcher_duel',
        sport: 'MLB',
        gameId: 'demo_game_mlb_022',
        type: 'PITCHER_DUEL',
        state: 'active',
        score: 72,
        payload: {
          homeTeam: 'Los Angeles Dodgers',
          awayTeam: 'San Diego Padres',
          homeScore: 1,
          awayScore: 0,
          inning: 8,
          isTopInning: true,
          priority: 72,
          confidence: 68,
          message: 'EPIC DUEL! Walker Buehler vs Yu Darvish: 1-0 in 8th.',
          context: 'Combined 19 strikeouts, 3 hits total',
          aiAdvice: 'UNDER 7.0 was sharp money. Masterclass pitching.',
          betting: { home: -140, away: +120, total: 7.0 }
        }
      },
      {
        alertKey: 'demo_mlb_inside_park_hr',
        sport: 'MLB',
        gameId: 'demo_game_mlb_023',
        type: 'INSIDE_PARK_HOMERUN',
        state: 'active',
        score: 93,
        payload: {
          homeTeam: 'Kansas City Royals',
          awayTeam: 'Detroit Tigers',
          homeScore: 5,
          awayScore: 3,
          inning: 6,
          isTopInning: false,
          priority: 93,
          confidence: 90,
          message: 'INSIDE-THE-PARK HR! Byron Buxton circles the bases!',
          context: 'Rare feat, centerfield wall carom, pure speed',
          aiAdvice: 'KC momentum exploding. Buxton props skyrocketing.',
          betting: { home: -155, away: +135, total: 9.5 }
        }
      },
      {
        alertKey: 'demo_mlb_ejection_impact',
        sport: 'MLB',
        gameId: 'demo_game_mlb_024',
        type: 'EJECTION_IMPACT',
        state: 'active',
        score: 67,
        payload: {
          homeTeam: 'New York Mets',
          awayTeam: 'Washington Nationals',
          homeScore: 4,
          awayScore: 4,
          inning: 5,
          isTopInning: true,
          priority: 67,
          confidence: 63,
          message: 'EJECTION! Mets manager and star pitcher tossed.',
          context: 'Bench clearing incident, momentum shift',
          aiAdvice: 'NYM emotional disruption. WSH value emerging.',
          betting: { home: +105, away: -125, total: 10.0 }
        }
      },
      {
        alertKey: 'demo_mlb_defensive_gem',
        sport: 'MLB',
        gameId: 'demo_game_mlb_025',
        type: 'DEFENSIVE_GEM',
        state: 'active',
        score: 74,
        payload: {
          homeTeam: 'Cleveland Guardians',
          awayTeam: 'Chicago White Sox',
          homeScore: 2,
          awayScore: 1,
          inning: 9,
          isTopInning: true,
          priority: 74,
          confidence: 70,
          message: 'WEB GEM! Andrés Giménez makes impossible diving stop.',
          context: 'Bases loaded, game-saving play, crowd erupts',
          aiAdvice: 'CLE momentum surge. Defensive confidence boost.',
          betting: { home: -175, away: +155, total: 7.5 }
        }
      }
    ];
  }

  private getNFLDemoAlerts(): Omit<InsertAlert, 'isDemo'>[] {
    return [
      // Red zone and scoring opportunities (6 alerts)
      {
        alertKey: 'demo_nfl_red_zone_001',
        sport: 'NFL',
        gameId: 'demo_game_nfl_001',
        type: 'RED_ZONE_OPPORTUNITY',
        state: 'active',
        score: 92,
        payload: {
          homeTeam: 'Kansas City Chiefs',
          awayTeam: 'Buffalo Bills',
          homeScore: 21,
          awayScore: 17,
          priority: 92,
          confidence: 88,
          message: 'RED ZONE! Chiefs 1st & Goal at Buffalo 6-yard line.',
          context: '4th Quarter, 3:47 remaining, Mahomes red zone efficiency: 89%',
          aiAdvice: 'KC -3.5 live line shows strong value. Total 48.5 trending over.',
          betting: { home: -165, away: +145, total: 48.5 }
        }
      },
      {
        alertKey: 'demo_nfl_fourth_down_conversion',
        sport: 'NFL',
        gameId: 'demo_game_nfl_002',
        type: 'FOURTH_DOWN_CONVERSION',
        state: 'active',
        score: 89,
        payload: {
          homeTeam: 'Philadelphia Eagles',
          awayTeam: 'Dallas Cowboys',
          homeScore: 24,
          awayScore: 21,
          priority: 89,
          confidence: 85,
          message: 'FOURTH DOWN! Eagles going for it at Dallas 35-yard line.',
          context: '2 minutes left, 4th & 2, Hurts 78% conversion rate',
          aiAdvice: 'PHI aggressive play-calling. Live ML value shifting.',
          betting: { home: -120, away: +100, total: 47.0 }
        }
      },
      {
        alertKey: 'demo_nfl_two_minute_warning',
        sport: 'NFL',
        gameId: 'demo_game_nfl_003',
        type: 'TWO_MINUTE_WARNING',
        state: 'active',
        score: 95,
        payload: {
          homeTeam: 'Green Bay Packers',
          awayTeam: 'Minnesota Vikings',
          homeScore: 28,
          awayScore: 31,
          priority: 95,
          confidence: 91,
          message: 'TWO-MINUTE WARNING! Packers down 3, have the ball.',
          context: 'Aaron Rodgers 2-min drill: 67% TD rate, clutch master',
          aiAdvice: 'GB ML +140 massive value. Rodgers clutch factor.',
          betting: { home: +140, away: -160, total: 51.5 }
        }
      },
      {
        alertKey: 'demo_nfl_goal_line_stand',
        sport: 'NFL',
        gameId: 'demo_game_nfl_004',
        type: 'GOAL_LINE_STAND',
        state: 'active',
        score: 91,
        payload: {
          homeTeam: 'Pittsburgh Steelers',
          awayTeam: 'Baltimore Ravens',
          homeScore: 14,
          awayScore: 13,
          priority: 91,
          confidence: 87,
          message: 'GOAL LINE STAND! Ravens 4th & Goal at Pittsburgh 1-yard line.',
          context: 'Steelers Steel Curtain activated, crowd deafening',
          aiAdvice: 'PIT defense elite in goal line situations. UNDER trending.',
          betting: { home: -110, away: -110, total: 41.5 }
        }
      },
      {
        alertKey: 'demo_nfl_hail_mary_setup',
        sport: 'NFL',
        gameId: 'demo_game_nfl_005',
        type: 'HAIL_MARY_SETUP',
        state: 'active',
        score: 88,
        payload: {
          homeTeam: 'Detroit Lions',
          awayTeam: 'Chicago Bears',
          homeScore: 20,
          awayScore: 23,
          priority: 88,
          confidence: 84,
          message: 'HAIL MARY TIME! Lions at midfield, 3 seconds left.',
          context: 'Jared Goff arm strength tested, desperation mode',
          aiAdvice: 'DET ML +380 prayer bet. Miraculous finish potential.',
          betting: { home: +380, away: -480, total: 44.0 }
        }
      },
      {
        alertKey: 'demo_nfl_fumble_recovery_td',
        sport: 'NFL',
        gameId: 'demo_game_nfl_006',
        type: 'FUMBLE_RECOVERY_TD',
        state: 'active',
        score: 93,
        payload: {
          homeTeam: 'Tampa Bay Buccaneers',
          awayTeam: 'Atlanta Falcons',
          homeScore: 31,
          awayScore: 24,
          priority: 93,
          confidence: 90,
          message: 'FUMBLE RECOVERY TD! Buccaneers defense scores!',
          context: 'Strip sack by Shaquil Barrett, 45-yard return',
          aiAdvice: 'TB momentum explosion. Total flying OVER 48.5.',
          betting: { home: -185, away: +165, total: 52.0 }
        }
      },

      // Weather and field conditions (4 alerts)
      {
        alertKey: 'demo_nfl_blizzard_game',
        sport: 'NFL',
        gameId: 'demo_game_nfl_007',
        type: 'WEATHER_IMPACT',
        state: 'active',
        score: 82,
        payload: {
          homeTeam: 'Buffalo Bills',
          awayTeam: 'New England Patriots',
          homeScore: 10,
          awayScore: 7,
          priority: 82,
          confidence: 78,
          message: 'BLIZZARD GAME! 8 inches of snow, 25 MPH winds.',
          context: 'Ground game favored, passing nearly impossible',
          aiAdvice: 'UNDER 37.5 sharp money. Weather equalizes talent.',
          betting: { home: -105, away: -115, total: 33.5 }
        }
      },
      {
        alertKey: 'demo_nfl_dome_advantage',
        sport: 'NFL',
        gameId: 'demo_game_nfl_008',
        type: 'DOME_ADVANTAGE',
        state: 'active',
        score: 75,
        payload: {
          homeTeam: 'New Orleans Saints',
          awayTeam: 'Carolina Panthers',
          homeScore: 28,
          awayScore: 14,
          priority: 75,
          confidence: 70,
          message: 'DOME MAGIC! Saints explosive offense in perfect conditions.',
          context: 'Superdome crowd factor, 14-2 home record',
          aiAdvice: 'NO home dominance continues. Public loves dome teams.',
          betting: { home: -225, away: +195, total: 46.5 }
        }
      },
      {
        alertKey: 'demo_nfl_wind_impact',
        sport: 'NFL',
        gameId: 'demo_game_nfl_009',
        type: 'WIND_IMPACT',
        state: 'active',
        score: 71,
        payload: {
          homeTeam: 'Chicago Bears',
          awayTeam: 'Green Bay Packers',
          homeScore: 6,
          awayScore: 3,
          priority: 71,
          confidence: 67,
          message: 'WIND FACTOR! 35 MPH gusts affecting field goals.',
          context: 'Kickers struggling, 2 missed FGs already',
          aiAdvice: 'UNDER 42.0 trending down. Kicking game compromised.',
          betting: { home: +110, away: -130, total: 39.5 }
        }
      },
      {
        alertKey: 'demo_nfl_heat_exhaustion',
        sport: 'NFL',
        gameId: 'demo_game_nfl_010',
        type: 'HEAT_IMPACT',
        state: 'active',
        score: 68,
        payload: {
          homeTeam: 'Miami Dolphins',
          awayTeam: 'New York Jets',
          homeScore: 14,
          awayScore: 10,
          priority: 68,
          confidence: 64,
          message: 'HEAT WAVE! 95°F field temperature, multiple cramps.',
          context: 'Conditioning advantage to Miami, northern team struggling',
          aiAdvice: 'MIA 2H advantage. Heat acclimatization factor.',
          betting: { home: -155, away: +135, total: 43.0 }
        }
      },

      // Player performances and milestones (5 alerts)
      {
        alertKey: 'demo_nfl_500_yards_passing',
        sport: 'NFL',
        gameId: 'demo_game_nfl_011',
        type: 'PASSING_MILESTONE',
        state: 'active',
        score: 94,
        payload: {
          homeTeam: 'Los Angeles Chargers',
          awayTeam: 'Las Vegas Raiders',
          homeScore: 35,
          awayScore: 28,
          priority: 94,
          confidence: 91,
          message: '500 YARDS PASSING! Justin Herbert: 487 yards, 4 TDs.',
          context: 'Historic performance, 13 yards from franchise record',
          aiAdvice: 'Herbert props maxed out. Elite QB performance.',
          betting: { home: -140, away: +120, total: 58.5 }
        }
      },
      {
        alertKey: 'demo_nfl_200_yards_rushing',
        sport: 'NFL',
        gameId: 'demo_game_nfl_012',
        type: 'RUSHING_MILESTONE',
        state: 'active',
        score: 87,
        payload: {
          homeTeam: 'Cleveland Browns',
          awayTeam: 'Cincinnati Bengals',
          homeScore: 21,
          awayScore: 14,
          priority: 87,
          confidence: 83,
          message: '200 YARDS RUSHING! Nick Chubb dominates with 187 yards.',
          context: 'Power running attack, Bengals defense worn down',
          aiAdvice: 'CLE ground control. Chubb OVER yardage props easy.',
          betting: { home: -165, away: +145, total: 44.0 }
        }
      },
      {
        alertKey: 'demo_nfl_defensive_td_spree',
        sport: 'NFL',
        gameId: 'demo_game_nfl_013',
        type: 'DEFENSIVE_EXPLOSION',
        state: 'active',
        score: 90,
        payload: {
          homeTeam: 'San Francisco 49ers',
          awayTeam: 'Seattle Seahawks',
          homeScore: 28,
          awayScore: 7,
          priority: 90,
          confidence: 86,
          message: 'DEFENSIVE DOMINATION! 49ers: 3 INTs, 2 TDs, 5 sacks.',
          context: 'Elite defense dismantling Seattle offense',
          aiAdvice: 'SF defense props goldmine. Seahawks offense shut down.',
          betting: { home: -280, away: +240, total: 41.5 }
        }
      },
      {
        alertKey: 'demo_nfl_rookie_record',
        sport: 'NFL',
        gameId: 'demo_game_nfl_014',
        type: 'ROOKIE_RECORD',
        state: 'active',
        score: 85,
        payload: {
          homeTeam: 'Houston Texans',
          awayTeam: 'Indianapolis Colts',
          homeScore: 24,
          awayScore: 17,
          priority: 85,
          confidence: 81,
          message: 'ROOKIE RECORD! C.J. Stroud: 28 TDs, breaking franchise mark.',
          context: 'Historic rookie season, elite development',
          aiAdvice: 'HOU offense trending up. Stroud props valuable.',
          betting: { home: -125, away: +105, total: 45.5 }
        }
      },
      {
        alertKey: 'demo_nfl_comeback_king',
        sport: 'NFL',
        gameId: 'demo_game_nfl_015',
        type: 'COMEBACK_ALERT',
        state: 'active',
        score: 96,
        payload: {
          homeTeam: 'Denver Broncos',
          awayTeam: 'Oakland Raiders',
          homeScore: 28,
          awayScore: 24,
          priority: 96,
          confidence: 93,
          message: 'EPIC COMEBACK! Broncos score 21 unanswered in 4th quarter!',
          context: 'From 24-7 deficit to 28-24 lead, incredible rally',
          aiAdvice: 'DEN ML was +650, now -120. Historic comeback.',
          betting: { home: -120, away: +100, total: 48.0 }
        }
      },

      // Playoff and division implications (5 alerts)
      {
        alertKey: 'demo_nfl_playoff_berth',
        sport: 'NFL',
        gameId: 'demo_game_nfl_016',
        type: 'PLAYOFF_BERTH',
        state: 'active',
        score: 98,
        payload: {
          homeTeam: 'Jacksonville Jaguars',
          awayTeam: 'Tennessee Titans',
          homeScore: 20,
          awayScore: 17,
          priority: 98,
          confidence: 95,
          message: 'PLAYOFF BERTH! Jaguars win clinches first playoff spot.',
          context: 'Franchise turnaround, emotional celebration incoming',
          aiAdvice: 'JAX desperation/motivation factor. Public loves storylines.',
          betting: { home: -110, away: -110, total: 42.5 }
        }
      },
      {
        alertKey: 'demo_nfl_division_title',
        sport: 'NFL',
        gameId: 'demo_game_nfl_017',
        type: 'DIVISION_TITLE',
        state: 'active',
        score: 97,
        payload: {
          homeTeam: 'Dallas Cowboys',
          awayTeam: 'Washington Commanders',
          homeScore: 31,
          awayScore: 21,
          priority: 97,
          confidence: 94,
          message: 'DIVISION CHAMPIONS! Cowboys clinch NFC East title.',
          context: 'Star celebration incoming, playoff positioning locked',
          aiAdvice: 'DAL celebration factor. Emotional home finale.',
          betting: { home: -195, away: +175, total: 46.0 }
        }
      },
      {
        alertKey: 'demo_nfl_wild_card_race',
        sport: 'NFL',
        gameId: 'demo_game_nfl_018',
        type: 'WILD_CARD_IMPLICATIONS',
        state: 'active',
        score: 91,
        payload: {
          homeTeam: 'Seattle Seahawks',
          awayTeam: 'Arizona Cardinals',
          homeScore: 14,
          awayScore: 10,
          priority: 91,
          confidence: 87,
          message: 'WILD CARD RACE! Seahawks control playoff destiny.',
          context: 'Win and in scenario, season on the line',
          aiAdvice: 'SEA desperation factor maximum. Public backing.',
          betting: { home: -135, away: +115, total: 43.0 }
        }
      },
      {
        alertKey: 'demo_nfl_draft_position',
        sport: 'NFL',
        gameId: 'demo_game_nfl_019',
        type: 'DRAFT_IMPLICATIONS',
        state: 'active',
        score: 65,
        payload: {
          homeTeam: 'Chicago Bears',
          awayTeam: 'Carolina Panthers',
          homeScore: 3,
          awayScore: 6,
          priority: 65,
          confidence: 60,
          message: 'DRAFT RACE! Loss gives Bears #1 overall pick.',
          context: 'Tank bowl implications, future franchise direction',
          aiAdvice: 'Motivation questions. UNDER sharp play.',
          betting: { home: +140, away: -160, total: 37.0 }
        }
      },
      {
        alertKey: 'demo_nfl_perfect_season',
        sport: 'NFL',
        gameId: 'demo_game_nfl_020',
        type: 'PERFECT_SEASON',
        state: 'active',
        score: 99,
        payload: {
          homeTeam: 'Miami Dolphins',
          awayTeam: 'New York Jets',
          homeScore: 24,
          awayScore: 14,
          priority: 99,
          confidence: 96,
          message: 'PERFECT SEASON! Dolphins 16-0, making history!',
          context: 'First undefeated team since 1972, legacy moment',
          aiAdvice: 'Historic achievement. Emotional peak performance.',
          betting: { home: -175, away: +155, total: 41.0 }
        }
      }
    ];
  }

  private getNBADemoAlerts(): Omit<InsertAlert, 'isDemo'>[] {
    return [
      // Clutch time and close games (5 alerts)
      {
        alertKey: 'demo_nba_clutch_time_001',
        sport: 'NBA',
        gameId: 'demo_game_nba_001',
        type: 'CLUTCH_TIME',
        state: 'active',
        score: 94,
        payload: {
          homeTeam: 'Los Angeles Lakers',
          awayTeam: 'Golden State Warriors',
          homeScore: 112,
          awayScore: 108,
          priority: 94,
          confidence: 90,
          message: 'CLUTCH TIME! LeBron James perfect 6/6 FG in final 5 minutes!',
          context: '4th Quarter, 2:31 remaining, Lakers on 15-2 run',
          aiAdvice: 'LAL +2.5 live shows massive value. LeBron clutch mode activated.',
          betting: { home: -120, away: +100, total: 225.5 }
        }
      },
      {
        alertKey: 'demo_nba_buzzer_beater_setup',
        sport: 'NBA', 
        gameId: 'demo_game_nba_002',
        type: 'BUZZER_BEATER_SETUP',
        state: 'active',
        score: 96,
        payload: {
          homeTeam: 'Boston Celtics',
          awayTeam: 'Miami Heat',
          homeScore: 118,
          awayScore: 119,
          priority: 96,
          confidence: 92,
          message: 'BUZZER BEATER SETUP! Celtics down 1, 4.7 seconds left.',
          context: 'Jayson Tatum has the ball, timeout called',
          aiAdvice: 'BOS ML +180 prayer bet. Tatum clutch history positive.',
          betting: { home: +180, away: -220, total: 239.0 }
        }
      },
      {
        alertKey: 'demo_nba_overtime_thriller',
        sport: 'NBA',
        gameId: 'demo_game_nba_003', 
        type: 'OVERTIME_THRILLER',
        state: 'active',
        score: 91,
        payload: {
          homeTeam: 'Phoenix Suns',
          awayTeam: 'Denver Nuggets',
          homeScore: 125,
          awayScore: 125,
          priority: 91,
          confidence: 87,
          message: 'OVERTIME! Suns-Nuggets tied 125-125, extra period!',
          context: 'Back-and-forth battle, Jokic vs Durant duel',
          aiAdvice: 'Total exploded to 255.5. Elite offensive talent showcase.',
          betting: { home: -105, away: -115, total: 255.5 }
        }
      },
      {
        alertKey: 'demo_nba_fourth_quarter_explosion',
        sport: 'NBA',
        gameId: 'demo_game_nba_004',
        type: 'FOURTH_QUARTER_EXPLOSION', 
        state: 'active',
        score: 88,
        payload: {
          homeTeam: 'Milwaukee Bucks',
          awayTeam: 'Philadelphia 76ers',
          homeScore: 95,
          awayScore: 88,
          priority: 88,
          confidence: 84,
          message: 'GIANNIS EXPLOSION! 18 points in 4th quarter, Bucks pulling away.',
          context: 'Greek Freak activated, 7/8 shooting in final frame',
          aiAdvice: 'MIL covering spread. Giannis props all hitting OVER.',
          betting: { home: -165, away: +145, total: 218.5 }
        }
      },
      {
        alertKey: 'demo_nba_comeback_alert',
        sport: 'NBA',
        gameId: 'demo_game_nba_005',
        type: 'COMEBACK_ALERT',
        state: 'active', 
        score: 89,
        payload: {
          homeTeam: 'Dallas Mavericks',
          awayTeam: 'Los Angeles Clippers',
          homeScore: 102,
          awayScore: 99,
          priority: 89,
          confidence: 85,
          message: 'MASSIVE COMEBACK! Mavs erase 18-point deficit, now lead!',
          context: 'Luka magic: 22 points in 3rd quarter, crowd erupting',
          aiAdvice: 'DAL ML was +420, now -110. Historic rally.',
          betting: { home: -110, away: -110, total: 224.0 }
        }
      },

      // Individual performances (5 alerts)
      {
        alertKey: 'demo_nba_triple_double',
        sport: 'NBA',
        gameId: 'demo_game_nba_006',
        type: 'TRIPLE_DOUBLE',
        state: 'active',
        score: 85,
        payload: {
          homeTeam: 'Washington Wizards',
          awayTeam: 'Detroit Pistons', 
          homeScore: 108,
          awayScore: 102,
          priority: 85,
          confidence: 81,
          message: 'TRIPLE-DOUBLE! Russell Westbrook: 25 pts, 12 reb, 10 ast.',
          context: '3rd quarter, 84th career triple-double',
          aiAdvice: 'Westbrook triple-double prop +125 cashed early.',
          betting: { home: -135, away: +115, total: 215.5 }
        }
      },
      {
        alertKey: 'demo_nba_50_point_game',
        sport: 'NBA',
        gameId: 'demo_game_nba_007',
        type: 'FIFTY_POINT_GAME',
        state: 'active',
        score: 97,
        payload: {
          homeTeam: 'Brooklyn Nets',
          awayTeam: 'Atlanta Hawks',
          homeScore: 125,
          awayScore: 118,
          priority: 97,
          confidence: 94,
          message: '50-POINT GAME! Kevin Durant: 52 points on 18/25 shooting!',
          context: 'Vintage KD performance, elite efficiency',
          aiAdvice: 'Durant 30+ points prop maxed out. Historic performance.',
          betting: { home: -155, away: +135, total: 245.0 }
        }
      },
      {
        alertKey: 'demo_nba_rookie_explosion',
        sport: 'NBA',
        gameId: 'demo_game_nba_008', 
        type: 'ROOKIE_EXPLOSION',
        state: 'active',
        score: 82,
        payload: {
          homeTeam: 'San Antonio Spurs',
          awayTeam: 'Orlando Magic',
          homeScore: 95,
          awayScore: 88,
          priority: 82,
          confidence: 78,
          message: 'ROOKIE EXPLOSION! Victor Wembanyama: 28 pts, 12 blks!',
          context: 'Historic defensive performance, franchise record blocks',
          aiAdvice: 'Wembanyama props limited but profitable. Generational talent.',
          betting: { home: +110, away: -130, total: 208.5 }
        }
      },
      {
        alertKey: 'demo_nba_perfect_shooting',
        sport: 'NBA',
        gameId: 'demo_game_nba_009',
        type: 'PERFECT_SHOOTING',
        state: 'active',
        score: 86,
        payload: {
          homeTeam: 'Golden State Warriors', 
          awayTeam: 'Sacramento Kings',
          homeScore: 115,
          awayScore: 108,
          priority: 86,
          confidence: 82,
          message: 'PERFECT! Stephen Curry: 9/9 from three-point range!',
          context: '3rd quarter, historic shooting display',
          aiAdvice: 'Curry 3PM props demolished. Elite shooting clinic.',
          betting: { home: -180, away: +160, total: 231.5 }
        }
      },
      {
        alertKey: 'demo_nba_quadruple_double_watch',
        sport: 'NBA',
        gameId: 'demo_game_nba_010',
        type: 'QUADRUPLE_DOUBLE_WATCH',
        state: 'active',
        score: 95,
        payload: {
          homeTeam: 'Charlotte Hornets',
          awayTeam: 'Indiana Pacers',
          homeScore: 102,
          awayScore: 96,
          priority: 95,
          confidence: 91,
          message: 'QUAD-DOUBLE WATCH! LaMelo Ball: 22/8/8/7, needs 3 steals.',
          context: 'Ultra-rare achievement possibility, 4th quarter remaining',
          aiAdvice: 'Historic achievement watch. LaMelo steals prop +500.',
          betting: { home: -125, away: +105, total: 220.0 }
        }
      },

      // Playoff implications (5 alerts)
      {
        alertKey: 'demo_nba_playoff_race',
        sport: 'NBA',
        gameId: 'demo_game_nba_011',
        type: 'PLAYOFF_RACE',
        state: 'active',
        score: 90,
        payload: {
          homeTeam: 'Miami Heat',
          awayTeam: 'Chicago Bulls',
          homeScore: 108,
          awayScore: 105,
          priority: 90,
          confidence: 86,
          message: 'PLAYOFF RACE! Heat win moves them to 8th seed.',
          context: 'Play-in tournament implications, season on line',
          aiAdvice: 'MIA desperation factor. Jimmy Butler playoff mode.',
          betting: { home: -115, away: -105, total: 212.5 }
        }
      },
      {
        alertKey: 'demo_nba_elimination_game',
        sport: 'NBA',
        gameId: 'demo_game_nba_012',
        type: 'ELIMINATION_GAME',
        state: 'active',
        score: 98,
        payload: {
          homeTeam: 'Los Angeles Lakers',
          awayTeam: 'Denver Nuggets',
          homeScore: 89,
          awayScore: 92,
          priority: 98,
          confidence: 95,
          message: 'ELIMINATION! Lakers season ends with loss.',
          context: 'LeBron legacy game, potentially final playoff run',
          aiAdvice: 'LAL desperation maximum. Emotional intensity peak.',
          betting: { home: +135, away: -155, total: 205.0 }
        }
      },
      {
        alertKey: 'demo_nba_championship_clinch',
        sport: 'NBA',
        gameId: 'demo_game_nba_013',
        type: 'CHAMPIONSHIP_CLINCH', 
        state: 'active',
        score: 99,
        payload: {
          homeTeam: 'Boston Celtics',
          awayTeam: 'Golden State Warriors',
          homeScore: 103,
          awayScore: 98,
          priority: 99,
          confidence: 96,
          message: 'CHAMPIONSHIP! Celtics win NBA Title with victory!',
          context: 'Banner 18 incoming, TD Garden erupting',
          aiAdvice: 'Historic franchise moment. Emotional celebration peak.',
          betting: { home: -165, away: +145, total: 210.5 }
        }
      },
      {
        alertKey: 'demo_nba_home_court_advantage',
        sport: 'NBA',
        gameId: 'demo_game_nba_014',
        type: 'HOME_COURT_ADVANTAGE',
        state: 'active',
        score: 84,
        payload: {
          homeTeam: 'Utah Jazz',
          awayTeam: 'Portland Trail Blazers',
          homeScore: 95,
          awayScore: 88,
          priority: 84,
          confidence: 80,
          message: 'HOME COURT! Jazz secure playoff home-court advantage.',
          context: 'Altitude + crowd factor, significant postseason edge',
          aiAdvice: 'UTA playoff positioning valuable. Home court crucial.',
          betting: { home: -145, away: +125, total: 211.0 }
        }
      },
      {
        alertKey: 'demo_nba_draft_lottery',
        sport: 'NBA',
        gameId: 'demo_game_nba_015',
        type: 'DRAFT_IMPLICATIONS',
        state: 'active',
        score: 70,
        payload: {
          homeTeam: 'Houston Rockets',
          awayTeam: 'Oklahoma City Thunder',
          homeScore: 98,
          awayScore: 102,
          priority: 70,
          confidence: 65,
          message: 'LOTTERY ODDS! Rockets loss improves draft position.',
          context: 'Tank implications, future franchise direction',
          aiAdvice: 'Motivation questions. Development focus over wins.',
          betting: { home: +120, away: -140, total: 205.5 }
        }
      }
    ];
  }

  private getNCAAFDemoAlerts(): Omit<InsertAlert, 'isDemo'>[] {
    return [
      // College football chaos and upsets (8 alerts)
      {
        alertKey: 'demo_ncaaf_upset_alert_001',
        sport: 'NCAAF',
        gameId: 'demo_game_ncaaf_001',
        type: 'UPSET_ALERT',
        state: 'active',
        score: 96,
        payload: {
          homeTeam: 'Appalachian State',
          awayTeam: 'North Carolina',
          homeScore: 28,
          awayScore: 21,
          priority: 96,
          confidence: 92,
          message: 'MASSIVE UPSET! App State leads #8 North Carolina 28-21!',
          context: '4th Quarter, 6:43 remaining, stunning mountaineer performance',
          aiAdvice: 'APP +17.5 covering easily. Historic upset brewing.',
          betting: { home: +650, away: -850, total: 52.5 }
        }
      },
      {
        alertKey: 'demo_ncaaf_overtime_classic',
        sport: 'NCAAF',
        gameId: 'demo_game_ncaaf_002',
        type: 'OVERTIME_CLASSIC',
        state: 'active',
        score: 94,
        payload: {
          homeTeam: 'Alabama',
          awayTeam: 'Georgia',
          homeScore: 35,
          awayScore: 35,
          priority: 94,
          confidence: 90,
          message: 'SEC CLASSIC! Alabama-Georgia headed to overtime!',
          context: 'Top 5 matchup, College Football Playoff implications',
          aiAdvice: 'Total exploded to 75.5. Elite offensive showcase.',
          betting: { home: -105, away: -115, total: 75.5 }
        }
      },
      {
        alertKey: 'demo_ncaaf_heisman_moment',
        sport: 'NCAAF',
        gameId: 'demo_game_ncaaf_003',
        type: 'HEISMAN_MOMENT',
        state: 'active',
        score: 91,
        payload: {
          homeTeam: 'USC',
          awayTeam: 'Oregon',
          homeScore: 31,
          awayScore: 28,
          priority: 91,
          confidence: 87,
          message: 'HEISMAN MOMENT! Caleb Williams: 5 TDs, leading comeback!',
          context: 'Pac-12 Championship implications, Heisman race leader',
          aiAdvice: 'Williams Heisman odds shortened. Elite QB performance.',
          betting: { home: -120, away: +100, total: 68.0 }
        }
      },
      {
        alertKey: 'demo_ncaaf_rivalry_classic',
        sport: 'NCAAF',
        gameId: 'demo_game_ncaaf_004',
        type: 'RIVALRY_CLASSIC',
        state: 'active',
        score: 89,
        payload: {
          homeTeam: 'Ohio State',
          awayTeam: 'Michigan',
          homeScore: 24,
          awayScore: 21,
          priority: 89,
          confidence: 85,
          message: 'THE GAME! Ohio State-Michigan, 4th quarter thriller!',
          context: 'Big Ten Championship on line, 118th meeting',
          aiAdvice: 'Rivalry emotion factor. Public split evenly.',
          betting: { home: -135, away: +115, total: 48.5 }
        }
      },
      {
        alertKey: 'demo_ncaaf_weather_chaos',
        sport: 'NCAAF',
        gameId: 'demo_game_ncaaf_005',
        type: 'WEATHER_CHAOS',
        state: 'active',
        score: 78,
        payload: {
          homeTeam: 'Iowa',
          awayTeam: 'Wisconsin',
          homeScore: 10,
          awayScore: 7,
          priority: 78,
          confidence: 74,
          message: 'WEATHER CHAOS! 40 MPH winds, snow squalls, ground game only.',
          context: 'B1G West classic, 6 turnovers already',
          aiAdvice: 'UNDER 41.5 easy money. Weather equalizer.',
          betting: { home: -110, away: -110, total: 31.5 }
        }
      },
      {
        alertKey: 'demo_ncaaf_playoff_elimination',
        sport: 'NCAAF',
        gameId: 'demo_game_ncaaf_006',
        type: 'PLAYOFF_ELIMINATION',
        state: 'active',
        score: 95,
        payload: {
          homeTeam: 'Clemson',
          awayTeam: 'Florida State',
          homeScore: 17,
          awayScore: 20,
          priority: 95,
          confidence: 91,
          message: 'PLAYOFF HOPES! Clemson loss ends CFP dreams.',
          context: 'ACC Championship game, season-defining moment',
          aiAdvice: 'CLE desperation factor maximum. Legacy on line.',
          betting: { home: +125, away: -145, total: 45.0 }
        }
      },
      {
        alertKey: 'demo_ncaaf_perfect_season',
        sport: 'NCAAF',
        gameId: 'demo_game_ncaaf_007',
        type: 'PERFECT_SEASON',
        state: 'active',
        score: 97,
        payload: {
          homeTeam: 'TCU',
          awayTeam: 'Baylor',
          homeScore: 28,
          awayScore: 14,
          priority: 97,
          confidence: 93,
          message: 'PERFECT SEASON! TCU 13-0, undefeated dreams alive!',
          context: 'Big 12 Championship, CFP #1 seed implications',
          aiAdvice: 'TCU perfection narrative. Public loves undefeateds.',
          betting: { home: -195, away: +175, total: 58.5 }
        }
      },
      {
        alertKey: 'demo_ncaaf_quarterback_duel',
        sport: 'NCAAF',
        gameId: 'demo_game_ncaaf_008',
        type: 'QUARTERBACK_DUEL',
        state: 'active',
        score: 88,
        payload: {
          homeTeam: 'Texas',
          awayTeam: 'Oklahoma',
          homeScore: 35,
          awayScore: 31,
          priority: 88,
          confidence: 84,
          message: 'RED RIVER DUEL! Quinn Ewers vs Dillon Gabriel epic!',
          context: 'Combined 8 TDs, 650+ passing yards',
          aiAdvice: 'QB props maxed out. Offensive clinic at Cotton Bowl.',
          betting: { home: -115, away: -105, total: 72.0 }
        }
      },

      // Conference championship and bowl implications (7 alerts)
      {
        alertKey: 'demo_ncaaf_sec_championship',
        sport: 'NCAAF',
        gameId: 'demo_game_ncaaf_009',
        type: 'CONFERENCE_CHAMPIONSHIP',
        state: 'active',
        score: 93,
        payload: {
          homeTeam: 'LSU',
          awayTeam: 'Georgia',
          homeScore: 24,
          awayScore: 21,
          priority: 93,
          confidence: 89,
          message: 'SEC CHAMPIONSHIP! LSU stunning Georgia in Atlanta!',
          context: 'Death Valley magic travels, upset of the year',
          aiAdvice: 'LSU +10.5 massive value. SEC chaos factor.',
          betting: { home: +285, away: -345, total: 49.5 }
        }
      },
      {
        alertKey: 'demo_ncaaf_pac12_title',
        sport: 'NCAAF',
        gameId: 'demo_game_ncaaf_010',
        type: 'PAC12_CHAMPIONSHIP',
        state: 'active',
        score: 85,
        payload: {
          homeTeam: 'Washington',
          awayTeam: 'Oregon',
          homeScore: 31,
          awayScore: 24,
          priority: 85,
          confidence: 81,
          message: 'PAC-12 TITLE! Washington leads Oregon in Vegas!',
          context: 'Conference final hurrah, playoff implications',
          aiAdvice: 'UW covering +3.5. Emotional PAC-12 farewell.',
          betting: { home: +135, away: -155, total: 62.5 }
        }
      },
      {
        alertKey: 'demo_ncaaf_rose_bowl_berth',
        sport: 'NCAAF',
        gameId: 'demo_game_ncaaf_011',
        type: 'ROSE_BOWL_BERTH',
        state: 'active',
        score: 81,
        payload: {
          homeTeam: 'Penn State',
          awayTeam: 'Iowa',
          homeScore: 21,
          awayScore: 14,
          priority: 81,
          confidence: 77,
          message: 'ROSE BOWL! Penn State clinches Granddaddy berth!',
          context: 'B1G Championship game, Pasadena dreams realized',
          aiAdvice: 'PSU motivation peak. Rose Bowl prestige factor.',
          betting: { home: -165, away: +145, total: 44.0 }
        }
      },
      {
        alertKey: 'demo_ncaaf_cotton_bowl_classic',
        sport: 'NCAAF',
        gameId: 'demo_game_ncaaf_012',
        type: 'COTTON_BOWL_CLASSIC',
        state: 'active',
        score: 79,
        payload: {
          homeTeam: 'Notre Dame',
          awayTeam: 'Clemson',
          homeScore: 28,
          awayScore: 24,
          priority: 79,
          confidence: 75,
          message: 'COTTON BOWL CLASSIC! Notre Dame-Clemson thriller!',
          context: 'New Year\'s Six bowl, traditional powers collide',
          aiAdvice: 'ND covering +3. Bowl motivation even.',
          betting: { home: +125, away: -145, total: 51.5 }
        }
      },
      {
        alertKey: 'demo_ncaaf_sugar_bowl_upset',
        sport: 'NCAAF',
        gameId: 'demo_game_ncaaf_013',
        type: 'SUGAR_BOWL_UPSET',
        state: 'active',
        score: 86,
        payload: {
          homeTeam: 'Kansas State',
          awayTeam: 'Alabama',
          homeScore: 31,
          awayScore: 17,
          priority: 86,
          confidence: 82,
          message: 'SUGAR BOWL UPSET! Kansas State dominates Alabama!',
          context: 'Wildcats stunning Tide in New Orleans',
          aiAdvice: 'KSU +13.5 easy cover. Bowl upset special.',
          betting: { home: +385, away: -485, total: 58.0 }
        }
      },
      {
        alertKey: 'demo_ncaaf_peach_bowl_thriller',
        sport: 'NCAAF',
        gameId: 'demo_game_ncaaf_014',
        type: 'PEACH_BOWL_THRILLER',
        state: 'active',
        score: 87,
        payload: {
          homeTeam: 'Cincinnati',
          awayTeam: 'Georgia',
          homeScore: 21,
          awayScore: 24,
          priority: 87,
          confidence: 83,
          message: 'PEACH BOWL THRILLER! Cincinnati-Georgia instant classic!',
          context: 'Group of 5 vs SEC, David vs Goliath narrative',
          aiAdvice: 'CIN +7 covering. G5 pride factor maximum.',
          betting: { home: +225, away: -275, total: 52.5 }
        }
      },
      {
        alertKey: 'demo_ncaaf_fiesta_bowl_finale',
        sport: 'NCAAF',
        gameId: 'demo_game_ncaaf_015',
        type: 'FIESTA_BOWL_FINALE',
        state: 'active',
        score: 83,
        payload: {
          homeTeam: 'Oklahoma State',
          awayTeam: 'Notre Dame',
          homeScore: 35,
          awayScore: 28,
          priority: 83,
          confidence: 79,
          message: 'FIESTA BOWL! Oklahoma State leads Notre Dame in desert!',
          context: 'Big 12 vs Independent, contrasting styles',
          aiAdvice: 'OKST +2.5 value. Offensive tempo advantage.',
          betting: { home: +110, away: -130, total: 59.5 }
        }
      }
    ];
  }

  private getWNBADemoAlerts(): Omit<InsertAlert, 'isDemo'>[] {
    return [
      // Championship and playoff alerts (8 alerts)
      {
        alertKey: 'demo_wnba_finals_game7',
        sport: 'WNBA',
        gameId: 'demo_game_wnba_001',
        type: 'FINALS_GAME_SEVEN',
        state: 'active',
        score: 99,
        payload: {
          homeTeam: 'Las Vegas Aces',
          awayTeam: 'New York Liberty',
          homeScore: 78,
          awayScore: 75,
          priority: 99,
          confidence: 96,
          message: 'FINALS GAME 7! Aces lead Liberty 78-75, 3:42 left!',
          context: 'Championship on the line, A\'ja Wilson 28 points',
          aiAdvice: 'LV championship experience. Liberty desperation factor.',
          betting: { home: -115, away: -105, total: 165.5 }
        }
      },
      {
        alertKey: 'demo_wnba_dynasty_repeat',
        sport: 'WNBA',
        gameId: 'demo_game_wnba_002',
        type: 'CHAMPIONSHIP_REPEAT',
        state: 'active',
        score: 95,
        payload: {
          homeTeam: 'Las Vegas Aces',
          awayTeam: 'Connecticut Sun',
          homeScore: 85,
          awayScore: 79,
          priority: 95,
          confidence: 92,
          message: 'DYNASTY! Aces clinch back-to-back championships!',
          context: 'Modern WNBA greatness, franchise legacy cemented',
          aiAdvice: 'Vegas dynasty narrative. Championship pedigree showing.',
          betting: { home: -165, away: +145, total: 158.0 }
        }
      },
      {
        alertKey: 'demo_wnba_playoff_upset',
        sport: 'WNBA',
        gameId: 'demo_game_wnba_003',
        type: 'PLAYOFF_UPSET',
        state: 'active',
        score: 91,
        payload: {
          homeTeam: 'Indiana Fever',
          awayTeam: 'Las Vegas Aces',
          homeScore: 82,
          awayScore: 78,
          priority: 91,
          confidence: 88,
          message: 'MASSIVE UPSET! Fever eliminate defending champion Aces!',
          context: 'Caitlin Clark playoff breakthrough, shocking elimination',
          aiAdvice: 'IND +8.5 easy cover. Youth beats experience.',
          betting: { home: +285, away: -345, total: 170.5 }
        }
      },
      {
        alertKey: 'demo_wnba_elimination_game',
        sport: 'WNBA',
        gameId: 'demo_game_wnba_004',
        type: 'ELIMINATION_GAME',
        state: 'active',
        score: 93,
        payload: {
          homeTeam: 'Seattle Storm',
          awayTeam: 'Minnesota Lynx',
          homeScore: 74,
          awayScore: 71,
          priority: 93,
          confidence: 90,
          message: 'ELIMINATION! Storm season ends with loss to Lynx.',
          context: 'Sue Bird farewell tour, legendary career finale',
          aiAdvice: 'SEA emotional factor. Legend retirement game.',
          betting: { home: +135, away: -155, total: 152.5 }
        }
      },
      {
        alertKey: 'demo_wnba_semifinal_thriller',
        sport: 'WNBA',
        gameId: 'demo_game_wnba_005',
        type: 'SEMIFINAL_THRILLER',
        state: 'active',
        score: 88,
        payload: {
          homeTeam: 'Chicago Sky',
          awayTeam: 'Phoenix Mercury',
          homeScore: 89,
          awayScore: 87,
          priority: 88,
          confidence: 85,
          message: 'SEMIFINAL THRILLER! Sky edge Mercury in double OT!',
          context: 'Finals berth decided, Candace Parker heroics',
          aiAdvice: 'CHI covering +2.5. Veteran leadership crucial.',
          betting: { home: +115, away: -135, total: 168.0 }
        }
      },
      {
        alertKey: 'demo_wnba_rookie_playoffs',
        sport: 'WNBA',
        gameId: 'demo_game_wnba_006',
        type: 'ROOKIE_PLAYOFFS',
        state: 'active',
        score: 86,
        payload: {
          homeTeam: 'Indiana Fever',
          awayTeam: 'Atlanta Dream',
          homeScore: 95,
          awayScore: 88,
          priority: 86,
          confidence: 83,
          message: 'ROOKIE MAGIC! Caitlin Clark: 28 pts, 12 ast in playoffs!',
          context: 'Generational talent shining on biggest stage',
          aiAdvice: 'Clark playoff props valuable. Rookie record territory.',
          betting: { home: -120, away: +100, total: 175.5 }
        }
      },
      {
        alertKey: 'demo_wnba_veteran_farewell',
        sport: 'WNBA',
        gameId: 'demo_game_wnba_007',
        type: 'VETERAN_FAREWELL',
        state: 'active',
        score: 84,
        payload: {
          homeTeam: 'Seattle Storm',
          awayTeam: 'Phoenix Mercury',
          homeScore: 76,
          awayScore: 73,
          priority: 84,
          confidence: 81,
          message: 'FAREWELL TOUR! Diana Taurasi final playoff game.',
          context: 'GOAT candidate retirement, emotional sendoff',
          aiAdvice: 'SEA respect factor. Taurasi legacy moment.',
          betting: { home: -145, away: +125, total: 155.0 }
        }
      },
      {
        alertKey: 'demo_wnba_commissioner_cup',
        sport: 'WNBA',
        gameId: 'demo_game_wnba_008',
        type: 'COMMISSIONER_CUP',
        state: 'active',
        score: 82,
        payload: {
          homeTeam: 'New York Liberty',
          awayTeam: 'Las Vegas Aces',
          homeScore: 83,
          awayScore: 80,
          priority: 82,
          confidence: 79,
          message: 'COMMISSIONER\'S CUP! Liberty edge Aces for title!',
          context: 'Mid-season championship, bonus money on line',
          aiAdvice: 'NY +3.5 covering. In-season tournament intensity.',
          betting: { home: +135, away: -155, total: 162.5 }
        }
      },

      // Star performances and milestones (7 alerts)
      {
        alertKey: 'demo_wnba_triple_double',
        sport: 'WNBA',
        gameId: 'demo_game_wnba_009',
        type: 'TRIPLE_DOUBLE',
        state: 'active',
        score: 89,
        payload: {
          homeTeam: 'Chicago Sky',
          awayTeam: 'Washington Mystics',
          homeScore: 92,
          awayScore: 85,
          priority: 89,
          confidence: 86,
          message: 'TRIPLE-DOUBLE! Sabrina Ionescu: 24 pts, 11 reb, 10 ast!',
          context: 'Elite all-around performance, franchise record',
          aiAdvice: 'Ionescu triple-double prop +185 cashed. Elite playmaker.',
          betting: { home: -155, away: +135, total: 168.5 }
        }
      },
      {
        alertKey: 'demo_wnba_scoring_record',
        sport: 'WNBA',
        gameId: 'demo_game_wnba_010',
        type: 'SCORING_RECORD',
        state: 'active',
        score: 94,
        payload: {
          homeTeam: 'Las Vegas Aces',
          awayTeam: 'Dallas Wings',
          homeScore: 98,
          awayScore: 89,
          priority: 94,
          confidence: 91,
          message: 'SCORING RECORD! A\'ja Wilson: 45 points, franchise record!',
          context: 'MVP candidate dominant performance, career high',
          aiAdvice: 'Wilson 25+ points prop maxed out. Elite scorer.',
          betting: { home: -195, away: +175, total: 178.0 }
        }
      },
      {
        alertKey: 'demo_wnba_perfect_shooting',
        sport: 'WNBA',
        gameId: 'demo_game_wnba_011',
        type: 'PERFECT_SHOOTING',
        state: 'active',
        score: 87,
        payload: {
          homeTeam: 'New York Liberty',
          awayTeam: 'Connecticut Sun',
          homeScore: 86,
          awayScore: 79,
          priority: 87,
          confidence: 84,
          message: 'PERFECT! Breanna Stewart: 8/8 from three-point range!',
          context: 'Elite shooting display, career-high 3PM',
          aiAdvice: 'Stewart 3PM props demolished. Historic accuracy.',
          betting: { home: -125, away: +105, total: 159.5 }
        }
      },
      {
        alertKey: 'demo_wnba_assists_record',
        sport: 'WNBA',
        gameId: 'demo_game_wnba_012',
        type: 'ASSISTS_RECORD',
        state: 'active',
        score: 85,
        payload: {
          homeTeam: 'Seattle Storm',
          awayTeam: 'Phoenix Mercury',
          homeScore: 91,
          awayScore: 84,
          priority: 85,
          confidence: 82,
          message: 'ASSISTS RECORD! Jewell Loyd: 16 assists, franchise record!',
          context: 'Elite playmaking, team-first performance',
          aiAdvice: 'Loyd assists prop +150 easy money. Court vision elite.',
          betting: { home: -140, away: +120, total: 172.5 }
        }
      },
      {
        alertKey: 'demo_wnba_blocks_milestone',
        sport: 'WNBA',
        gameId: 'demo_game_wnba_013',
        type: 'BLOCKS_MILESTONE',
        state: 'active',
        score: 81,
        payload: {
          homeTeam: 'Las Vegas Aces',
          awayTeam: 'Indiana Fever',
          homeScore: 77,
          awayScore: 70,
          priority: 81,
          confidence: 78,
          message: 'BLOCKS MILESTONE! A\'ja Wilson reaches 1000 career blocks!',
          context: 'Defensive excellence, franchise cornerstone',
          aiAdvice: 'Wilson blocks prop +110 profitable. Defensive anchor.',
          betting: { home: -175, away: +155, total: 154.0 }
        }
      },
      {
        alertKey: 'demo_wnba_mvp_performance',
        sport: 'WNBA',
        gameId: 'demo_game_wnba_014',
        type: 'MVP_PERFORMANCE',
        state: 'active',
        score: 92,
        payload: {
          homeTeam: 'New York Liberty',
          awayTeam: 'Minnesota Lynx',
          homeScore: 94,
          awayScore: 87,
          priority: 92,
          confidence: 89,
          message: 'MVP PERFORMANCE! Breanna Stewart: 35 pts, 12 reb, 8 ast!',
          context: 'Elite all-around game, MVP race statement',
          aiAdvice: 'Stewart MVP odds improving. Complete performance.',
          betting: { home: -165, away: +145, total: 171.0 }
        }
      },
      {
        alertKey: 'demo_wnba_clutch_performance',
        sport: 'WNBA',
        gameId: 'demo_game_wnba_015',
        type: 'CLUTCH_PERFORMANCE',
        state: 'active',
        score: 90,
        payload: {
          homeTeam: 'Connecticut Sun',
          awayTeam: 'Chicago Sky',
          homeScore: 81,
          awayScore: 78,
          priority: 90,
          confidence: 87,
          message: 'CLUTCH! Alyssa Thomas: 15 points in final 5 minutes!',
          context: 'Elite closer, game-winning mentality',
          aiAdvice: 'Thomas clutch factor. CONN covering +1.5.',
          betting: { home: +115, away: -135, total: 161.5 }
        }
      }
    ];
  }

  private getCFLDemoAlerts(): Omit<InsertAlert, 'isDemo'>[] {
    return [
      // Grey Cup and championship implications (4 alerts)
      {
        alertKey: 'demo_cfl_grey_cup_classic',
        sport: 'CFL',
        gameId: 'demo_game_cfl_001',
        type: 'GREY_CUP_CLASSIC',
        state: 'active',
        score: 98,
        payload: {
          homeTeam: 'Toronto Argonauts',
          awayTeam: 'Calgary Stampeders',
          homeScore: 24,
          awayScore: 21,
          priority: 98,
          confidence: 95,
          message: 'GREY CUP! Argonauts lead Stampeders 24-21 in 4th!',
          context: 'Canadian championship, 110th Grey Cup classic',
          aiAdvice: 'TOR +2.5 covering. Home field advantage in title game.',
          betting: { home: +120, away: -140, total: 52.5 }
        }
      },
      {
        alertKey: 'demo_cfl_east_championship',
        sport: 'CFL',
        gameId: 'demo_game_cfl_002',
        type: 'DIVISION_CHAMPIONSHIP',
        state: 'active',
        score: 91,
        payload: {
          homeTeam: 'Montreal Alouettes',
          awayTeam: 'Toronto Argonauts',
          homeScore: 28,
          awayScore: 17,
          priority: 91,
          confidence: 88,
          message: 'EAST FINAL! Alouettes dominate Argonauts, Grey Cup bound!',
          context: 'Quebec pride, first Grey Cup appearance since 2010',
          aiAdvice: 'MTL -3.5 easy cover. Home crowd factor massive.',
          betting: { home: -155, away: +135, total: 48.0 }
        }
      },
      {
        alertKey: 'demo_cfl_west_semifinal',
        sport: 'CFL',
        gameId: 'demo_game_cfl_003',
        type: 'PLAYOFF_SEMIFINAL',
        state: 'active',
        score: 87,
        payload: {
          homeTeam: 'Winnipeg Blue Bombers',
          awayTeam: 'BC Lions',
          homeScore: 31,
          awayScore: 24,
          priority: 87,
          confidence: 84,
          message: 'WEST SEMIFINAL! Blue Bombers edge Lions in thriller!',
          context: 'Defending Grey Cup champions advancing',
          aiAdvice: 'WPG championship experience. +1.5 covering.',
          betting: { home: +105, away: -125, total: 51.5 }
        }
      },
      {
        alertKey: 'demo_cfl_crossover_playoff',
        sport: 'CFL',
        gameId: 'demo_game_cfl_004',
        type: 'CROSSOVER_GAME',
        state: 'active',
        score: 83,
        payload: {
          homeTeam: 'Saskatchewan Roughriders',
          awayTeam: 'Hamilton Tiger-Cats',
          homeScore: 21,
          awayScore: 18,
          priority: 83,
          confidence: 80,
          message: 'CROSSOVER! Roughriders upset Tiger-Cats in Hamilton!',
          context: 'West team in East playoff, unusual format',
          aiAdvice: 'SASK +6.5 covering. Crossover chaos factor.',
          betting: { home: +195, away: -235, total: 46.5 }
        }
      },

      // CFL-specific situations (3 alerts)
      {
        alertKey: 'demo_cfl_rouge_opportunity',
        sport: 'CFL',
        gameId: 'demo_game_cfl_005',
        type: 'ROUGE_OPPORTUNITY',
        state: 'active',
        score: 75,
        payload: {
          homeTeam: 'Edmonton Elks',
          awayTeam: 'Calgary Stampeders',
          homeScore: 23,
          awayScore: 24,
          priority: 75,
          confidence: 71,
          message: 'ROUGE CHANCE! Elks 55-yard FG attempt for tie!',
          context: 'CFL single point rule, game-tying opportunity',
          aiAdvice: 'EDM +1.5 still alive. Rouge keeps hopes alive.',
          betting: { home: +155, away: -175, total: 49.0 }
        }
      },
      {
        alertKey: 'demo_cfl_three_down_conversion',
        sport: 'CFL',
        gameId: 'demo_game_cfl_006',
        type: 'THREE_DOWN_CONVERSION',
        state: 'active',
        score: 79,
        payload: {
          homeTeam: 'Ottawa Redblacks',
          awayTeam: 'Montreal Alouettes',
          homeScore: 17,
          awayScore: 14,
          priority: 79,
          confidence: 76,
          message: 'THIRD DOWN! Redblacks gambling on 3rd & 8 at midfield.',
          context: 'CFL aggression, three-down football strategy',
          aiAdvice: 'OTT risk-taking. Canadian football mentality.',
          betting: { home: +125, away: -145, total: 44.5 }
        }
      },
      {
        alertKey: 'demo_cfl_weather_dome',
        sport: 'CFL',
        gameId: 'demo_game_cfl_007',
        type: 'DOME_ADVANTAGE',
        state: 'active',
        score: 72,
        payload: {
          homeTeam: 'BC Lions',
          awayTeam: 'Saskatchewan Roughriders',
          homeScore: 35,
          awayScore: 21,
          priority: 72,
          confidence: 68,
          message: 'DOME EXPLOSION! Lions offense thriving in perfect conditions.',
          context: 'Vancouver dome vs prairie weather team',
          aiAdvice: 'BC home field advantage. Dome teams trend OVER.',
          betting: { home: -185, away: +165, total: 54.0 }
        }
      },

      // Historic moments and milestones (3 alerts)
      {
        alertKey: 'demo_cfl_franchise_record',
        sport: 'CFL',
        gameId: 'demo_game_cfl_008',
        type: 'FRANCHISE_RECORD',
        state: 'active',
        score: 86,
        payload: {
          homeTeam: 'Calgary Stampeders',
          awayTeam: 'Edmonton Elks',
          homeScore: 42,
          awayScore: 28,
          priority: 86,
          confidence: 82,
          message: 'FRANCHISE RECORD! Bo Levi Mitchell: 6 TDs, Stampeders record!',
          context: 'Battle of Alberta, QB excellence',
          aiAdvice: 'Mitchell props maxed out. Elite QB performance.',
          betting: { home: -165, away: +145, total: 56.5 }
        }
      },
      {
        alertKey: 'demo_cfl_labour_day_classic',
        sport: 'CFL',
        gameId: 'demo_game_cfl_009',
        type: 'LABOUR_DAY_CLASSIC',
        state: 'active',
        score: 88,
        payload: {
          homeTeam: 'Saskatchewan Roughriders',
          awayTeam: 'Winnipeg Blue Bombers',
          homeScore: 28,
          awayScore: 24,
          priority: 88,
          confidence: 85,
          message: 'LABOUR DAY CLASSIC! Roughriders edge Blue Bombers!',
          context: 'Canadian tradition, prairie rivalry at its finest',
          aiAdvice: 'SASK +3.5 covering. Home crowd factor enormous.',
          betting: { home: +135, away: -155, total: 47.5 }
        }
      },
      {
        alertKey: 'demo_cfl_thanksgiving_thriller',
        sport: 'CFL',
        gameId: 'demo_game_cfl_010',
        type: 'THANKSGIVING_GAME',
        state: 'active',
        score: 84,
        payload: {
          homeTeam: 'Hamilton Tiger-Cats',
          awayTeam: 'Toronto Argonauts',
          homeScore: 31,
          awayScore: 27,
          priority: 84,
          confidence: 81,
          message: 'THANKSGIVING THRILLER! Tiger-Cats lead Argonauts in final minutes!',
          context: 'Ontario rivalry, Canadian Thanksgiving tradition',
          aiAdvice: 'HAM covering +1.5. Rivalry intensity maximum.',
          betting: { home: +105, away: -125, total: 51.0 }
        }
      }
    ];
  }
}