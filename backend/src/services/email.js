import nodemailer from 'nodemailer';

export function createEmailService(config) {
  const smtp = config.smtp || {};
  const hasSmtp = Boolean(smtp.host && smtp.user);

  let transporter = null;
  if (hasSmtp) {
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port || 587,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    });
  }

  return {
    async sendPasswordResetEmail({ to, name, resetUrl }) {
      const recipientName = name || 'Reader';
      const subject = 'Reset your password — Is It Me or You as Well?';
      const from = smtp.from || '"Is It Me or You as Well?" <noreply@example.com>';

      const text = `Hello ${recipientName},

We received a request to reset the password for your account (${to}).

To set a new password, click the link below (or paste it into your browser):
${resetUrl}

This link is valid for 1 hour. If you did not request a password change, you can safely ignore this email; your password will remain unchanged.

Best regards,
H.M. Abhilash
Author, Is It Me or You as Well?
`;

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #2b2622;
      background-color: #f6f3ee;
      margin: 0;
      padding: 30px 15px;
    }
    .container {
      max-width: 540px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 8px;
      padding: 35px 30px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.06);
      border: 1px solid #e8e3dc;
    }
    .header {
      text-align: center;
      padding-bottom: 24px;
      border-bottom: 1px solid #efebe4;
      margin-bottom: 24px;
    }
    .book-title {
      font-family: Georgia, Garamond, serif;
      font-size: 22px;
      font-weight: 700;
      color: #1a1614;
      margin: 0;
    }
    .book-author {
      font-size: 13px;
      color: #8c8279;
      margin-top: 4px;
    }
    .content h2 {
      font-size: 18px;
      color: #1a1614;
      margin-top: 0;
      margin-bottom: 14px;
    }
    .content p {
      font-size: 15px;
      color: #4a423d;
      margin-bottom: 18px;
    }
    .btn-wrap {
      text-align: center;
      margin: 30px 0;
    }
    .btn {
      display: inline-block;
      background-color: #c96b46;
      color: #ffffff !important;
      font-weight: 600;
      font-size: 15px;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 6px;
    }
    .notice {
      font-size: 13px;
      color: #7d736a;
      background-color: #faf7f2;
      border-left: 3px solid #d47d57;
      padding: 10px 14px;
      border-radius: 4px;
      margin: 20px 0;
    }
    .direct-link {
      font-size: 12px;
      color: #8c8279;
      word-break: break-all;
      margin-top: 25px;
    }
    .direct-link a {
      color: #c96b46;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #a3998f;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #efebe4;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="book-title">Is It Me or You as Well?</h1>
      <p class="book-author">A Novel by H.M. Abhilash</p>
    </div>
    <div class="content">
      <h2>Password Reset Request</h2>
      <p>Hello <strong>${recipientName}</strong>,</p>
      <p>We received a request to reset the password for your account associated with <strong>${to}</strong>.</p>
      <div class="btn-wrap">
        <a href="${resetUrl}" class="btn" target="_blank">Reset My Password</a>
      </div>
      <div class="notice">
        ⏳ <strong>Security Notice:</strong> This password reset link is valid for <strong>1 hour</strong>. If you did not request this change, you can safely ignore this email—your existing password remains secure.
      </div>
      <p class="direct-link">
        Button not working? Copy and paste this URL into your browser:<br>
        <a href="${resetUrl}">${resetUrl}</a>
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Is It Me or You as Well? · All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

      if (transporter) {
        try {
          await transporter.sendMail({
            from,
            to,
            subject,
            text,
            html,
          });
          return { sent: true, mode: 'smtp' };
        } catch (err) {
          console.error('[email] SMTP delivery failed:', err.message);
          throw err;
        }
      } else {
        // Dev / fallback logging
        console.log('\n================== [AUTOMATED PASSWORD RESET EMAIL] ==================');
        console.log(`To: ${to} (${recipientName})`);
        console.log(`Subject: ${subject}`);
        console.log(`Reset Link: ${resetUrl}`);
        console.log('====================================================================\n');
        return { sent: true, mode: 'console', resetUrl };
      }
    },
  };
}
