const nodemailer = require("nodemailer");
const CONFIG = require("../config/config");

// Configure GoDaddy SMTP Transporter
const transporter = nodemailer.createTransport({
  host: CONFIG.mailHost || "smtpout.secureserver.net", // GoDaddy SMTP
  port: CONFIG.mailPort || 465,                        // 465 (SSL) or 587 (TLS)
  secure: CONFIG.mailSecure !== undefined ? CONFIG.mailSecure : true, // true for 465, false for 587
  auth: {
    user: CONFIG.mailUser,      // Your GoDaddy email
    pass: CONFIG.mailPassword,  // Your GoDaddy email password / app password
  },
  logger: false,   // disable verbose logging
  debug: false     // disable SMTP debug output
});

// Generic mail sender function with optional attachments
const sendMail = async (to, subject, html, attachments = []) => {
  const mailOptions = {
    from: `"EduRoom" <${CONFIG.mailUser}>`,
    to,
    subject,
    html,
    attachments: attachments.length ? attachments : undefined,
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    // Minimal logging
    console.log(`✅ Email sent to ${to}, messageId: ${info.messageId}`);
    if (attachments.length) {
      console.log(`📎 Attachments: ${attachments.map(a => a.filename).join(", ")}`);
    }

    return { success: true, info };
  } catch (error) {
    console.error(`❌ GoDaddy Mail Error for ${to}:`, error.message);
    if (error.response) console.error("SMTP Response:", error.response);
    return { success: false, error };
  }
};

module.exports = { sendMail };
