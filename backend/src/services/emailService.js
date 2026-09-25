/**
 * emailService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Sends transactional emails using nodemailer.
 *
 * Required environment variables:
 *   SMTP_HOST     e.g. smtp.gmail.com
 *   SMTP_PORT     e.g. 587
 *   SMTP_USER     e.g. yourshop@gmail.com
 *   SMTP_PASS     App password (not your Gmail login password)
 *   SMTP_FROM     e.g. "AMI SERVICES <yourshop@gmail.com>"
 *   FRONTEND_URL  e.g. https://your-app.vercel.app
 *
 * Gmail setup:
 *   1. Go to Google Account → Security → 2-Step Verification (enable it)
 *   2. Go to Google Account → Security → App passwords
 *   3. Create an app password for "Mail" → copy the 16-char password
 *   4. Use that as SMTP_PASS in your .env
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const nodemailer = require('nodemailer');

// Build transporter once — reused across all calls
function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST  || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465', // true only for port 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Sends a password-reset email to the given address.
 *
 * @param {string} toEmail     Recipient email address
 * @param {string} firstName   Recipient first name (for personalisation)
 * @param {string} resetToken  Raw reset token (included in the link)
 */
async function sendPasswordResetEmail(toEmail, firstName, resetToken) {
  // If SMTP credentials are not configured, log to console and bail out
  // gracefully — this prevents crashes on environments without email set up.
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(
      '[emailService] SMTP_USER / SMTP_PASS not set. ' +
      'Password-reset email NOT sent. Reset token (dev only):', resetToken
    );
    return;
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetLink   = `${frontendUrl}/reset-password?token=${resetToken}`;
  const from        = process.env.SMTP_FROM || `AMI SERVICES <${process.env.SMTP_USER}>`;

  const transporter = createTransporter();

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'Reset your AMI SERVICES password',
    // Plain-text fallback for email clients that don't render HTML
    text: [
      `Hi ${firstName},`,
      '',
      'You requested a password reset for your AMI SERVICES account.',
      '',
      `Click this link to set a new password (valid for 1 hour):`,
      resetLink,
      '',
      'If you did not request this, you can ignore this email — your password will not change.',
      '',
      'AMI SERVICES',
    ].join('\n'),
    // HTML version
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#134e2a;font-size:20px;margin-bottom:4px;">AMI<span style="color:#f59e0b;">SERVICES</span></h2>
        <p style="color:#57534e;font-size:14px;margin-top:0;">Your local shop in Muhanga</p>
        <hr style="border:none;border-top:1px solid #e7e5e4;margin:16px 0;" />
        <p style="font-size:15px;color:#1c1917;">Hi <strong>${firstName}</strong>,</p>
        <p style="font-size:14px;color:#44403c;line-height:1.6;">
          We received a request to reset your password. Click the button below to choose a new one.
          This link is valid for <strong>1 hour</strong>.
        </p>
        <a href="${resetLink}"
           style="display:inline-block;background:#134e2a;color:#fff;font-size:14px;
                  font-weight:600;padding:12px 28px;border-radius:999px;
                  text-decoration:none;margin:16px 0;">
          Reset my password
        </a>
        <p style="font-size:12px;color:#78716c;margin-top:24px;">
          If the button doesn't work, copy and paste this link into your browser:<br/>
          <a href="${resetLink}" style="color:#134e2a;word-break:break-all;">${resetLink}</a>
        </p>
        <p style="font-size:12px;color:#78716c;">
          If you didn't request a password reset, you can safely ignore this email.
        </p>
        <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0 8px;" />
        <p style="font-size:11px;color:#a8a29e;text-align:center;">
          AMI SERVICES · Muhanga District, Rwanda
        </p>
      </div>
    `,
  });
}

module.exports = { sendPasswordResetEmail };
