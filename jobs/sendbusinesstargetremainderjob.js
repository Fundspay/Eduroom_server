const cron = require("node-cron");
const { User } = require("../models");
const { Op } = require("sequelize");
const { sendMail } = require("../middleware/mailer.middleware.js");


process.env.TZ = "Asia/Kolkata"; // ensure IST timing

// 🧠 Helper: Check if course is active today
const isCourseActive = (start, end) => {
  const today = new Date();
  const s = new Date(start);
  const e = new Date(end);
  return today >= s && today <= e;
};

// 📧 Build and send the email
const sendBusinessTargetMail = async (user, activeTargets) => {
  if (!activeTargets.length) return;

  const html = `
  <div style="font-family: Arial, sans-serif; color: #333;">
    <p>Hi <strong>${user.firstName}</strong>,</p>
    <p>Here’s your business target update for today:</p>
    <ul>
      ${activeTargets
        .map(
          (t) =>
            `<li><b>${t.courseName || "Course"}:</b> Completed <b>${t.completed}</b> out of <b>${t.total}</b> targets (${t.remaining} remaining)</li>`
        )
        .join("")}
    </ul>
    <p>Keep pushing — you’re getting closer to 100% completion!</p>
    <p>Best regards,<br><strong>EduRoom Business Team</strong></p>
  </div>
  `;

  const subject = `Your Business Target Progress Update`;

  await sendMail(user.email, subject, html);
  console.log(`📨 Sent business target reminder to ${user.email}`);
};

// 🔁 Main job
const sendBusinessTargetReminders = async () => {
  try {
    console.log("🕙 Running Business Target Reminder Job @", new Date().toLocaleString("en-IN"));

    const users = await User.findAll({
      where: {
        isActive: true,
        isDeleted: false,
        email: { [Op.ne]: null },
        subscriptionWallet: { [Op.gt]: 0 }, // only users with at least 1 completion
      },
    });

    for (const user of users) {
      const { businessTargets = {}, subscriptionWallet = 0, courseDates = {} } = user;
      const activeTargets = [];

      for (const [courseId, targetCount] of Object.entries(businessTargets)) {
        const courseInfo = courseDates[courseId];
        if (!courseInfo) continue;

        if (isCourseActive(courseInfo.startDate, courseInfo.endDate)) {
          const completed = subscriptionWallet;
          const remaining = Math.max(targetCount - completed, 0);

          if (remaining > 0) {
            activeTargets.push({
              courseName: courseInfo.courseName || `Course ${courseId}`,
              total: targetCount,
              completed,
              remaining,
            });
          }
        }
      }

      if (activeTargets.length) {
        await sendBusinessTargetMail(user, activeTargets);
      }
    }

    console.log("✅ Business Target Reminder Job completed.");
  } catch (error) {
    console.error("❌ Error in Business Target Reminder Job:", error);
  }
};

// 🕙 Schedule: Every day at 12:00 PM IST
cron.schedule("0 12 * * *", async () => {
  await sendBusinessTargetReminders();
});

module.exports = { sendBusinessTargetReminders };
