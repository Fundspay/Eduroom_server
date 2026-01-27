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

        // 🔹 DATE SET 1 → remaining days from TODAY (safe, never negative)
        let daysremaining = 0;
        if (enddate) {
            const end = new Date(enddate);
            if (!isNaN(end.getTime())) {
                end.setHours(0, 0, 0, 0);
                const diffTime = end.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                daysremaining = diffDays > 0 ? diffDays : 0;
            } else {
                daysremaining = 0;
            }
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
                startdate1: startdate1 ?? scoreSheet.startdate1,
                enddate1: enddate1 ?? scoreSheet.enddate1,
                daysremaining1: scoreSheet.daysremaining1,
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
                startdate1: startdate1 ?? null,
                enddate1: enddate1 ?? null,
                daysremaining1: null,
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
            raw: true,
        });

        // 🔹 Force missing fields for frontend
        const formatted = scoreSheets.map(s => ({
            ...s,
            startdate1: s.startdate1 ?? null,
            enddate1: s.enddate1 ?? null,
            daysremaining1: s.daysremaining1 ?? null,
        }));

        const managers = await model.TeamManager.findAll({
            attributes: ["id", "name", "email", "mobileNumber"],
            raw: true,
        });

        return ReS(
            res,
            {
                scoresheets: formatted || [],
                managers: managers || [],
            },
            200
        );
    } catch (error) {
        return ReE(res, error.message, 422);
    }
};

module.exports.getScoreSheet = getScoreSheet;
