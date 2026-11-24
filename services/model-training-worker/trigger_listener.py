"""
Listens for interactions.threshold_reached events and re-runs training.
Runs as a long-lived process alongside train.py's one-off mode.
"""
import os
import subprocess
import sys

sys.path.insert(0, "/shared")
try:
    from eventbus import consume_in_background
    from logging_config import configure_logging
except ImportError:
    from shared.eventbus import consume_in_background
    from shared.logging_config import configure_logging

logger = configure_logging("model-training-trigger")


def on_event(routing_key: str, payload: dict):
    if routing_key == "interactions.threshold_reached":
        n = payload.get("count", 0)
        logger.info(f"Received threshold_reached event (count={n}), triggering retrain...")
        script_path = os.path.join(os.path.dirname(__file__), "train.py")
        if not os.path.exists(script_path):
            script_path = "/app/train.py"
        subprocess.run([sys.executable, script_path], check=False)


if __name__ == "__main__":
    logger.info("trigger_listener starting — waiting for interactions.threshold_reached")
    thread = consume_in_background(
        queue_name="model-training-trigger",
        routing_keys=["interactions.threshold_reached"],
        on_message=on_event,
    )
    thread.join()
