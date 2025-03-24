const nodemailer = require('nodemailer');

/**
 * Create nodemailer transporter
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT === 465, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

/**
 * Send email
 */
const sendEmail = async (options) => {
  // Create transporter
  const transporter = createTransporter();

  // Define email options
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
  };

  // Send email
  await transporter.sendMail(mailOptions);
};

/**
 * Send verification email
 */
exports.sendVerificationEmail = async (email, token) => {
  const verificationURL = `${process.env.FRONTEND_URL}/verify-email/${token}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Verify Your Email Address</h2>
      <p>Thank you for registering with the Charity Transparency Platform. Please verify your email address by clicking the button below:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationURL}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email</a>
      </div>
      <p>If you didn't create an account, you can safely ignore this email.</p>
      <p>This link will expire in 24 hours.</p>
      <hr>
      <p style="font-size: 12px; color: #777;">If you're having trouble clicking the button, copy and paste this URL into your web browser: ${verificationURL}</p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: 'Please verify your email address',
    html,
  });
};

/**
 * Send password reset email
 */
exports.sendPasswordResetEmail = async (email, token) => {
  const resetURL = `${process.env.FRONTEND_URL}/reset-password/${token}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Reset Your Password</h2>
      <p>You are receiving this email because you (or someone else) has requested to reset your password. Please click the button below to reset your password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetURL}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
      </div>
      <p>If you didn't request a password reset, you can safely ignore this email.</p>
      <p>This link will expire in 1 hour.</p>
      <hr>
      <p style="font-size: 12px; color: #777;">If you're having trouble clicking the button, copy and paste this URL into your web browser: ${resetURL}</p>
    </div>
  `;
  
  await sendEmail({
    to: email,
    subject: 'Reset your password',
    html,
  });
};