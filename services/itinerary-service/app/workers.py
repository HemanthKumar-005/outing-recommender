"""
Two background loops (feedback reminders, weather-reactive swaps), started
from main.py's startup event. Each tick enumerates every tenant via
pgdb_platform.list_tenant_ids() (worker_role, no RLS involved since
platform.tenants isn't tenant-owned data) and then runs correctly
RLS-scoped, per-tenant queries for each one via db.py (app_role +
tenant_cursor). No query ever spans tenants.
"""
import sys
import threading
import time
from datetime import datetime, timedelta

sys.path.insert(0, "/shared")
from pgdb_platform import list_tenant_ids  # noqa: E402

from app import clients, db

REMINDER_GRACE_MINUTES = 20  # wait a bit after departure before nudging
WEATHER_CHECK_HORIZON_HOURS = 3
LOOP_INTERVAL_SECONDS = 60


def _run_feedback_reminders():
    while True:
        try:
            now = datetime.now() - timedelta(minutes=REMINDER_GRACE_MINUTES)
            for tenant_id in list_tenant_ids():
                due = db.due_for_feedback_reminder(tenant_id, now.isoformat())
                for item in due:
                    clients.notify(
                        tenant_id, item["user_id"],
                        title="How was it?",
                        body=f"You visited {item['name']} recently - rate it to improve your next recommendations.",
                    )
                    db.mark_reminder_sent(tenant_id, item["id"])
                    print(f"[itinerary-service] feedback reminder sent (tenant={tenant_id}, item={item['id']})")
        except Exception as e:  # noqa: BLE001
            print(f"[itinerary-service] feedback reminder loop error: {e}")
        time.sleep(LOOP_INTERVAL_SECONDS)


def _run_weather_watch():
    while True:
        try:
            now = datetime.now()
            horizon = now + timedelta(hours=WEATHER_CHECK_HORIZON_HOURS)
            for tenant_id in list_tenant_ids():
                upcoming = db.upcoming_items(tenant_id, now.isoformat(), horizon.isoformat())
                for item in upcoming:
                    if item.get("indoor_outdoor") != "outdoor":
                        continue
                    try:
                        context = clients.get_context(item["lat"], item["lng"])
                    except Exception as e:  # noqa: BLE001
                        print(f"[itinerary-service] weather check failed for item {item['id']}: {e}")
                        continue
                    if (context.get("weather") or {}).get("condition") != "rain":
                        continue

                    alternative = clients.find_indoor_alternative(
                        tenant_id, item["lat"], item["lng"], item["category"], item["place_id"],
                    )
                    if alternative:
                        body = (
                            f"Rain's expected around your visit to {item['name']}. "
                            f"Consider {alternative['name']} instead - it's indoor and nearby."
                        )
                    else:
                        body = f"Rain's expected around your visit to {item['name']} - you may want a backup plan."
                    clients.notify(tenant_id, item["user_id"], title="Weather update for your plan", body=body)
                    db.mark_weather_alert_sent(tenant_id, item["id"])
                    print(f"[itinerary-service] weather alert sent (tenant={tenant_id}, item={item['id']})")
        except Exception as e:  # noqa: BLE001
            print(f"[itinerary-service] weather watch loop error: {e}")
        time.sleep(LOOP_INTERVAL_SECONDS)


def start_background_workers() -> None:
    threading.Thread(target=_run_feedback_reminders, daemon=True).start()
    threading.Thread(target=_run_weather_watch, daemon=True).start()
    print("[itinerary-service] background workers started (feedback reminders, weather watch)")
