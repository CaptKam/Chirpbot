"""
analyze_alert_logs.py
=====================

This script parses a log file produced by your alert system and looks for
patterns that may indicate problems, such as duplicate alerts or batches of
alerts firing at the same time. It is intended to help you diagnose
whether your current system is producing too many alerts or repeating
the same alert multiple times within a short interval.

Usage:
    python analyze_alert_logs.py --logfile path/to/logfile.log [--window 60] [--batch_threshold 5]

Options:
    --logfile: path to the log file to analyze (required).
    --window: time window in seconds to consider for duplicate detection (default 60).
    --batch_threshold: number of alerts within one second that constitutes a batch (default 5).

The script assumes your log lines start with a timestamp in the form
`YYYY-MM-DD HH:MM:SS,ms [LEVEL] message`. You may need to adjust the regular
expression if your log format differs. Alerts are detected by the presence
of the word "alert" in the log message (case‑insensitive). Adjust the
`is_alert` function as necessary to fit your own messages.
"""

import argparse
import datetime as dt
import re
from collections import defaultdict
from typing import List, Tuple


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze alert logs for duplicates and batching.")
    parser.add_argument(
        "--logfile",
        required=True,
        help="Path to the log file to analyze.",
    )
    parser.add_argument(
        "--window",
        type=int,
        default=60,
        help="Time window in seconds within which duplicate alerts are flagged (default: 60).",
    )
    parser.add_argument(
        "--batch_threshold",
        type=int,
        default=5,
        help="Number of alerts within a one-second interval considered a batch (default: 5).",
    )
    return parser.parse_args()


LOG_PATTERN = re.compile(
    r"^(?P<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}) \[(?P<level>[^]]+)\] (?P<message>.*)$"
)


def is_alert(message: str) -> bool:
    """Determine whether a log message constitutes an alert.

    This simplistic check looks for the substring "alert". Modify
    this function if your log messages use different terminology.
    """
    return "alert" in message.lower()


def parse_log_line(line: str) -> Tuple[dt.datetime, str]:
    """Parse a single line of the log.

    Returns a tuple of (timestamp, message) if the line matches the expected format.
    Returns (None, None) if the line cannot be parsed.
    """
    match = LOG_PATTERN.match(line.strip())
    if not match:
        return None, None
    timestamp_str = match.group("timestamp")
    message = match.group("message")
    try:
        # Remove the comma in milliseconds for datetime.fromisoformat
        ts = dt.datetime.fromisoformat(timestamp_str.replace(",", "."))
        return ts, message
    except Exception:
        return None, None


def analyze_log(
    logfile: str, window: int = 60, batch_threshold: int = 5
) -> None:
    """Analyze the given log file for duplicate alerts and batches.

    Args:
        logfile: path to the log file to analyze.
        window: time window in seconds to consider for duplicate detection.
        batch_threshold: number of alerts within a one-second interval considered a batch.
    """
    duplicates: defaultdict[str, List[dt.datetime]] = defaultdict(list)
    batches: defaultdict[dt.datetime, int] = defaultdict(int)
    with open(logfile, "r", encoding="utf-8") as f:
        for line in f:
            ts, msg = parse_log_line(line)
            if ts is None or msg is None:
                continue
            if is_alert(msg):
                # Track duplicates by message
                duplicates[msg].append(ts)
                # Track counts per second for batching
                second_ts = ts.replace(microsecond=0)
                batches[second_ts] += 1
    # Detect duplicate alerts
    print(f"\nDuplicate alerts occurring within {window} seconds:\n" + "=" * 40)
    duplicate_found = False
    for msg, times in duplicates.items():
        times.sort()
        for i in range(1, len(times)):
            delta = (times[i] - times[i - 1]).total_seconds()
            if delta < window:
                duplicate_found = True
                print(
                    f"Alert: '{msg}' repeated after {delta:.3f}s at {times[i - 1]} and {times[i]}"
                )
    if not duplicate_found:
        print("No duplicate alerts detected within the specified window.")
    # Detect batched alerts
    print(f"\nAlert batches (>{batch_threshold} in the same second):\n" + "=" * 40)
    batch_found = False
    for second_ts, count in sorted(batches.items()):
        if count > batch_threshold:
            batch_found = True
            print(f"{second_ts}: {count} alerts")
    if not batch_found:
        print("No batches exceeding the threshold were found.")


def main() -> None:
    args = parse_args()
    analyze_log(args.logfile, args.window, args.batch_threshold)


if __name__ == "__main__":
    main()