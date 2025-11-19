const dayjs = require("dayjs");
const cron = require("node-cron");
const { User, OfferLetter } = require("../models");
const axios = require("axios");

// Ensure IST timezone
process.env.TZ = "Asia/Kolkata";

// Helper: split array into batches
const chunkArray = (array, chunkSize) => {
  const results = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    results.push(array.slice(i, i + chunkSize));
  }
  return results;
};

// Delay helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Trigger Offer Letter via backend API per user and course ID with retry
const triggerOfferLetterForCourse = async (
  userId,
  courseId,
  courseName,
  startDate,
  endDate,
  retries = 3
) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await axios.post(
        `https://eduroom.in/api/v1/offerletter/send/${userId}/${courseId}`,
        { courseId, courseName, startDate, endDate }
      );
      console.log(
        `[${dayjs().format()}] ✅ Offer letter triggered for user ${userId}, course ${courseName}`
      );
      return true;
    } catch (err) {
      console.error(
        `[${dayjs().format()}] ❌ Attempt ${attempt} failed for user ${userId}, course ${courseName}: ${err.message}`
      );
      if (attempt < retries) await delay(2000);
    }
  }
  console.error(
    `[${dayjs().format()}] ❌ All retries failed for user ${userId}, course ${courseName}`
  );
  return false;
};

// Process all users
const processUsers = async () => {
  try {
    const today = dayjs().format("YYYY-MM-DD");
    console.log(`[${dayjs().format()}] Starting processUsers for date: ${today}`);

    const users = await User.findAll();
    if (!users.length) {
      console.log(`[${dayjs().format()}] No users found`);
      return;
    }

    const batchSize = 10;
    const batches = chunkArray(users, batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(
        `[${dayjs().format()}] Processing batch ${i + 1}/${batches.length} with ${batch.length} users`
      );

      for (const user of batch) {
        const businessTargets = user.businessTargets || {};
        const courseDates = user.courseDates || {};
        const subscriptionWallet = parseInt(user.subscriptionWallet) || 0;

        const upcomingCourseIds = Object.keys(courseDates).filter((courseId) => {
          const courseStart = dayjs(courseDates[courseId].startDate);
          return courseStart.isSame(today) || courseStart.isAfter(today);
        });

        const sortedCourseIds = upcomingCourseIds.sort((a, b) => parseInt(a) - parseInt(b));

        for (const courseId of sortedCourseIds) {
          const course = courseDates[courseId];
          const businessTarget = businessTargets[courseId] || 0;

          if (businessTarget >= 1 && subscriptionWallet >= 1) {
            const alreadySent = await OfferLetter.findOne({
              where: {
                userId: user.id,
                courseId: courseId,
                position: course.courseName,
                issent: true,
              },
            });

            if (!alreadySent) {
              await triggerOfferLetterForCourse(
                user.id,
                courseId,
                course.courseName,
                course.startDate,
                course.endDate
              );
            } else {
              console.log(
                `[${dayjs().format()}] ℹ️ Already sent: user ${user.id}, course ${course.courseName}`
              );
            }
          } else {
            console.log(
              `[${dayjs().format()}] ⚠️ Skipping user ${user.id}, course ${course.courseName} - businessTarget: ${businessTarget}, subscriptionWallet: ${subscriptionWallet}`
            );
          }
        }
      }

      if (i < batches.length - 1) {
        const wait = randomDelay(1000, 3000);
        console.log(`[${dayjs().format()}] Waiting ${wait}ms before next batch...`);
        await delay(wait);
      }
    }

    console.log(`[${dayjs().format()}] Finished processUsers`);
  } catch (err) {
    console.error(`[${dayjs().format()}] Error in processUsers:`, err);
  }
};

// Schedule cron jobs for your Windows server
const scheduleJobs = () => {
  console.log(`[${dayjs().format()}] Setting up cron jobs...`);

  // Your production times (IST)
  const times = ["0 10 * * *", "50 13 * * *", "43 14 * * *", "30 17 * * *"];

  times.forEach((cronTime) => {
    cron.schedule(
      cronTime,
      async () => {
        console.log(`[${dayjs().format()}] 🔔 Scheduled cron fired at ${cronTime}`);
        await processUsers();
      },
      { timezone: "Asia/Kolkata" }
    );
  });

  console.log(`[${dayjs().format()}] Cron jobs scheduled for: ${times.join(", ")}`);
};

module.exports = { scheduleJobs };
