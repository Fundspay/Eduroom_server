const dayjs = require("dayjs");
const axios = require("axios");
const { User, OfferLetter } = require("./models"); // adjust path to your Sequelize models

// Helper: split array into batches
const chunkArray = (array, chunkSize) => {
  const results = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    results.push(array.slice(i, i + chunkSize));
  }
  return results;
};

// Helper: delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: generate random delay between min and max (ms)
const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Trigger Offer Letter API with retry mechanism
const triggerOfferLetter = async (userId, courseId, courseName, startDate, endDate, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await axios.post(
        `https://eduroom.in/api/v1/offerletter/send/${userId}/${courseId}`,
        { courseId, courseName, startDate, endDate }
      );
      console.log(`[${dayjs().format()}] ✅ Offer letter triggered for user ${userId}, course ${courseName}`);
      return;
    } catch (err) {
      console.error(`[${dayjs().format()}] ❌ Attempt ${attempt} failed for user ${userId}, course ${courseName}: ${err.message}`);
      if (attempt < retries) {
        const wait = 2000; // wait 2 seconds before retry
        console.log(`[${dayjs().format()}] Waiting ${wait}ms before retrying...`);
        await delay(wait);
      } else {
        console.error(`[${dayjs().format()}] ❌ All retries failed for user ${userId}, course ${courseName}`);
      }
    }
  }
};

// Process all users for today
const processUsersForToday = async () => {
  try {
    const today = dayjs().format("YYYY-MM-DD");
    const users = await User.findAll();

    const usersToday = users.filter(user => {
      const courseDates = user.courseDates || {};
      return Object.entries(courseDates).some(([courseId, course]) =>
        course.startDate === today || course.endDate === today
      );
    });

    if (usersToday.length === 0) {
      console.log(`[${dayjs().format()}] No users found for today (${today})`);
      return;
    }

    console.log(`[${dayjs().format()}] Total users for today: ${usersToday.length}`);

    const batchSize = 10;
    const batches = chunkArray(usersToday, batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`[${dayjs().format()}] Processing batch ${i + 1}/${batches.length} with ${batch.length} users`);

      for (const user of batch) {
        const courseDates = user.courseDates || {};
        for (const [courseId, course] of Object.entries(courseDates)) {
          if (course.startDate === today || course.endDate === today) {

            const alreadySent = await OfferLetter.findOne({
              where: {
                userId: user.id,
                position: course.courseName,
                issent: true
              }
            });

            if (!alreadySent) {
              await triggerOfferLetter(
                user.id,
                courseId,
                course.courseName,
                course.startDate,
                course.endDate
              );
            } else {
              console.log(`[${dayjs().format()}] ℹ️ Offer letter already sent for user ${user.id}, course ${course.courseName}`);
            }
          }
        }
      }

      // Random delay between batches: 1–3 seconds
      if (i < batches.length - 1) {
        const wait = randomDelay(1000, 3000);
        console.log(`[${dayjs().format()}] Waiting ${wait}ms before next batch...`);
        await delay(wait);
      }
    }
  } catch (err) {
    console.error(`[${dayjs().format()}] Error in processUsersForToday:`, err);
  }
};

// Schedule cron job to run every 1.5 hours after previous run finishes
const scheduleJobs = () => {
  const intervalMs = 90 * 60 * 1000; // 1.5 hours

  const runJob = async () => {
    console.log(`[${dayjs().format()}] Running cron job`);
    await processUsersForToday();
    console.log(`[${dayjs().format()}] Cron job finished, waiting 1.5 hours for next run...`);

    setTimeout(runJob, intervalMs); // wait 1.5 hours and run again
  };

  runJob(); // start the first run immediately
};

module.exports = { scheduleJobs };
