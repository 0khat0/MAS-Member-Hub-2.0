import os
import json
from urllib import request


def send_email(to: str, subject: str, html: str) -> None:
    api_key = os.getenv("RESEND_API_KEY")
    email_from = os.getenv("EMAIL_FROM", "MAS Hub <no-reply@localhost>")
    if not api_key:
        print(f"[DEV EMAIL] To: {to} | Subject: {subject}\n{html}")
        return

    payload = {
        "from": email_from,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url="https://api.resend.com/emails",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with request.urlopen(req) as resp:
            resp.read()
    except Exception as e:
        print(f"[EMAIL ERROR] {e}. Fallback dev email to console.\nTo: {to}\n{html}")


