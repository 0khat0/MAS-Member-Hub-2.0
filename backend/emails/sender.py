import os
import json
import base64
import io
from urllib import request
import qrcode


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
    """Send a welcome email with account number and QR code"""
    
    # Generate QR code that matches what users see on their profile page
    # For new users, we'll use their email as the QR code data (same as family accounts)
    # This ensures consistency between the email and what they see in the app
    qr_data = to  # Use their email address as the QR code data
    qr_code_base64 = generate_qr_code_base64(qr_data)
    
    subject = "Welcome to MAS Member Hub! 🥊"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to MAS Member Hub</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8f9fa;
            }}
            .container {{
                background: white;
                border-radius: 12px;
                padding: 30px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }}
            .header {{
                text-align: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 2px solid #e9ecef;
            }}
            .header h1 {{
                color: #dc3545;
                margin: 0;
                font-size: 28px;
                font-weight: 700;
            }}
            .header p {{
                color: #6c757d;
                margin: 10px 0 0 0;
                font-size: 16px;
            }}
            .account-section {{
                background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
                color: white;
                padding: 25px;
                border-radius: 10px;
                text-align: center;
                margin: 25px 0;
            }}
            .account-number {{
                font-size: 36px;
                font-weight: bold;
                letter-spacing: 2px;
                margin: 10px 0;
                font-family: 'Courier New', monospace;
            }}
            .qr-section {{
                text-align: center;
                margin: 30px 0;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 10px;
            }}
            .qr-code {{
                margin: 20px 0;
            }}
            .instructions {{
                background: #e7f3ff;
                border-left: 4px solid #007bff;
                padding: 20px;
                margin: 25px 0;
                border-radius: 0 8px 8px 0;
            }}
            .instructions h3 {{
                margin: 0 0 15px 0;
                color: #0056b3;
            }}
            .instructions ul {{
                margin: 0;
                padding-left: 20px;
            }}
            .instructions li {{
                margin: 8px 0;
            }}
            .footer {{
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e9ecef;
                color: #6c757d;
                font-size: 14px;
            }}
            .highlight {{
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                padding: 15px;
                border-radius: 8px;
                margin: 20px 0;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🥊 Welcome to MAS Member Hub!</h1>
                <p>Your account has been successfully created and verified</p>
            </div>
            
            <div class="account-section">
                <h2 style="margin: 0 0 15px 0;">Your Account Number</h2>
                <div class="account-number">{account_number}</div>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Keep this safe - you'll need it to sign in!</p>
            </div>
            
            <div class="qr-section">
                <h3>Your Member QR Code</h3>
                <p>Use this QR code for quick check-ins at the gym</p>
                <div class="qr-code">
                    <img src="data:image/png;base64,{qr_code_base64}" 
                         alt="Member QR Code" 
                         style="width: 200px; height: 200px; border: 2px solid #ddd; border-radius: 8px;">
                </div>
                <p style="font-size: 14px; color: #6c757d;">
                    <strong>Tip:</strong> Long-press the QR code to save it to your photos
                </p>
                <p style="font-size: 12px; color: #6c757d; margin-top: 8px;">
                    <em>This QR code contains your email address and will work for family check-ins. Individual family members will get unique barcodes when added.</em>
                </p>
            </div>
            
            <div class="instructions">
                <h3>🚀 Getting Started</h3>
                <ul>
                    <li><strong>Sign In:</strong> Use your account number to sign in to the Member Hub</li>
                    <li><strong>Check In:</strong> Show your QR code at the gym for quick check-ins</li>
                    <li><strong>Add Family:</strong> Invite family members to join your household</li>
                    <li><strong>Track Progress:</strong> Monitor your check-in streaks and attendance</li>
                    <li><strong>Individual Barcodes:</strong> Each family member gets a unique barcode for individual check-ins</li>
                </ul>
            </div>
            
            <div class="highlight">
                <strong>💡 Pro Tip:</strong> Bookmark <a href="https://mas-member-hub.vercel.app" style="color: #dc3545;">mas-member-hub.vercel.app</a> on your phone for easy access!
            </div>
            
            <div class="footer">
                <p>Welcome to the MAS family! Train hard, fight easy! 🥊</p>
                <p>Questions? Contact your gym staff or visit the Member Hub</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    send_email(to, subject, html)


