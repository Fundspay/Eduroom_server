"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

// Upsert ScoreSheet (total score auto-calculated)
var upsertScoreSheet = async (req, res) => {
    const {
        id,
        session,
        department,
        link,
        portfoliolink,
        videolink,
        comment,
        manager,      // manager ID
        managerName,  // manager NAME (plain text)
        score1,
        score2,
        score3,
        startdate,
        enddate,
    } = req.body;

    try {
        // 🔹 Auto calculate average total score (divided by 3)
        const totalScore = Math.round(
            ((score1 ?? 0) +
             (score2 ?? 0) +
             (score3 ?? 0)) / 3
        );

        // 🔹 Calculate days remaining
        let daysremaining = null;
        if (startdate && enddate) {
            const start = new Date(startdate);
            const end = new Date(enddate);
            const diffTime = end.getTime() - start.getTime();
            daysremaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        let scoreSheet;

        if (id) {
            // 🔹 Update existing record
            scoreSheet = await model.ScoreSheet.findOne({
                where: { id },
            });

            if (!scoreSheet) {
                return ReE(res, "ScoreSheet not found", 404);
            }

            await scoreSheet.update({
                session: session || null,
                department: department || null,
                link: link || null,
                portfoliolink: portfoliolink || null,
                videolink: videolink || null,
                comment: comment || null,
                manager: manager || null,           // ID only
                managerName: managerName || null,   // text only
                score1: score1 ?? null,
                score2: score2 ?? null,
                score3: score3 ?? null,
                totalscore: totalScore,
                startdate: startdate || null,
                enddate: enddate || null,
                daysremaining: daysremaining,
            });
        } else {
            // 🔹 Create new record
            scoreSheet = await model.ScoreSheet.create({
                session: session || null,
                department: department || null,
                link: link || null,
                portfoliolink: portfoliolink || null,
                videolink: videolink || null,
                comment: comment || null,
                manager: manager || null,           // ID only
                managerName: managerName || null,   // text only
                score1: score1 ?? null,
                score2: score2 ?? null,
                score3: score3 ?? null,
                totalscore: totalScore,
                startdate: startdate || null,
                enddate: enddate || null,
                daysremaining: daysremaining,
            });
        }

        return ReS(res, scoreSheet, 200);
    } catch (error) {
        return ReE(res, error.message, 422);
    }
};

module.exports.upsertScoreSheet = upsertScoreSheet;



var getScoreSheet = async (req, res) => {
    try {
        const { managerid } = req.params;

        const whereCondition = managerid
            ? { manager: managerid }
            : {};

        const scoreSheets = await model.ScoreSheet.findAll({
            where: whereCondition,
        });

        const managers = await model.TeamManager.findAll({
            attributes: ["id", "name", "email", "mobileNumber"],
            raw: true,
        });

        return ReS(
            res,
            {
                scoresheets: scoreSheets || [],
                managers: managers || [],
            },
            200
        );
    } catch (error) {
        return ReE(res, error.message, 422);
    }
};

module.exports.getScoreSheet = getScoreSheet;
