// const nodemailer = require("nodemailer");
// const CONFIG = require("../config/config");

// // Configure GoDaddy SMTP Transporter
// const transporter = nodemailer.createTransport({
//   host: CONFIG.mailHost || "smtpout.secureserver.net", // GoDaddy SMTP
//   port: CONFIG.mailPort || 465,                       // 465 (SSL) or 587 (TLS)
//   secure: CONFIG.mailSecure !== undefined ? CONFIG.mailSecure : true, // true for 465, false for 587
//   auth: {
//     user: CONFIG.mailUser,      // Your GoDaddy email
//     pass: CONFIG.mailPassword,  // Your GoDaddy email password / app password
//   },
//   logger: true,   // log SMTP traffic
//   debug: true     // show detailed SMTP logs
// });

// // Generic mail sender function
// const sendMail = async (to, subject, html) => {
//   const mailOptions = {
//     from: `"EduRoom" <${CONFIG.mailUser}>`,  // Display name + email
//     to,
//     subject,
//     html,
//   };

//   try {
//     const info = await transporter.sendMail(mailOptions);
//     console.log("✅ Email sent:", info.messageId);
//     return { success: true, info };
//   } catch (error) {
//     console.error(" GoDaddy Mail Error:", error);
//     if (error.response) console.error("SMTP Response:", error.response);
//     return { success: false, error };
//   }
// };

// module.exports = { sendMail };

const nodemailer = require("nodemailer");
const nodemailer = require("nodemailer");

// Configure GoDaddy SMTP Transporter
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || "smtpout.secureserver.net",  // GoDaddy SMTP
  port: process.env.MAIL_PORT ? Number(process.env.MAIL_PORT) : 465, // 465 SSL / 587 TLS
  secure:
    process.env.MAIL_SECURE !== undefined
      ? process.env.MAIL_SECURE === "true"
      : true, // true for SSL, false for TLS
  auth: {
    user: process.env.MAIL_USER,      // GoDaddy email
    pass: process.env.MAIL_PASSWORD,  // Email or app password
  },
  logger: true,
  debug: true,
});

// Log SMTP config for debugging
console.log("📧 SMTP Transporter configured with:");
console.log("Host:", transporter.options.host);
console.log("Port:", transporter.options.port);
console.log("Secure:", transporter.options.secure);
console.log("Auth User:", transporter.options.auth.user);
console.log("Auth Pass:", transporter.options.auth.pass);

// Generic mail sender function
const sendMail = async (to, subject, html) => {
  const mailOptions = {
    from: `"EduRoom" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html,
  };

  try {
    console.log(`Attempting to send email to ${to}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.messageId);
    return { success: true, info };
  } catch (error) {
    console.error("❌ GoDaddy Mail Error:", error);
    if (error.response) console.error("SMTP Response:", error.response);
    return { success: false, error };
  }
};

module.exports = { sendMail };
