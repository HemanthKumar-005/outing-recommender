"""
Shared event bus helper (RabbitMQ / topic exchange).

Topics used across the system:
  - user.updated        {user_id}
  - place.updated        {place_id, tenant_id, reason}
  - sentiment.updated     {tenant_id, place_id, sentiment_score}
  - interactions          {interaction_id, user_id, place_id, type, rating, ts}
  - model.retrain         {reason}
  - model.updated         {version, path}
  - notification.send     {user_id, title, body, channel}
"""
import json
import os
import time
import threading

import pika

RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/%2F")
EXCHANGE = "events"


def _connect(retries: int = 15, delay: float = 3.0, timeout: float = 10.0) -> pika.BlockingConnection:
    last_err = None
    for attempt in range(retries):
        try:
            params = pika.URLParameters(RABBITMQ_URL)
            params.heartbeat = 30
            params.socket_timeout = timeout
            params.blocked_connection_timeout = timeout
            conn = pika.BlockingConnection(params)
            return conn
        except Exception as e:  # noqa: BLE001
            last_err = e
            err_msg = str(e).strip() or repr(e)
            print(f"[eventbus] connect attempt {attempt + 1}/{retries} failed: {err_msg}")
            if attempt + 1 < retries:
                time.sleep(delay)
    raise RuntimeError(f"Could not connect to RabbitMQ after {retries} attempts: {last_err}")


def publish(routing_key: str, payload: dict) -> None:
    """Best-effort publish. FAILS FAST (one attempt, 2 s timeout): a broker outage must never
    make user-facing requests hang. A missed event is logged; consumers also reconcile on startup."""
    try:
        conn = _connect(retries=1, delay=0, timeout=2.0)
    except RuntimeError as e:
        print(f"[eventbus] publish skipped, broker unreachable: {e}")
        return
    try:
        ch = conn.channel()
        ch.exchange_declare(exchange=EXCHANGE, exchange_type="topic", durable=True)
        ch.basic_publish(
            exchange=EXCHANGE,
            routing_key=routing_key,
            body=json.dumps(payload, default=str).encode("utf-8"),
            properties=pika.BasicProperties(content_type="application/json", delivery_mode=2),
        )
        print(f"[eventbus] published routing_key={routing_key}")  # payload omitted: may contain user data
    except Exception as e:  # noqa: BLE001
        print(f"[eventbus] publish failed for {routing_key}: {e}")
    finally:
        conn.close()


def consume(queue_name: str, routing_keys: list, on_message) -> None:
    """Blocking consumer loop. on_message(routing_key: str, payload: dict) -> None"""
    conn = _connect()
    ch = conn.channel()
    ch.exchange_declare(exchange=EXCHANGE, exchange_type="topic", durable=True)
    ch.queue_declare(queue=queue_name, durable=True)
    for rk in routing_keys:
        ch.queue_bind(exchange=EXCHANGE, queue=queue_name, routing_key=rk)

    def _callback(channel, method, _properties, body):
        try:
            payload = json.loads(body.decode("utf-8"))
            on_message(method.routing_key, payload)
            channel.basic_ack(delivery_tag=method.delivery_tag)
        except Exception as e:  # noqa: BLE001
            print(f"[eventbus] error handling message on {method.routing_key}: {e}")
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    ch.basic_qos(prefetch_count=10)
    ch.basic_consume(queue=queue_name, on_message_callback=_callback)
    print(f"[eventbus] consuming queue={queue_name} keys={routing_keys}")
    ch.start_consuming()


def consume_in_background(queue_name: str, routing_keys: list, on_message) -> threading.Thread:
    """Run `consume` in a daemon thread with auto-restart on failure. Returns the thread."""

    def _loop():
        while True:
            try:
                consume(queue_name, routing_keys, on_message)
            except Exception as e:  # noqa: BLE001
                print(f"[eventbus] consumer loop crashed, retrying in 5s: {e}")
                time.sleep(5)

    t = threading.Thread(target=_loop, daemon=True)
    t.start()
    return t
