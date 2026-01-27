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
        manager,      
        managerName,  
        score1,
        score2,
        score3,
        startdate,
        enddate,
        startdate1,
        enddate1,
    } = req.body;

    try {
        const totalScore = Math.round(
            ((score1 ?? 0) +
             (score2 ?? 0) +
             (score3 ?? 0)) / 3
        );

        // 🔹 TODAY date
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 🔹 DATE SET 1 → remaining days from TODAY
        let daysremaining = null;
        if (enddate) {
            const end = new Date(enddate);
            end.setHours(0, 0, 0, 0);
            const diffTime = end.getTime() - today.getTime();
            daysremaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        // 🔹 DATE SET 2 → remaining days from TODAY
        let daysremaining1 = null;
        if (enddate1) {
            const end1 = new Date(enddate1);
            end1.setHours(0, 0, 0, 0);
            const diffTime = end1.getTime() - today.getTime();
            daysremaining1 = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        let scoreSheet;

        if (id) {
            scoreSheet = await model.ScoreSheet.findOne({ where: { id } });

            if (!scoreSheet) return ReE(res, "ScoreSheet not found", 404);

            await scoreSheet.update({
                session: session || null,
                department: department || null,
                link: link || null,
                portfoliolink: portfoliolink || null,
                videolink: videolink || null,
                comment: comment || null,
                manager: manager || null,
                managerName: managerName || null,
                score1: score1 ?? null,
                score2: score2 ?? null,
                score3: score3 ?? null,
                totalscore: totalScore,
                startdate: startdate || null,
                enddate: enddate || null,
                daysremaining,
                startdate1: startdate1 || null,
                enddate1: enddate1 || null,
                daysremaining1,
            });
        } else {
            scoreSheet = await model.ScoreSheet.create({
                session: session || null,
                department: department || null,
                link: link || null,
                portfoliolink: portfoliolink || null,
                videolink: videolink || null,
                comment: comment || null,
                manager: manager || null,
                managerName: managerName || null,
                score1: score1 ?? null,
                score2: score2 ?? null,
                score3: score3 ?? null,
                totalscore: totalScore,
                startdate: startdate || null,
                enddate: enddate || null,
                daysremaining,
                startdate1: startdate1 || null,
                enddate1: enddate1 || null,
                daysremaining1,
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
