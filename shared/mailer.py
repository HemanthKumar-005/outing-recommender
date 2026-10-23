"""Tiny SMTP mailer. Works with any free SMTP relay: Brevo, Resend (SMTP), Gmail
app-password SMTP, or Mailpit locally. No third-party SDK needed.

Env: SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASSWORD, SMTP_STARTTLS (true),
     MAIL_FROM ("Nearby & Co. <no-reply@example.com>")
"""
from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage

log = logging.getLogger("mailer")


def smtp_configured() -> bool:
    return bool(os.environ.get("SMTP_HOST"))


def send_email(to: str, subject: str, text: str) -> bool:
    host = os.environ.get("SMTP_HOST", "")
    if not host:
        if os.environ.get("APP_ENV", "development") != "production":
            # Developer convenience: show the message (including links) in the logs.
            log.warning("SMTP not configured; email NOT sent. to=%s subject=%s\n%s", to, subject, text)
        return False
    msg = EmailMessage()
    msg["From"] = os.environ.get("MAIL_FROM", "Nearby & Co. <no-reply@localhost>")
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    try:
        with smtplib.SMTP(host, int(os.environ.get("SMTP_PORT", "587")), timeout=10) as smtp:
            if os.environ.get("SMTP_STARTTLS", "true").lower() == "true":
                smtp.starttls()
            user = os.environ.get("SMTP_USER")
            if user:
                smtp.login(user, os.environ.get("SMTP_PASSWORD", ""))
            smtp.send_message(msg)
        return True
    except Exception as e:  # noqa: BLE001
        log.error("failed to send email to %s: %s", to, e)
        return False
