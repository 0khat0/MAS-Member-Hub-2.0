import os
import json
import base64
import io
from urllib import request
from urllib.parse import quote_plus
import qrcode


def send_email(to: str, subject: str, html: str, attachments: list | None = None) -> None:
    api_key = os.getenv("RESEND_API_KEY")
    email_from = os.getenv("EMAIL_FROM", "MAS Hub <onboarding@resend.dev>")
    
    if not api_key:
        print(f"[DEV EMAIL] To: {to} | Subject: {subject}\n{html}")
        if attachments:
            print(f"[DEV EMAIL] Attachments: {[a.get('filename') for a in attachments]}")
        return

    payload = {
        "from": email_from,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if attachments:
        # Resend expects base64 content for attachments; content_id enables cid: inline images
        payload["attachments"] = attachments
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


def generate_qr_code_base64(data: str, size: int = 200) -> str:
    """Generate a QR code and return it as a base64 encoded string"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return img_str


def send_welcome_email(to: str, account_number: str, household_id: str) -> None:
    """Send a welcome email with account number (simplified for better deliverability)."""
    
    # Simplified subject line without emojis for better Outlook compatibility
    subject = "Welcome to MAS Member Hub"
    
    # Simplified HTML template optimized for Outlook and other email clients
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to MAS Member Hub</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f8f9fa;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px;">
            
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e9ecef;">
                <h1 style="color: #dc3545; margin: 0; font-size: 28px; font-weight: bold;">Welcome to MAS Member Hub</h1>
                <p style="color: #6c757d; margin: 10px 0 0 0; font-size: 16px;">Your account has been successfully created and verified</p>
            </div>
            
            <!-- Account Number Section -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #dc3545; border-radius: 8px; margin: 25px 0;">
                <tr>
                    <td align="center" style="padding: 25px;">
                        <h2 style="margin: 0 0 15px 0; color: #ffffff; font-size: 20px; font-weight: bold;">Your Account Number</h2>
                        <div style="display: inline-block; background: #ffffff; color: #111111; padding: 15px 20px; border-radius: 6px;">
                            <span style="font-size: 32px; font-weight: bold; letter-spacing: 2px; font-family: 'Courier New', monospace;">{account_number}</span>
                        </div>
                        <p style="margin: 15px 0 0 0; color: #ffffff; font-size: 14px;">Keep this safe - you'll need it to sign in!</p>
                    </td>
                </tr>
            </table>
            
            <!-- Instructions -->
            <div style="background: #e7f3ff; border-left: 4px solid #007bff; padding: 20px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #0056b3; font-size: 18px;">Getting Started</h3>
                <ul style="margin: 0; padding-left: 20px;">
                    <li style="margin: 8px 0;"><strong>Sign In:</strong> Use your account number to sign in to the Member Hub</li>
                    <li style="margin: 8px 0;"><strong>Check In:</strong> Show your QR code at the gym for quick check-ins</li>
                    <li style="margin: 8px 0;"><strong>Track Progress:</strong> Monitor your check-in streaks and attendance</li>
                </ul>
            </div>
            
            <!-- Pro Tip -->
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center;">
                <strong>Pro Tip:</strong> Bookmark <a href="https://mas-member-hub.vercel.app" style="color: #dc3545; text-decoration: none;">mas-member-hub.vercel.app</a> on your phone for easy access!
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #6c757d; font-size: 14px;">
                <p>Welcome to the MAS family! Train hard, fight easy!</p>
                <p>Questions? Contact your gym staff or visit the Member Hub</p>
            </div>
            
        </div>
    </body>
    </html>
    """
    
    send_email(to, subject, html)


