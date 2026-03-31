"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

// 🔹 Create or update daily targets
var handleTargets = async function (req, res) {
  try {
    let { userId, startDate, endDate, month, targets } = req.body;
    if (!userId) return ReE(res, "userId is required", 400);

    userId = parseInt(userId, 10);
    const today = new Date();

    // 🔹 Handle month input (YYYY-MM)
    if (month) {
      const [year, mon] = month.split("-");
      startDate = new Date(year, mon - 1, 1);
      endDate = new Date(year, mon, 0);
    }

    // 🔹 Default to current month
    if (!startDate || !endDate) {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else {
      startDate = new Date(startDate);
      endDate = new Date(endDate);
    }

    // 🔹 Generate list of dates
    const dateList = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dateList.push({
        date: d.toISOString().split("T")[0],
        day: d.toLocaleDateString("en-US", { weekday: "long" }),
        c1Target: 0,
        c2Target: 0,
        c3Target: 0,
        c4Target: 0,
        subscriptionTarget: 0,
        token: null,
      });
    }

    // 🔹 Upsert targets if provided
    if (targets && Array.isArray(targets)) {
      for (let t of targets) {
        const {
          date,
          c1Target,
          c2Target,
          c3Target,
          c4Target,
          subscriptionTarget,
          token,
        } = t;
        const targetDate = new Date(date);

        const existing = await model.MyTarget.findOne({
          where: { userId, targetDate },
        });

        if (existing) {
          existing.c1Target = c1Target ?? existing.c1Target;
          existing.c2Target = c2Target ?? existing.c2Target;
          existing.c3Target = c3Target ?? existing.c3Target;
          existing.c4Target = c4Target ?? existing.c4Target;
          existing.subscriptionTarget =
            subscriptionTarget ?? existing.subscriptionTarget;
          existing.token = token ?? existing.token;
          await existing.save();
        } else {
          await model.MyTarget.create({
            userId,
            targetDate,
            c1Target: c1Target || 0,
            c2Target: c2Target || 0,
            c3Target: c3Target || 0,
            c4Target: c4Target || 0,
            subscriptionTarget: subscriptionTarget || 0,
            token: token || null,
          });
        }
      }
    }

    // 🔹 Fetch targets in date range
    const existingTargets = await model.MyTarget.findAll({
      where: {
        userId,
        targetDate: { [Op.between]: [startDate, endDate] },
      },
    });

    // 🔹 Merge with date list
    const merged = dateList.map((d) => {
      const found = existingTargets.find(
        (t) => new Date(t.targetDate).toISOString().split("T")[0] === d.date
      );
      return {
        ...d,
        c1Target: found ? found.c1Target : d.c1Target,
        c2Target: found ? found.c2Target : d.c2Target,
        c3Target: found ? found.c3Target : d.c3Target,
        c4Target: found ? found.c4Target : d.c4Target,
        subscriptionTarget: found
          ? found.subscriptionTarget
          : d.subscriptionTarget,
        token: found ? found.token : d.token,
      };
    });

    // 🔹 Compute totals
    const totals = {
      c1Target: merged.reduce((sum, t) => sum + t.c1Target, 0),
      c2Target: merged.reduce((sum, t) => sum + t.c2Target, 0),
      c3Target: merged.reduce((sum, t) => sum + t.c3Target, 0),
      c4Target: merged.reduce((sum, t) => sum + t.c4Target, 0),
      subscriptionTarget: merged.reduce(
        (sum, t) => sum + t.subscriptionTarget,
        0
      ),
    };

    return ReS(res, { success: true, dates: merged, totals }, 200);
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.handleTargets = handleTargets;


// 🔹 Fetch targets (GET)
var fetchTargets = async function (req, res) {
  try {
    let { userId, startDate, endDate, month } = req.query;
    if (!userId) return ReE(res, "userId is required", 400);

    userId = parseInt(userId, 10);
    const today = new Date();
    let sDate, eDate;

    if (month) {
      const [year, mon] = month.split("-");
      sDate = new Date(year, mon - 1, 1);
      eDate = new Date(year, mon, 0);
    } else if (startDate && endDate) {
      sDate = new Date(startDate);
      eDate = new Date(endDate);
    } else {
      sDate = new Date(today.getFullYear(), today.getMonth(), 1);
      eDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    // 🔹 Generate date list
    const dateList = [];
    for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
      const current = new Date(d);
      dateList.push({
        date: current.toISOString().split("T")[0],
        day: current.toLocaleDateString("en-US", { weekday: "long" }),
        c1Target: 0,
        c2Target: 0,
        c3Target: 0,
        c4Target: 0,
        subscriptionTarget: 0,
        token: null,
      });
    }

    // 🔹 Fetch existing targets
    const existingTargets = await model.MyTarget.findAll({
      where: {
        userId,
        targetDate: { [Op.between]: [sDate, eDate] },
      },
    });

    // 🔹 Merge
    const merged = dateList.map((d) => {
      const found = existingTargets.find(
        (t) => new Date(t.targetDate).toISOString().split("T")[0] === d.date
      );
      return {
        ...d,
        c1Target: found ? found.c1Target : d.c1Target,
        c2Target: found ? found.c2Target : d.c2Target,
        c3Target: found ? found.c3Target : d.c3Target,
        c4Target: found ? found.c4Target : d.c4Target,
        subscriptionTarget: found
          ? found.subscriptionTarget
          : d.subscriptionTarget,
        token: found ? found.token : d.token,
      };
    });

    // 🔹 Totals
    const totals = {
      c1Target: merged.reduce((sum, t) => sum + t.c1Target, 0),
      c2Target: merged.reduce((sum, t) => sum + t.c2Target, 0),
      c3Target: merged.reduce((sum, t) => sum + t.c3Target, 0),
      c4Target: merged.reduce((sum, t) => sum + t.c4Target, 0),
      subscriptionTarget: merged.reduce(
        (sum, t) => sum + t.subscriptionTarget,
        0
      ),
    };

    return ReS(res, { success: true, dates: merged, totals }, 200);
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchTargets = fetchTargets;

var fetchC1Target = async function (req, res) {
  try {
    let { userId, startDate, endDate } = req.query;
    if (!userId) return ReE(res, "userId is required", 400);

    userId = parseInt(userId, 10);
    const today = new Date();

    let sDate, eDate;

    if (startDate && endDate) {
      sDate = new Date(new Date(startDate).setHours(0, 0, 0, 0));
      eDate = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    } else {
      sDate = new Date(today.setHours(0, 0, 0, 0));
      eDate = new Date(today.setHours(23, 59, 59, 999));
    }

    const targets = await model.MyTarget.findAll({
      where: {
        userId,
        targetDate: { [Op.between]: [sDate, eDate] },
      },
      attributes: [
        "id",
        "targetDate",
        "c1Target",
        "c2Target",
        "c3Target",
        "c4Target",
        "subscriptionTarget",
        "token",
      ],
      order: [["targetDate", "ASC"]],
    });

    const formatted = await Promise.all(
      targets.map(async (t) => {
        const startOfDay = new Date(t.targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(t.targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        // 🔹 Count how many C1 Scheduled achieved on this date
        const achieved = await model.ASheet.count({
          where: {
            userId,
            meetingStatus: { [Op.iLike]: "%C1 Scheduled%" },
            dateOfConnect: { [Op.between]: [startOfDay, endOfDay] },
          },
        });

        // 🔹 Count how many have non-empty c4Status (Gold, Premium, Standard etc.)
        const achievedSubscription = await model.ASheet.count({
          where: {
            userId,
            c4Status: {
              [Op.and]: [
                { [Op.ne]: null },
                { [Op.ne]: "" },
                { [Op.notILike]: "%null%" },
              ],
            },
            dateOfConnect: { [Op.between]: [startOfDay, endOfDay] },
          },
        });

        const totalAchievedTarget = achieved + achievedSubscription;

        return {
          date: new Date(t.targetDate).toISOString().split("T")[0],
          c1Target: t.c1Target,
          c2Target: t.c2Target, 
          c3Target: t.c3Target, 
          c4Target: t.c4Target, 
          subscriptionTarget: t.subscriptionTarget || 0,
          token: t.token,
          achieved,
          achievedSubscription,
          totalAchievedTarget,
        };
      })
    );

    if (formatted.length === 0 && !startDate && !endDate) {
      formatted.push({
        date: today.toISOString().split("T")[0],
        c1Target: 0,
        c2Target: 0,
        c3Target: 0,
        c4Target: 0,
        subscriptionTarget: 0,
        token: null,
        achieved: 0,
        achievedSubscription: 0,
      });
    }

    const totalC1Target = formatted.reduce((sum, t) => sum + (t.c1Target || 0), 0);
    const totalC2Target = formatted.reduce((sum, t) => sum + (t.c2Target || 0), 0);
    const totalC3Target = formatted.reduce((sum, t) => sum + (t.c3Target || 0), 0);
    const totalC4Target = formatted.reduce((sum, t) => sum + (t.c4Target || 0), 0);
    const totalsubscriptionTarget = formatted.reduce(
      (sum, t) => sum + (t.subscriptionTarget || 0),
      0
    );
    const totalToken = formatted.reduce((sum, t) => {
      const num = parseFloat(t.token);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);

    const achievedCount = await model.ASheet.count({
      where: {
        userId,
        meetingStatus: { [Op.iLike]: "%C1 Scheduled%" },
        dateOfConnect: { [Op.between]: [sDate, eDate] },
      },
    });
    const achievedc2Count = await model.ASheet.count({
      where: {
        userId,
        c1Status: { [Op.iLike]: "%C2 Scheduled%" },
        dateOfConnect: { [Op.between]: [sDate, eDate] },
      },
    });
    const achievedc3Count = await model.ASheet.count({
      where: {
        userId,
        c2Status: { [Op.iLike]: "%C3 Scheduled%" },
        dateOfConnect: { [Op.between]: [sDate, eDate] },
      },
    });
    const achievedc4Count = await model.ASheet.count({
      where: {
        userId,
        c3Status: { [Op.iLike]: "%C4 Scheduled%" },
        dateOfConnect: { [Op.between]: [sDate, eDate] },
      },
    });
    const achievedsubscriptionCount = await model.ASheet.count({
      where: {
        userId,
        c4Status: {
          [Op.and]: [
            { [Op.ne]: null },
            { [Op.ne]: "" },
            { [Op.notILike]: "%null%" },
          ],
        },
        dateOfConnect: { [Op.between]: [sDate, eDate] },
      },
    });

    // 🔹 Fetch counts for other statuses
    const CNA = await model.ASheet.count({
      where: {
        userId,
        meetingStatus: { [Op.iLike]: "%CNA%" },
        dateOfConnect: { [Op.between]: [sDate, eDate] },
      },
    });
    const SwitchOff = await model.ASheet.count({
      where: {
        userId,
        meetingStatus: { [Op.iLike]: "%Switch Off%" },
        dateOfConnect: { [Op.between]: [sDate, eDate] },
      },
    });
    const NotInterested = await model.ASheet.count({
      where: {
        userId,
        meetingStatus: { [Op.iLike]: "%Not Interested%" },
        dateOfConnect: { [Op.between]: [sDate, eDate] },
      },
    });
    const WrongNumber = await model.ASheet.count({
      where: {
        userId,
        meetingStatus: { [Op.iLike]: "%Wrong Number%" },
        dateOfConnect: { [Op.between]: [sDate, eDate] },
      },
    });

    return ReS(
      res,
      {
        success: true,
        userId,
        data: formatted,
        totalC1Target,
        totalC2Target,
        totalC3Target,
        totalC4Target,
        totalsubscriptionTarget,
        totalToken,
        achievedC1Target: achievedCount,
        achievedC2Target: achievedc2Count,
        achievedC3Target: achievedc3Count,
        achievedC4Target: achievedc4Count,
        achievedSubscriptionTarget: achievedsubscriptionCount,
        CNA,
        SwitchOff,
        NotInterested,
        WrongNumber,
      },
      200
    );
  } catch (error) {
    console.error("fetchC1Target Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchC1Target = fetchC1Target;







