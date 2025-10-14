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
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; padding: 20px; border-radius: 10px; background-color: #fefefe;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h2 style="color: #1a73e8;">📊 EduRoom Reminder</h2>
    <p style="color: #555;">Stay on track and achieve your goals!</p>
  </div>

  <p>Hi <strong>${user.firstName}</strong> 👋,</p>

  <p>We hope you're doing great! 🌟 Here's a quick update on your active Live Project(s) and your progress towards your daily business targets:</p>

  <h3 style="color: #1a73e8; margin-bottom: 10px;">📝 Pending Courses:</h3>
  <ul>
    ${pendingCourses.map(course => `<li>📌 <strong>${course.courseName}</strong> — Progress: ${course.progress}</li>`).join('')}
  </ul>

  <p>Remember, every small step counts! 🚀 Completing your daily targets will help you:</p>
  <ul>
    <li>💡 Strengthen your skills and expertise</li>
    <li>🏆 Stay ahead in your Live Project(s)</li>
    <li>📈 Achieve your business goals faster</li>
  </ul>

  <p>Consistency is the key to success! 🌟 Keep pushing forward, and you'll see amazing results. Your dedication today shapes your achievements tomorrow! 💪</p>

  <p style="margin-top: 30px;">Best regards,<br/>
  <strong>EduRoom HR & Training Team</strong></p>

  <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
  <p style="font-size: 12px; color: #999;">This is an automated reminder. Please do not reply to this email. For any queries, contact <a href="mailto:support@eduroom.com">support@eduroom.com</a>.</p>
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

// Schedule the job twice a day — 12:00 PM and 3:00 PM IST
cron.schedule("0 12,15 * * *", async () => {
    await checkUserBusinessTargets();
});

module.exports = { checkUserBusinessTargets };
