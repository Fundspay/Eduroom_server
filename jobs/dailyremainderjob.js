const cron = require("node-cron");
const { User } = require("../models");
const { sendMail } = require("../middleware/mailer.middleware");


process.env.TZ = "Asia/Kolkata"; // ensure correct timezone

const isCourseActive = (startDate, endDate) => {
  const today = new Date();
  return new Date(startDate) <= today && today <= new Date(endDate);
};

const checkUserBusinessTargets = async () => {
  try {
    console.log("🕒 Running Daily Business Target Check:", new Date().toLocaleString("en-IN"));

    const users = await User.findAll({
      where: { isActive: true, isDeleted: false },
    });

    for (const user of users) {
      if (!user.courseDates || Object.keys(user.courseDates).length === 0) continue;

      const pendingCourses = [];

      for (const [courseId, courseInfo] of Object.entries(user.courseDates)) {
        if (!courseInfo.startDate || !courseInfo.endDate) continue;
        if (!isCourseActive(courseInfo.startDate, courseInfo.endDate)) continue;

        const totalTargets = user.businessTargets?.[courseId] || 0;
        const completedTargets = user.subscriptionWallet || 0;

        if (totalTargets > 0 && completedTargets < totalTargets) {
          pendingCourses.push({
            courseName: courseInfo.courseName || `Course ID ${courseId}`,
            progress: `${completedTargets} / ${totalTargets}`,
          });
        }
      }

      // send reminder if any course pending
      if (pendingCourses.length > 0 && user.email) {
        let courseSummaryHtml = "<ul>";
        for (const course of pendingCourses) {
          courseSummaryHtml += `<li><strong>${course.courseName}</strong> — Progress: ${course.progress}</li>`;
        }
        courseSummaryHtml += "</ul>";

        const subject = "Reminder: Complete Your Business Targets";
        const html = `
          <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <p>Dear <strong>${user.firstName}</strong>,</p>

            <p>This is a reminder to complete your pending business targets for your active course(s):</p>
            ${courseSummaryHtml}

            <p>Please ensure that you meet your daily targets to stay on track with your internship program.</p>

            <p>Best regards,<br/>
            <strong>EduRoom HR & Training Team</strong></p>
          </div>
        `;

        await sendMail(user.email, subject, html);
        console.log(`📧 Reminder sent to ${user.email}`);
      }
    }

    console.log("✅ Daily business target check complete.");
  } catch (error) {
    console.error("❌ Error in daily business target job:", error);
  }
};

// Schedule the job twice a day — 11:53 AM and 3:00 PM IST
cron.schedule("53 11,15 * * *", async () => {
  await checkUserBusinessTargets();
});

module.exports = { checkUserBusinessTargets };
