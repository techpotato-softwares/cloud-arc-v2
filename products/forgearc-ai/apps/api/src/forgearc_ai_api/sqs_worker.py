"""Long-poll SQS and process ingestion jobs for the container worker."""

from __future__ import annotations

import json
import logging
import os
import signal
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

log = logging.getLogger("forgearc_ai.worker")


def main() -> None:
    from forgearc_ai_api.bootstrap import prepare_database_url

    prepare_database_url()
    from forgearc_ai_api.app import app

    stop = threading.Event()

    def handle_signal(_signum, _frame):
        log.info("stopping after the current batch")
        stop.set()

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)
    touch_heartbeat()
    queue_url = os.environ.get("FORGEARC_AI_QUEUE_URL", "")
    if not queue_url:
        log.info("no SQS queue configured; worker will stay idle")
        while not stop.wait(30):
            touch_heartbeat()
        return
    import boto3

    settings = app.state.container.get("Settings")
    client = boto3.client("sqs", region_name=settings.aws_region or None)
    run_poll(
        client,
        queue_url,
        app.state.container.get("IngestionService").process_message,
        stop=stop,
        concurrency=_concurrency(),
    )


def run_poll(
    client,
    queue_url: str,
    process,
    *,
    stop: threading.Event | None = None,
    concurrency: int = 2,
    wait_seconds: int = 20,
    visibility_timeout: int = 180,
    max_batches: int | None = None,
) -> None:
    """Receive batches until stopped. Failed messages stay on the queue for retry."""

    halted = stop or threading.Event()
    workers = max(1, concurrency)
    batches = 0
    touch_heartbeat()
    while not halted.is_set():
        if max_batches is not None and batches >= max_batches:
            return
        response = client.receive_message(
            QueueUrl=queue_url,
            MaxNumberOfMessages=min(workers, 10),
            WaitTimeSeconds=0 if max_batches is not None else wait_seconds,
            VisibilityTimeout=visibility_timeout,
        )
        batches += 1
        messages = response.get("Messages") or []
        if messages:
            with ThreadPoolExecutor(max_workers=min(workers, len(messages))) as pool:
                futures = [
                    pool.submit(_handle, client, queue_url, process, message)
                    for message in messages
                ]
                for future in futures:
                    future.result()
        touch_heartbeat()


def _handle(client, queue_url: str, process, message: dict) -> None:
    body = message.get("Body") or ""
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        payload = body
    try:
        process(payload)
    except Exception:
        log.exception("ingestion message failed")
        return
    client.delete_message(QueueUrl=queue_url, ReceiptHandle=message["ReceiptHandle"])


def touch_heartbeat() -> None:
    path = Path(os.environ.get("WORKER_HEARTBEAT", "/tmp/worker-heartbeat"))
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(str(time.time()), encoding="utf-8")
    except OSError:
        log.warning("could not write worker heartbeat")


def _concurrency() -> int:
    raw = os.environ.get("WORKER_CONCURRENCY", "2")
    try:
        return max(1, int(raw))
    except ValueError:
        return 2


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
