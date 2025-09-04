const nodemailer = require("nodemailer");
const CONFIG = require("../config/config");

// Configure GoDaddy SMTP Transporter
const transporter = nodemailer.createTransport({
  host: CONFIG.mailHost || "smtpout.secureserver.net", // GoDaddy SMTP
  port: CONFIG.mailPort || 465,                       // 465 (SSL) or 587 (TLS)
  secure: CONFIG.mailSecure !== undefined ? CONFIG.mailSecure : true, // true for 465, false for 587
  auth: {
    user: CONFIG.mailUser,      // Your GoDaddy email
    pass: CONFIG.mailPassword,  // Your GoDaddy email password / app password
  },
  logger: true,   // log SMTP traffic
  debug: true     // show detailed SMTP logs
});

// Generic mail sender function
const sendMail = async (to, subject, html) => {
  const mailOptions = {
    from: `"EduRoom" <${CONFIG.mailUser}>`,  // Display name + email
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.messageId);
    return { success: true, info };
  } catch (error) {
    console.error(" GoDaddy Mail Error:", error);
    if (error.response) console.error("SMTP Response:", error.response);
    return { success: false, error };
  }
};

module.exports = { sendMail };
