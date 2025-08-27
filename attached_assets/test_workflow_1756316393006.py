"""
test_workflow.py
=================

This script implements a simple test harness to exercise the multi-sport alert workflow
described for the Chirbot system.  It is designed to help you trace and verify the
behaviour of your current implementation by simulating different game states and
capturing which layers (sport engine, weather engine, AI engine) are invoked and
what alert level they produce.

The script uses Python's built‑in logging module to write output both to the console
and to a log file (`test_workflow.log`), so you can review the order of operations
after running the test.  It currently includes a baseball engine with dummy logic
based on runners on base and the number of outs, but it is structured so that you
can add additional sport engines later.

To run this script:

    python test_workflow.py

Once executed, inspect the console output or the generated `test_workflow.log`
to see which alerts were raised and at what level.  This should help you
identify any missing triggers or misordered logic in your current system.
"""

import logging
from typing import Dict, Optional


class SportEngine:
    """Base class for sport-specific engines."""

    def __init__(self, sport_name: str) -> None:
        self.sport_name = sport_name

    def check_event(self, game_state: Dict) -> bool:
        """Return True if a level‑1 alert should be raised.

        Subclasses should implement sport‑specific logic.
        """
        raise NotImplementedError


class BaseballEngine(SportEngine):
    """Example engine for baseball games."""

    def __init__(self) -> None:
        super().__init__(sport_name="baseball")

    def check_event(self, game_state: Dict) -> bool:
        # Level‑1: runners on 1st and 2nd with <=1 out
        return (
            game_state.get("bases") == "runners on 1st and 2nd"
            and game_state.get("outs", 0) <= 1
        )


def get_weather_favourable(game_state: Dict) -> bool:
    """Stub for weather engine.

    In a real implementation, this function would query a weather API
    for the game's location.  Here we return a hard‑coded result so
    you can verify that the weather layer is invoked correctly.
    """
    weather = {
        "wind_direction": "out to left field",
        "wind_speed": 12,  # mph
    }
    logging.info("Weather check: %s", weather)
    return weather["wind_direction"].startswith("out") and weather["wind_speed"] >= 10


def ai_high_impact(game_state: Dict) -> bool:
    """Stub for AI engine.

    Uses player statistics to decide if the moment is especially
    noteworthy.  The hard‑coded thresholds here are for demonstration;
    replace them with calls into your real analytics engine.
    """
    player_stats = {
        "name": game_state.get("batter", "Unknown"),
        "home_runs": 35,
        "slugging": 0.58,
    }
    logging.info("AI evaluation: %s", player_stats)
    return player_stats["home_runs"] >= 30 and player_stats["slugging"] >= 0.5


def run_workflow(game_state: Dict, sports_enabled: Dict[str, bool]) -> Optional[int]:
    """Run through the alert workflow for a single game state.

    Returns the final alert level (1, 2, or 3) if an alert is raised; otherwise None.
    """
    sport = game_state.get("sport")
    logging.info("=== Processing %s game ===", sport)
    # Map from sport to engine classes; extend this dict as you add sports
    engines = {
        "baseball": BaseballEngine(),
        # "football": FootballEngine(),
        # "basketball": BasketballEngine(),
    }
    engine = engines.get(sport)
    if not engine:
        logging.warning("No engine available for sport: %s", sport)
        return None
    # Check level‑1 via sport engine
    if sports_enabled.get(sport, False) and engine.check_event(game_state):
        alert_level = 1
        logging.info("Level‑1 alert from %s engine", sport)
        # Weather layer (if applicable)
        if sports_enabled.get("weather", False) and get_weather_favourable(game_state):
            alert_level = 2
            logging.info("Weather escalated to level‑2")
        # AI layer (if applicable)
        if sports_enabled.get("ai", False) and ai_high_impact(game_state):
            alert_level = 3
            logging.info("AI escalated to level‑3")
        logging.info("Final alert level: %d", alert_level)
        return alert_level
    else:
        logging.info("No level‑1 trigger met for %s", sport)
        return None


def configure_logging() -> None:
    """Set up logging to console and file."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler("test_workflow.log", mode="w"),
            logging.StreamHandler(),
        ],
    )


def main() -> None:
    configure_logging()
    # Define which modules are enabled.  Toggle values to test different paths
    enabled_modules = {
        "baseball": True,
        # Future sports e.g. "football": False
        "weather": True,
        "ai": True,
    }
    # Define some test scenarios
    test_scenarios = [
        {
            "sport": "baseball",
            "game_id": "NYMvsLAD_2025-08-27",
            "bases": "runners on 1st and 2nd",
            "outs": 1,
            "batter": "Shohei Ohtani",
        },
        {
            "sport": "baseball",
            "game_id": "NYYvsBOS_2025-08-27",
            "bases": "empty",
            "outs": 2,
            "batter": "Mike Trout",
        },
        {
            "sport": "baseball",
            "game_id": "LADvsSFG_2025-08-27",
            "bases": "runners on 1st and 2nd",
            "outs": 2,
            "batter": "Mookie Betts",
        },
    ]
    # Run each scenario
    for idx, game in enumerate(test_scenarios, start=1):
        logging.info("\n--- Scenario %d ---", idx)
        result = run_workflow(game, enabled_modules)
        if result is None:
            logging.info("No alert produced for scenario %d", idx)


if __name__ == "__main__":
    main()