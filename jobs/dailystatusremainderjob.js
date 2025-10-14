const cron = require("node-cron");
const { User, CourseDetail, CaseStudyResult } = require("../models");
const { sendMail } = require("../middleware/mailer.middleware.js");
const { Op } = require("sequelize");

process.env.TZ = "Asia/Kolkata"; // ensure cron runs in IST

// 🧠 Utility
const isCourseActive = (start, end) => {
  const today = new Date();
  const s = new Date(start);
  const e = new Date(end);
  return today >= s && today <= e;
};

// 🧩 Calculate progress for a user + course
const calculateDailyStatus = async (userId, courseId, coursePreviewId) => {
  const sessions = await CourseDetail.findAll({
    where: { courseId, coursePreviewId, isDeleted: false },
    order: [["day", "ASC"], ["sessionNumber", "ASC"]],
  });

  if (!sessions.length) return null;

  let totalSessions = 0;
  let completedSessions = 0;

  for (const session of sessions) {
    const progress = session.userProgress?.[userId] || {};
    let sessionCompletionPercentage = 0;

    const latestCaseStudy = await CaseStudyResult.findOne({
      where: {
        userId,
        courseId,
        coursePreviewId,
        day: session.day,
        sessionNumber: session.sessionNumber,
      },
      order: [["createdAt", "DESC"]],
    });

    if (latestCaseStudy) {
      sessionCompletionPercentage = latestCaseStudy.matchPercentage || 0;
    } else if (progress.totalMCQs) {
      sessionCompletionPercentage =
        (progress.correctMCQs / progress.totalMCQs) * 100;
    }

    totalSessions++;
    if (sessionCompletionPercentage >= 20) completedSessions++;
  }

  const completionRate = totalSessions
    ? ((completedSessions / totalSessions) * 100).toFixed(2)
    : 0;

  return { totalSessions, completedSessions, completionRate };
};

// 📧 Send daily progress email
const sendDailyStatusMail = async (user, courseId, courseInfo, progressData) => {
  const subject = `📈 Your Daily Live Project Progress - ${courseInfo.courseName || "Course"}`;

  const html = `
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; padding: 20px; border-radius: 10px; background-color: #fefefe;">
    <div style="text-align: center; margin-bottom: 20px;">
      <h2 style="color: #1a73e8;">📊 EduRoom Daily Progress</h2>
      <p style="color: #555;">Keep up your momentum and achieve your goals! 🚀</p>
    </div>

    <p>Hi <strong>${user.firstName}</strong> 👋,</p>

    <p>Here’s your daily progress update for <strong>${courseInfo.courseName || "your course"}</strong>:</p>

    <ul>
      <li>📝 <b>Total Sessions:</b> ${progressData.totalSessions}</li>
      <li>✅ <b>Completed Sessions:</b> ${progressData.completedSessions}</li>
      <li>📊 <b>Completion Rate:</b> ${progressData.completionRate}%</li>
    </ul>

    <p>Remember, every session you complete brings you closer to mastering your Live Project! 💡</p>
    
    <p>Tips to stay on track:</p>
    <ul>
      <li>⏰ Dedicate focused time daily for your sessions</li>
      <li>💪 Review previous sessions to reinforce learning</li>
      <li>🎯 Aim to improve your completion rate step by step</li>
    </ul>

    <p>Keep pushing forward! Your dedication today shapes your success tomorrow. 🌟</p>

    <p style="margin-top: 30px;">Best regards,<br/>
    <strong>EduRoom Training Team</strong></p>

    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
    <p style="font-size: 12px; color: #999;">This is an automated update. Please do not reply. For any support, contact <a href="mailto:support@eduroom.com">support@eduroom.com</a>.</p>
  </div>
  `;

  await sendMail(user.email, subject, html);
  console.log(`📨 Sent daily progress mail to ${user.email}`);
};

// 🔁 Main job
const sendDailyCourseStatusMails = async () => {
  try {
    console.log("🕛 Running Daily Course Status Mail Job @", new Date().toLocaleString("en-IN"));

    const users = await User.findAll({
      where: { isActive: true, isDeleted: false, email: { [Op.ne]: null } },
    });

    for (const user of users) {
      if (!user.courseDates || Object.keys(user.courseDates).length === 0) continue;

      for (const [courseId, courseInfo] of Object.entries(user.courseDates)) {
        if (!isCourseActive(courseInfo.startDate, courseInfo.endDate)) continue;

        const coursePreviewId = courseInfo.coursePreviewId || null;
        const progressData = await calculateDailyStatus(user.id, courseId, coursePreviewId);

        if (progressData) {
          await sendDailyStatusMail(user, courseId, courseInfo, progressData);
        }
      }
    }

    console.log("✅ Daily Course Status Mail Job completed.");
  } catch (error) {
    console.error("❌ Error in Daily Course Status Mail Job:", error);
  }
};

// 🕛 Schedule at 12:00 PM daily (IST)
cron.schedule("0 12 * * *", async () => {
  await sendDailyCourseStatusMails();
});

module.exports = { sendDailyCourseStatusMails };
