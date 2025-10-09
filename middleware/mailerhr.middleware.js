const nodemailer = require("nodemailer");
const CONFIG = require("../config/config");

const transporter = nodemailer.createTransport({
  host: CONFIG.mailHost,
  port: CONFIG.mailPort,
  secure: CONFIG.mailSecure, // true for 465, false for 587
  auth: {
    user: CONFIG.mailUser,
    pass: CONFIG.mailPassword,
  },
  logger: true,
  debug: true,
});

/**
 * Generic Mail Sender
 * @param {string|string[]} to - Primary recipient(s)
 * @param {string} subject - Subject line
 * @param {string} html - HTML body
 * @param {Array} attachments - Optional attachments
 * @param {string|string[]} cc - Optional CC
 * @param {string|string[]} bcc - Optional BCC
 */
const sendMail = async (to, subject, html, attachments = [], cc = [], bcc = []) => {
  const mailOptions = {
    from: CONFIG.mailUser,
    to,
    subject,
    html,
  };

  // ✅ Only add CC if provided
  if (cc && cc.length > 0) {
    mailOptions.cc = cc;
  }

  // ✅ Only add BCC if provided
  if (bcc && bcc.length > 0) {
    mailOptions.bcc = bcc;
  }

  // ✅ Only add attachments if provided
  if (attachments && attachments.length > 0) {
    mailOptions.attachments = attachments;
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, info };
  } catch (error) {
    console.error("GoDaddy Mail Error:", error);
    return { success: false, error };
  }
};

module.exports = { sendMail };
