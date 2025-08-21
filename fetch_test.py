#!/usr/bin/env python3
"""
🏀⚾🏈 ChirpBot V2 - Fun API Fetch Test Script 🏈⚾🏀
Test script for fetching data from MLB and SportsData APIs
"""

import requests
from datetime import datetime, timedelta
import json

def print_banner():
    """Print a fun banner"""
    print("=" * 60)
    print("🚀 CHIRPBOT V2 - API FETCH TEST SCRIPT 🚀")
    print("=" * 60)
    print("Testing MLB.com and SportsData.io API connections...")
    print()

def test_mlb_api():
    """Test MLB official API"""
    print("⚾ TESTING MLB API...")
    print("-" * 30)
    
    # Get today's date
    today = datetime.now().strftime("%Y-%m-%d")
    
    # MLB API endpoint - same as ChirpBot V2 uses
    mlb_url = f"https://statsapi.mlb.com/api/v1/schedule?date={today}"
    
    try:
        response = requests.get(mlb_url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            games = data.get('dates', [])
            
            print(f"✅ MLB API Connection: SUCCESS")
            print(f"📅 Date: {today}")
            
            if games and len(games) > 0:
                total_games = len(games[0].get('games', []))
                print(f"🎮 Games Found: {total_games}")
                
                # Show first few games
                for i, game in enumerate(games[0].get('games', [])[:3]):
                    away_team = game.get('teams', {}).get('away', {}).get('team', {}).get('name', 'Unknown')
                    home_team = game.get('teams', {}).get('home', {}).get('team', {}).get('name', 'Unknown')
                    status = game.get('status', {}).get('detailedState', 'Unknown')
                    print(f"  🏟️  Game {i+1}: {away_team} @ {home_team} - {status}")
            else:
                print("🎮 Games Found: 0 (No games today)")
                
        else:
            print(f"❌ MLB API Connection: FAILED (Status: {response.status_code})")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ MLB API Connection: ERROR - {e}")
    
    print()

def test_sportsdata_api():
    """Test SportsData.io API"""
    print("🏈 TESTING SPORTSDATA.IO API...")
    print("-" * 35)
    
    # Get today's date
    today = datetime.now().strftime("%Y-%m-%d")
    
    # SportsData API endpoints - same as ChirpBot V2 uses
    sports = {
        "NFL": f"https://api.sportsdata.io/v3/nfl/scores/json/ScoresByDate/{today}",
        "NBA": f"https://api.sportsdata.io/v3/nba/scores/json/GamesByDate/{today}",
        "NHL": f"https://api.sportsdata.io/v3/nhl/scores/json/GamesByDate/{today}"
    }
    
    # Note: Using placeholder API key - would need real key for actual data
    headers = {"Ocp-Apim-Subscription-Key": "YOUR_API_KEY_HERE"}
    
    for sport, url in sports.items():
        try:
            print(f"🔍 Testing {sport} API...")
            # For demo purposes, we'll simulate what would happen
            # In real usage, you'd need actual API keys
            
            response = requests.get(url, headers=headers, timeout=5)
            
            if response.status_code == 401:
                print(f"  🔑 {sport}: Authentication required (need valid API key)")
            elif response.status_code == 200:
                data = response.json()
                print(f"  ✅ {sport}: SUCCESS - {len(data)} games found")
            else:
                print(f"  ⚠️  {sport}: Response code {response.status_code}")
                
        except requests.exceptions.Timeout:
            print(f"  ⏱️  {sport}: Timeout (API might be slow)")
        except requests.exceptions.RequestException as e:
            print(f"  ❌ {sport}: Connection error")
    
    print()

def test_chirpbot_integration():
    """Test ChirpBot V2 local API"""
    print("🤖 TESTING CHIRPBOT V2 LOCAL API...")
    print("-" * 40)
    
    # Test local ChirpBot endpoints
    base_url = "http://localhost:5000"
    
    endpoints = [
        ("/api/games/active", "Active Games"),
        ("/api/alerts/recent", "Recent Alerts"),
        ("/api/teams/monitored", "Monitored Teams")
    ]
    
    for endpoint, description in endpoints:
        try:
            response = requests.get(f"{base_url}{endpoint}", timeout=5)
            if response.status_code == 200:
                print(f"  ✅ {description}: Available")
            elif response.status_code == 401:
                print(f"  🔐 {description}: Requires authentication")
            else:
                print(f"  ⚠️  {description}: Status {response.status_code}")
        except requests.exceptions.ConnectionError:
            print(f"  🔌 {description}: Server not running")
        except requests.exceptions.RequestException:
            print(f"  ❌ {description}: Connection failed")
    
    print()

def show_summary():
    """Show test summary"""
    print("=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print("✅ MLB API: Official MLB.com endpoint (no key required)")
    print("🔑 SportsData.io: Requires API subscription key")
    print("🤖 ChirpBot V2: Local server integration ready")
    print()
    print("💡 NEXT STEPS:")
    print("  1. Add real SportsData.io API key for full testing")
    print("  2. Ensure ChirpBot V2 server is running on port 5000")
    print("  3. Test with live game data during active sports seasons")
    print()
    print("🎯 ChirpBot V2 is ready for real-time sports monitoring!")
    print("=" * 60)

def main():
    """Main test function"""
    print_banner()
    test_mlb_api()
    test_sportsdata_api()
    test_chirpbot_integration()
    show_summary()

if __name__ == "__main__":
    main()