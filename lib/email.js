const { Resend } = require('resend');

// Initialize Resend with API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

// Default sender email (should be verified in Resend)
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@syndicateplus.com';

/**
 * Send password reset email
 * @param {string} to - Recipient email address
 * @param {string} resetUrl - Password reset URL with token
 * @param {string} firmName - Name of the firm
 * @returns {Promise} Resend API response
 */
async function sendPasswordResetEmail(to, resetUrl, firmName) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Reset Your Syndicate+ Password',
      html: getPasswordResetEmailTemplate(resetUrl, firmName),
    });

    if (error) {
      console.error('Error sending password reset email:', error);
      throw new Error('Failed to send password reset email');
    }

    return data;
  } catch (error) {
    console.error('Error in sendPasswordResetEmail:', error);
    throw error;
  }
}

/**
 * HTML template for password reset email
 * @param {string} resetUrl - Password reset URL
 * @param {string} firmName - Name of the firm
 * @returns {string} HTML email template
 */
function getPasswordResetEmailTemplate(resetUrl, firmName) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .content p {
      margin: 0 0 20px;
      color: #555;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      text-align: center;
      margin: 20px 0;
    }
    .button:hover {
      opacity: 0.9;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      color: #666;
      font-size: 14px;
      border-top: 1px solid #e9ecef;
    }
    .warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 12px 16px;
      margin: 20px 0;
      font-size: 14px;
      color: #856404;
    }
    .link {
      word-break: break-all;
      color: #667eea;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Reset Your Password</h1>
    </div>
    <div class="content">
      <p>Hello ${firmName},</p>

      <p>We received a request to reset the password for your Syndicate+ account. Click the button below to create a new password:</p>

      <center>
        <a href="${resetUrl}" class="button">Reset Password</a>
      </center>

      <p>Or copy and paste this link into your browser:</p>
      <p class="link">${resetUrl}</p>

      <div class="warning">
        <strong>⚠️ Important:</strong> This password reset link will expire in 1 hour for security reasons.
      </div>

      <p>If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>

      <p>Best regards,<br>The Syndicate+ Team</p>
    </div>
    <div class="footer">
      <p>This is an automated email. Please do not reply to this message.</p>
      <p>&copy; ${new Date().getFullYear()} Syndicate+. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

module.exports = {
  sendPasswordResetEmail,
};
