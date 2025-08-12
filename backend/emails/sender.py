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
            response_data = resp.read()
            response_json = json.loads(response_data.decode('utf-8'))
            
            # Log successful email send with Resend ID
            if 'id' in response_json:
                print(f"[EMAIL SENT] To: {to} | Resend ID: {response_json['id']} | From: {email_from}")
            else:
                print(f"[EMAIL SENT] To: {to} | Response: {response_json} | From: {email_from}")
                
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send to {to}: {e}")
        print(f"[EMAIL ERROR] Payload was: {payload}")
        print(f"[EMAIL ERROR] Fallback dev email to console.\nTo: {to}\n{html}")


