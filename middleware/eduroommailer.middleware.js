const nodemailer = require("nodemailer");

// Hardcoded Gmail SMTP configuration
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // false for port 587
  auth: {
    user: "eduroom.ittika@gmail.com",
    pass: "mkopmktcidbvowtl"
  },
  logger: true,   // log SMTP traffic
  debug: true     // show debug info
});

// Generic mail sender
const sendMailEduroom = async (to, subject, html) => {
  const mailOptions = {
    from: "eduroom.ittika@gmail.com", // Gmail user as sender
    to,
    subject,
    html
  };

  try {
    const info = await transporter.sendMailEduroom(mailOptions);
    console.log("Email sent:", info.response);
    return { success: true, info };
  } catch (error) {
    console.error("Gmail SMTP Error:", error);
    return { success: false, error };
  }
};

module.exports = { sendMailEduroom };
