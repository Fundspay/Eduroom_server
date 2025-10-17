const dayjs = require("dayjs");
const cron = require("node-cron");
const { User, OfferLetter } = require("../models"); // Adjust path
const axios = require("axios"); // Backend API to trigger offer letter

process.env.TZ = "Asia/Kolkata"; // Ensure IST timing

// Helper: split array into batches
const chunkArray = (array, chunkSize) => {
  const results = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    results.push(array.slice(i, i + chunkSize));
  }
  return results;
};

// Delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Trigger Offer Letter via backend API per user and course ID with retry
const triggerOfferLetterForCourse = async (userId, courseId, courseName, startDate, endDate, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await axios.post(
        `https://eduroom.in/api/v1/offerletter/send/${userId}/${courseId}`,
        { courseId, courseName, startDate, endDate }
      );
      console.log(`[${dayjs().format()}] ✅ Offer letter triggered for user ${userId}, course ${courseName}`);
      return true;
    } catch (err) {
      console.error(`[${dayjs().format()}] ❌ Attempt ${attempt} failed for user ${userId}, course ${courseName}: ${err.message}`);
      if (attempt < retries) await delay(2000);
    }
  }
  console.error(`[${dayjs().format()}] ❌ All retries failed for user ${userId}, course ${courseName}`);
  return false;
};

// Process all users
const processUsers = async (maxDaily = 300) => {
  try {
    const today = dayjs().format("YYYY-MM-DD");
    const users = await User.findAll();

    if (!users.length) {
      console.log(`[${dayjs().format()}] No users found`);
      return;
    }

    // Filter only users with course start today or future
    const usersWithUpcomingCourses = users.filter(u => {
      const courses = u.courseDates || {};
      return Object.values(courses).some(c => dayjs(c.startDate).isSame(today) || dayjs(c.startDate).isAfter(today));
    });

    console.log(`[${dayjs().format()}] Total users with upcoming courses: ${usersWithUpcomingCourses.length}`);

    // Apply maxDaily logic: if more than maxDaily, take only maxDaily for today
    const usersToProcess = usersWithUpcomingCourses.slice(0, maxDaily);

    const batchSize = 10;
    const batches = chunkArray(usersToProcess, batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`[${dayjs().format()}] Processing batch ${i + 1}/${batches.length} with ${batch.length} users`);

      for (const user of batch) {
        const businessTargets = user.businessTargets || {};
        const courseDates = user.courseDates || {};
        const subscriptionWallet = parseInt(user.subscriptionWallet) || 0;

        // Filter courses: today or future dates
        const upcomingCourseIds = Object.keys(courseDates).filter(courseId => {
          const courseStart = dayjs(courseDates[courseId].startDate);
          return courseStart.isSame(today) || courseStart.isAfter(today);
        });

        const sortedCourseIds = upcomingCourseIds.sort((a, b) => parseInt(a) - parseInt(b));

        for (const courseId of sortedCourseIds) {
          const course = courseDates[courseId];
          const businessTarget = businessTargets[courseId] || 0;

          if (businessTarget >= 1 && subscriptionWallet >= 1) {
            // Check OfferLetter model to avoid duplicates
            const alreadySent = await OfferLetter.findOne({
              where: {
                userId: user.id,
                courseId: courseId,
                position: course.courseName,
                issent: true
              }
            });

            if (!alreadySent) {
              await triggerOfferLetterForCourse(user.id, courseId, course.courseName, course.startDate, course.endDate);
            } else {
              console.log(`[${dayjs().format()}] ℹ️ Offer letter already sent for user ${user.id}, course ${course.courseName}`);
            }
          } else {
            console.log(`[${dayjs().format()}] ⚠️ Skipping user ${user.id}, course ${course.courseName} - businessTarget: ${businessTarget}, subscriptionWallet: ${subscriptionWallet}`);
          }
        }
      }

      // Delay between batches
      if (i < batches.length - 1) {
        const wait = randomDelay(1000, 3000);
        console.log(`[${dayjs().format()}] Waiting ${wait}ms before next batch...`);
        await delay(wait);
      }
    }

    // Log postponed users (if more than maxDaily)
    if (usersWithUpcomingCourses.length > maxDaily) {
      console.log(`[${dayjs().format()}] ⚠️ ${usersWithUpcomingCourses.length - maxDaily} users postponed to next day`);
    }

  } catch (err) {
    console.error(`[${dayjs().format()}] Error in processUsers:`, err);
  }
};

// Schedule cron jobs: 10:00, 13:50, 14:00, 23:50 daily IST
const scheduleJobs = () => {
  const times = ["0 10 * * *", "50 13 * * *", "43 14 * * *", "50 23 * * *"];
  times.forEach(cronTime => {
    cron.schedule(cronTime, async () => {
      try {
        console.log(`[${dayjs().format()}] Running scheduled Offer Letter job at ${cronTime}`);
        await processUsers();
        console.log(`[${dayjs().format()}] Scheduled job finished`);
      } catch (err) {
        console.error(`[${dayjs().format()}] Error in scheduled job at ${cronTime}:`, err);
      }
    }, {
      timezone: "Asia/Kolkata"
    });
  });
};

module.exports = { scheduleJobs };
