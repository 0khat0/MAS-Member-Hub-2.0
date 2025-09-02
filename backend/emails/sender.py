import os
import json
import base64
import io
from urllib import request
from urllib.parse import quote_plus
import qrcode


def send_email(to: str, subject: str, html: str, attachments: list | None = None) -> None:
    api_key = os.getenv("RESEND_API_KEY")
    email_from = os.getenv("EMAIL_FROM", "MAS Hub <no-reply@localhost>")
    
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
    """Send a welcome email with account number and QR code"""
    
    # Generate QR code that matches what users see on their profile page
    qr_data = to  # Use their email address as the QR code data (family identifier)
    qr_png_b64 = generate_qr_code_base64(qr_data)
    # Prepare inline attachment for Gmail via Resend (content_id for cid:)
    qr_attachment = {
        "filename": "qr.png",
        "content": qr_png_b64,
        "content_id": "member_qr",
        "mime_type": "image/png",
    }
    # Public fallback URL if client blocks cid (some clients do). Optional.
    backend_public = os.getenv("BACKEND_PUBLIC_URL", "")
    safe_data = quote_plus(to)
    qr_url = f"{backend_public.rstrip('/')}/v1/qr.png?data={safe_data}&size=200"
    
    subject = "Welcome to MAS Member Hub! 🥊"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to MAS Member Hub</title>
        <style>
            /* Reset and base styles for better email client compatibility */
            * {{
                box-sizing: border-box;
            }}
            
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 10px;
                background-color: #f8f9fa;
                -webkit-text-size-adjust: 100%;
                -ms-text-size-adjust: 100%;
            }}
            
            /* Mobile-first responsive design */
            @media only screen and (max-width: 600px) {{
                body {{
                    padding: 5px;
                }}
                .container {{
                    padding: 20px 15px;
                    margin: 0;
                    border-radius: 8px;
                }}
                .header h1 {{
                    font-size: 24px;
                    line-height: 1.3;
                }}
                .header p {{
                    font-size: 14px;
                }}
                .account-section {{
                    padding: 20px 15px;
                    margin: 20px 0;
                }}
                .account-number {{
                    font-size: 28px;
                    letter-spacing: 1px;
                }}
                .qr-section {{
                    margin: 20px 0;
                    padding: 15px;
                }}
                .instructions {{
                    padding: 15px;
                    margin: 20px 0;
                }}
                .highlight {{
                    padding: 12px;
                    margin: 20px 0;
                }}
                .footer {{
                    margin-top: 25px;
                    padding-top: 15px;
                }}
            }}
            
            .container {{
                background: white;
                border-radius: 12px;
                padding: 30px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                margin: 10px;
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
                line-height: 1.2;
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
            
            .account-section h2 {{
                margin: 0 0 15px 0;
                font-size: 20px;
                font-weight: 600;
            }}
            
            .account-section p {{
                margin: 10px 0 0 0;
                opacity: 0.9;
                font-size: 14px;
            }}
            
            .account-number {{
                font-size: 36px;
                font-weight: bold;
                letter-spacing: 2px;
                margin: 10px 0;
                font-family: 'Courier New', 'Monaco', 'Menlo', monospace;
                word-break: break-all;
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
                display: inline-block;
            }}
            
            .qr-code img {{
                max-width: 100%;
                height: auto;
                border: 2px solid #ddd;
                border-radius: 8px;
                display: block;
                margin: 0 auto;
            }}
            
            .qr-section p {{
                font-size: 14px;
                color: #6c757d;
                margin: 15px 0 0 0;
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
                font-size: 18px;
            }}
            
            .instructions ul {{
                margin: 0;
                padding-left: 20px;
            }}
            
            .instructions li {{
                margin: 8px 0;
                line-height: 1.5;
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
                text-align: center;
            }}
            
            .highlight a {{
                color: #dc3545;
                text-decoration: none;
                font-weight: 600;
            }}
            
            .highlight a:hover {{
                text-decoration: underline;
            }}
            
            /* Dark mode support for modern email clients */
            @media (prefers-color-scheme: dark) {{
                .container {{
                    background: #1a1a1a;
                    color: #ffffff;
                }}
                .qr-section {{
                    background: #2a2a2a;
                }}
                .instructions {{
                    background: #1e3a5f;
                    color: #ffffff;
                }}
                .highlight {{
                    background: #3d2c02;
                    color: #ffffff;
                }}
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🥊 Welcome to MAS Member Hub!</h1>
                <p>Your account has been successfully created and verified</p>
            </div>
            
            <!-- Account Number Section (table-based for Outlook) -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#dc3545; border-radius:10px; margin:25px 0;">
              <tr>
                <td align="center" style="padding:25px;">
                  <h2 style="margin:0 0 15px 0; color:#ffffff; font-size:20px; font-weight:600;">Your Account Number</h2>
                  <div style="display:inline-block; background:#ffffff; color:#111111; padding:12px 16px; border-radius:8px;">
                    <span class="account-number" style="font-size:32px; line-height:1.2; letter-spacing:2px; font-family:'Courier New', 'Monaco', 'Menlo', monospace;">{account_number}</span>
                  </div>
                  <p style="margin:12px 0 0 0; color:#ffffff; opacity:0.95; font-size:14px;">Keep this safe — you'll need it to sign in!</p>
                </td>
              </tr>
            </table>
            
            <div class="qr-section">
                <h3>Your Member QR Code</h3>
                <div class="qr-code" style="text-align:center;">
                    <!-- Inline CID for Gmail & Outlook -->
                    <img src="cid:member_qr" alt="Member QR Code" width="200" height="200" style="border:2px solid #ddd; border-radius:8px; display:block; margin:0 auto; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic;">
                </div>
                <p style="font-size: 14px; color: #6c757d;">
                    <strong>Tip:</strong> Long-press the QR code to save it to your photos
                </p>
                <!-- Download button (great for Outlook users to save the QR) -->
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px auto 0 auto;">
                  <tr>
                    <td align="center" bgcolor="#111111" style="border-radius:6px;">
                      <a href="{qr_url}" target="_blank" style="display:inline-block; padding:10px 16px; color:#ffffff; text-decoration:none; font-weight:600; border-radius:6px;">Open / Download QR</a>
                    </td>
                  </tr>
                </table>
            </div>
            
            <div class="instructions">
                <h3>🚀 Getting Started</h3>
                <ul>
                    <li><strong>Sign In:</strong> Use your account number to sign in to the Member Hub</li>
                    <li><strong>Check In:</strong> Show your QR code at the gym for quick check-ins</li>
                    <li><strong>Add Family:</strong> Invite family members to join your household</li>
                    <li><strong>Track Progress:</strong> Monitor your check-in streaks and attendance</li>
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
    
    send_email(to, subject, html, attachments=[qr_attachment])


