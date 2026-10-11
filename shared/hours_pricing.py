"""
Opening hours parsing, evaluation, and pricing utilities for Outing Recommender.

Timezone: Asia/Kolkata (IST).
Supports:
- Canonical weekly opening hours: {"mon": [["09:00", "22:00"]], ...}
- Multiple time ranges per day: [["11:30", "15:30"], ["19:00", "23:30"]]
- Closing after midnight (e.g. 18:00 - 01:30)
- Closed days ([])
- Parsing standard OpenStreetMap opening_hours expressions
- Category-based realistic Indian defaults for hours and pricing
- Accurate evaluation of open_now, "opens at X", "closes in N min", and today's hours
"""
from __future__ import annotations

import re
from datetime import datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

KOLKATA_TZ = ZoneInfo("Asia/Kolkata")
WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
DAY_INDEX_MAP = {day: idx for idx, day in enumerate(WEEKDAYS)}
OSM_DAY_MAP = {
    "mo": "mon",
    "tu": "tue",
    "we": "wed",
    "th": "thu",
    "fr": "fri",
    "sa": "sat",
    "su": "sun",
    "mon": "mon",
    "tue": "tue",
    "wed": "wed",
    "thu": "thu",
    "fri": "fri",
    "sat": "sat",
    "sun": "sun",
}

# Category defaults tailored to Indian cities
CATEGORY_DEFAULTS: dict[str, dict[str, Any]] = {
    "cafe": {
        "hours": {d: [["09:00", "23:00"]] for d in WEEKDAYS},
        "price_range": 2,
        "cost_for_two": 600.0,
        "entry_fee": 0.0,
    },
    "restaurant": {
        "hours": {d: [["11:30", "15:30"], ["19:00", "23:30"]] for d in WEEKDAYS},
        "price_range": 2,
        "cost_for_two": 1200.0,
        "entry_fee": 0.0,
    },
    "bar": {
        "hours": {d: [["12:00", "01:00"]] for d in WEEKDAYS},
        "price_range": 3,
        "cost_for_two": 1800.0,
        "entry_fee": 0.0,
    },
    "park": {
        "hours": {d: [["06:00", "20:00"]] for d in WEEKDAYS},
        "price_range": 1,
        "cost_for_two": 50.0,
        "entry_fee": 20.0,
    },
    "attraction": {
        "hours": {
            d: [["09:00", "17:30"]] if d != "mon" else [] for d in WEEKDAYS
        },  # Monuments often closed on Mondays in India
        "price_range": 1,
        "cost_for_two": 200.0,
        "entry_fee": 50.0,
    },
    "museum": {
        "hours": {
            d: [["10:00", "17:00"]] if d != "mon" else [] for d in WEEKDAYS
        },
        "price_range": 1,
        "cost_for_two": 200.0,
        "entry_fee": 50.0,
    },
    "cinema": {
        "hours": {d: [["10:00", "23:30"]] for d in WEEKDAYS},
        "price_range": 2,
        "cost_for_two": 700.0,
        "entry_fee": 0.0,
    },
    "shopping": {
        "hours": {d: [["10:30", "22:00"]] for d in WEEKDAYS},
        "price_range": 2,
        "cost_for_two": 1000.0,
        "entry_fee": 0.0,
    },
}

FALLBACK_DEFAULT = {
    "hours": {d: [["10:00", "22:00"]] for d in WEEKDAYS},
    "price_range": 2,
    "cost_for_two": 600.0,
    "entry_fee": 0.0,
}


def get_category_default(category: str | None) -> dict[str, Any]:
    cat = (category or "").lower().strip()
    return CATEGORY_DEFAULTS.get(cat, FALLBACK_DEFAULT)


def parse_osm_opening_hours(raw: str | None) -> dict[str, list[list[str]]] | None:
    """
    Parse common OpenStreetMap opening_hours tag values into canonical weekly dict.
    Examples:
      - '24/7'
      - 'Mo-Su 10:00-22:00'
      - 'Mo-Fr 09:00-20:00; Sa-Su 10:00-22:00'
      - 'Tu-Su 09:00-17:30' (Mon implied closed)
      - '11:00-23:00'
      - 'Mo-Sa 11:30-15:30, 19:00-23:00; Su 12:00-23:00'
    Returns canonical dict or None if cannot parse.
    """
    if not raw or not isinstance(raw, str):
        return None
    s = raw.strip()
    if not s or s.lower() in ("unknown", "fixme"):
        return None

    if s == "24/7":
        return {d: [["00:00", "24:00"]] for d in WEEKDAYS}

    # Start with empty days
    result: dict[str, list[list[str]]] = {d: [] for d in WEEKDAYS}
    rules = [r.strip() for r in s.split(";") if r.strip()]
    if not rules:
        return None

    days_set_any = False

    time_range_re = re.compile(r"(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})")

    for rule in rules:
        rule_lower = rule.lower()
        if "off" in rule_lower or "closed" in rule_lower:
            # Explicit off rule, e.g. 'Mo off'
            day_matches = re.findall(r"\b(mo|tu|we|th|fr|sa|su)\b", rule_lower)
            for dm in day_matches:
                mapped = OSM_DAY_MAP.get(dm)
                if mapped:
                    result[mapped] = []
                    days_set_any = True
            continue

        # Extract time ranges in this rule
        times = time_range_re.findall(rule)
        if not times:
            # Check for sunrise-sunset or similar
            if "sunrise" in rule_lower and "sunset" in rule_lower:
                times = [("06:00", "18:30")]
            else:
                continue

        norm_times = []
        for start_t, end_t in times:
            sh, sm = [int(x) for x in start_t.split(":")]
            eh, em = [int(x) for x in end_t.split(":")]
            norm_times.append([f"{sh:02d}:{sm:02d}", f"{eh:02d}:{em:02d}"])

        # Determine target days for this rule
        # Check range e.g. 'Mo-Fr'
        range_match = re.search(r"\b(mo|tu|we|th|fr|sa|su)\s*-\s*(mo|tu|we|th|fr|sa|su)\b", rule_lower)
        if range_match:
            start_d = OSM_DAY_MAP[range_match.group(1)]
            end_d = OSM_DAY_MAP[range_match.group(2)]
            s_idx = DAY_INDEX_MAP[start_d]
            e_idx = DAY_INDEX_MAP[end_d]
            if s_idx <= e_idx:
                target_days = WEEKDAYS[s_idx : e_idx + 1]
            else:
                target_days = WEEKDAYS[s_idx:] + WEEKDAYS[: e_idx + 1]
        else:
            # Check individual day tokens
            individual_days = re.findall(r"\b(mo|tu|we|th|fr|sa|su)\b", rule_lower)
            if individual_days:
                target_days = [OSM_DAY_MAP[d] for d in individual_days if d in OSM_DAY_MAP]
            elif "daily" in rule_lower or not re.search(r"[a-z]{2}", rule_lower):
                # No specific days specified -> applies to all days
                target_days = list(WEEKDAYS)
            else:
                target_days = list(WEEKDAYS)

        for d in target_days:
            result[d].extend(norm_times)
            days_set_any = True

    return result if days_set_any else None


def format_12hr(time_str: str) -> str:
    """Converts '09:00' to '9 AM', '17:30' to '5:30 PM', '00:00' to '12 AM', '24:00' to '12 AM'."""
    try:
        parts = time_str.split(":")
        h = int(parts[0])
        m = int(parts[1]) if len(parts) > 1 else 0
        if h == 24 and m == 0:
            return "12 AM"
        period = "AM" if h < 12 or h == 24 else "PM"
        display_h = h % 12
        if display_h == 0:
            display_h = 12
        if m == 0:
            return f"{display_h} {period}"
        return f"{display_h}:{m:02d} {period}"
    except Exception:
        return time_str


def format_time_range(range_pair: list[str]) -> str:
    """Formats ['11:30', '15:30'] as '11:30 AM – 3:30 PM'."""
    if len(range_pair) != 2:
        return ""
    start, end = range_pair
    return f"{format_12hr(start)} – {format_12hr(end)}"


def format_day_schedule(ranges: list[list[str]] | None) -> str:
    if not ranges:
        return "Closed"
    return ", ".join(format_time_range(r) for r in ranges)


def _parse_hm_minutes(t_str: str) -> int:
    h, m = [int(x) for x in t_str.split(":")]
    return h * 60 + m


def evaluate_place_hours(
    opening_hours: dict[str, Any] | None,
    ref_dt: datetime | None = None,
) -> dict[str, Any]:
    """
    Evaluates opening hours in Asia/Kolkata timezone.
    Returns:
      open_now: bool | None (None if hours missing)
      hours_status: "Open now" | "Closed" | "Hours unavailable"
      hours_detail: "Open until 11 PM" | "Opens at 7 PM" | "Closes in 40 min" | "Hours unavailable"
      today_hours: string representation for today
      weekly_hours: canonical weekly dict
      closes_in_minutes: int | None
      opens_at: str | None
    """
    empty_result = {
        "open_now": None,
        "hours_status": "Hours unavailable",
        "hours_detail": "Hours unavailable",
        "today_hours": "Hours unavailable",
        "weekly_hours": {},
        "closes_in_minutes": None,
        "opens_at": None,
    }

    if not opening_hours or not isinstance(opening_hours, dict):
        return empty_result

    # Check if all days are missing
    has_any = any(k in opening_hours for k in WEEKDAYS)
    if not has_any:
        return empty_result

    now = ref_dt or datetime.now(KOLKATA_TZ)
    if now.tzinfo is None:
        now = now.replace(tzinfo=KOLKATA_TZ)
    else:
        now = now.astimezone(KOLKATA_TZ)

    day_idx = now.weekday()  # Monday is 0, Sunday is 6
    today_key = WEEKDAYS[day_idx]
    yesterday_key = WEEKDAYS[(day_idx - 1) % 7]

    now_minutes = now.hour * 60 + now.minute

    today_ranges = opening_hours.get(today_key) or []
    yesterday_ranges = opening_hours.get(yesterday_key) or []

    # 1. Check if place is currently open from YESTERDAY'S overnight shift
    # E.g. Yesterday had 18:00 - 02:00. Today is 01:15 AM.
    is_open = False
    closes_in: int | None = None
    close_time_str = ""

    for start_s, end_s in yesterday_ranges:
        start_m = _parse_hm_minutes(start_s)
        end_m = _parse_hm_minutes(end_s)
        if end_m < start_m:  # Closes past midnight into today
            if now_minutes < end_m:
                is_open = True
                closes_in = end_m - now_minutes
                close_time_str = end_s
                break

    # 2. If not already open from yesterday, check TODAY'S shifts
    if not is_open:
        for start_s, end_s in today_ranges:
            start_m = _parse_hm_minutes(start_s)
            end_m = _parse_hm_minutes(end_s)
            if end_m < start_m:  # Closes after midnight (tomorrow morning)
                if now_minutes >= start_m:
                    is_open = True
                    closes_in = (24 * 60 - now_minutes) + end_m
                    close_time_str = end_s
                    break
            else:  # Normal same-day shift (or 24/7 where end_m == 1440)
                if start_m <= now_minutes < end_m:
                    is_open = True
                    closes_in = end_m - now_minutes
                    close_time_str = end_s
                    break

    today_hours_text = format_day_schedule(today_ranges)

    if is_open:
        status = "Open now"
        if closes_in is not None and closes_in <= 60:
            detail = f"Closes in {closes_in} min"
        elif close_time_str:
            detail = f"Open until {format_12hr(close_time_str)}"
        else:
            detail = "Open now"

        return {
            "open_now": True,
            "hours_status": status,
            "hours_detail": detail,
            "today_hours": today_hours_text,
            "weekly_hours": opening_hours,
            "closes_in_minutes": closes_in,
            "opens_at": None,
        }

    # PLACE IS CLOSED: Determine when it next opens
    status = "Closed"
    next_open_detail = ""
    next_open_time = ""

    # Check later today
    for start_s, _ in today_ranges:
        start_m = _parse_hm_minutes(start_s)
        if start_m > now_minutes:
            next_open_time = start_s
            next_open_detail = f"Opens today at {format_12hr(start_s)}"
            break

    # If no more shifts today, check subsequent days (up to 7 days ahead)
    if not next_open_detail:
        for offset in range(1, 8):
            next_day_idx = (day_idx + offset) % 7
            next_day_key = WEEKDAYS[next_day_idx]
            next_ranges = opening_hours.get(next_day_key) or []
            if next_ranges:
                first_open = next_ranges[0][0]
                next_open_time = first_open
                day_name = "tomorrow" if offset == 1 else next_day_key.capitalize()
                next_open_detail = f"Opens {day_name} at {format_12hr(first_open)}"
                break

    detail = next_open_detail or "Closed today"

    return {
        "open_now": False,
        "hours_status": status,
        "hours_detail": detail,
        "today_hours": today_hours_text,
        "weekly_hours": opening_hours,
        "closes_in_minutes": None,
        "opens_at": next_open_time or None,
    }


def compute_price_tier(cost_for_two: float | None, price_range: int | None = None) -> int:
    """
    Tier 0: Free / ₹0
    Tier 1: Budget (< ₹400)
    Tier 2: Moderate (₹400 - ₹1200)
    Tier 3: Upscale (₹1200 - ₹2500)
    Tier 4: Fine Dining (> ₹2500)
    """
    if cost_for_two is not None:
        if cost_for_two <= 0:
            return 0
        if cost_for_two < 400:
            return 1
        if cost_for_two <= 1200:
            return 2
        if cost_for_two <= 2500:
            return 3
        return 4
    if price_range is not None:
        return max(0, min(4, price_range))
    return 2


def format_price_display(
    cost_for_two: float | None,
    price_range: int | None,
    is_estimated: bool = True,
    entry_fee: float | None = 0.0,
) -> dict[str, Any]:
    tier = compute_price_tier(cost_for_two, price_range)
    tier_symbols = "₹" * max(1, tier) if tier > 0 else "Free"
    approx_prefix = "~" if is_estimated else ""

    cost_val = cost_for_two if cost_for_two is not None else 600.0
    cost_text = (
        "Free entry"
        if tier == 0
        else f"{approx_prefix}₹{int(cost_val)} for two"
    )

    entry_text = f"Entry: ₹{int(entry_fee)}" if entry_fee and entry_fee > 0 else ""

    return {
        "price_tier": tier,
        "price_symbols": tier_symbols,
        "cost_for_two": cost_val,
        "cost_text": cost_text,
        "entry_fee": entry_fee or 0.0,
        "entry_text": entry_text,
        "is_estimated": is_estimated,
    }
