"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

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
        const managerId = manager ? Number(manager) : null; // FIX

        const totalScore = Math.round(
            ((score1 ?? 0) + (score2 ?? 0) + (score3 ?? 0)) / 3
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 🔹 DATE SET 1
        let daysremaining = 0;
        if (enddate) {
            const end = new Date(enddate);
            if (!isNaN(end.getTime())) {
                end.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil(
                    (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                );
                daysremaining = diffDays > 0 ? diffDays : 0;
            }
        }

        // 🔹 DATE SET 2 (AUTO)
        let daysremaining1 = 0;
        if (enddate1) {
            const end1 = new Date(enddate1);
            if (!isNaN(end1.getTime())) {
                end1.setHours(0, 0, 0, 0);
                const diffDays1 = Math.ceil(
                    (end1.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                );
                daysremaining1 = diffDays1 > 0 ? diffDays1 : 0;
            }
        }

        let scoreSheet;

        if (id) {
            scoreSheet = await model.ScoreSheet.findOne({ where: { id } });
            if (!scoreSheet) return ReE(res, "ScoreSheet not found", 404);

            //  THIS WAS FAILING EARLIER — NOW FIXED
            if (managerId) {
                await model.ScoreSheet.update(
                    {
                        startdate1: startdate1 || null,
                        enddate1: enddate1 || null,
                        daysremaining1,
                    },
                    { where: { manager: managerId } }
                );
            }

            await scoreSheet.update({
                session: session || null,
                department: department || null,
                link: link || null,
                portfoliolink: portfoliolink || null,
                videolink: videolink || null,
                comment: comment || null,
                manager: managerId,
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
                manager: managerId,
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



var getUserSessionStats = async (req, res) => {
    try {
        const { managerid } = req.params;

        if (!managerid) return ReE(res, "managerid is required", 400);

        const sessions = await model.ScoreSheet.findAll({
            where: { manager: managerid },
            attributes: ["totalscore"],
            raw: true,
        });

        const totalSessions = sessions.length;

        let achievedSessions = 0;
        let scoreSum = 0;

        sessions.forEach(s => {
            const score = Number(s.totalscore) || 0;
            scoreSum += score;

            if (score >= 7) {
                achievedSessions++;
            }
        });

        const overallScore =
            totalSessions > 0
                ? Math.round((scoreSum / totalSessions) * 100) / 100
                : 0;

        return ReS(
            res,
            {
                managerid,
                totalSessions,
                achievedSessions,
                overallScore,

                // 🔹 FORCE SAME KEYS FOR FRONTEND
                startdate1: null,
                enddate1: null,
                daysremaining1: 0,
            },
            200
        );
    } catch (error) {
        return ReE(res, error.message, 422);
    }
};

module.exports.getUserSessionStats = getUserSessionStats;

