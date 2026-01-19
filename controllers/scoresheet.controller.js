"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

//  Upsert ScoreSheet (total score auto-calculated)
var upsertScoreSheet = async (req, res) => {
    const {
        id,
        session,
        department,
        link,
        portfoliolink,
        videolink,
        comment,
        manager, // manager NAME from frontend
        score1,
        score2,
        score3,
    } = req.body;

    try {
        // 🔹 Auto calculate total score
        const totalScore =
            (score1 ?? 0) +
            (score2 ?? 0) +
            (score3 ?? 0);

        // 🔹 Resolve manager name → id
        let managerId = null;

        if (manager) {
            const managerRecord = await model.TeamManager.findOne({
                where: { name: manager },
            });

            if (!managerRecord) {
                return ReE(res, "Manager not found", 400);
            }

            managerId = managerRecord.id;
        }

        let scoreSheet;

        if (id) {
            // Update existing record
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
                manager: managerId,
                score1: score1 ?? null,
                score2: score2 ?? null,
                score3: score3 ?? null,
                totalscore: totalScore,
            });
        } else {
            // Create new record
            scoreSheet = await model.ScoreSheet.create({
                session: session || null,
                department: department || null,
                link: link || null,
                portfoliolink: portfoliolink || null,
                videolink: videolink || null,
                comment: comment || null,
                manager: managerId,
                score1: score1 ?? null,
                score2: score2 ?? null,
                score3: score3 ?? null,
                totalscore: totalScore,
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
            include: [
                {
                    model: model.TeamManager,
                    attributes: ["id", "name"],
                },
            ],
        });

        const formattedScoreSheets = scoreSheets.map((s) => ({
            ...s.toJSON(),
            managerName: s.TeamManager ? s.TeamManager.name : null,
        }));

        const managers = await model.TeamManager.findAll({
            attributes: ["id", "name", "email", "mobileNumber"],
            raw: true,
        });

        return ReS(
            res,
            {
                scoresheets: formattedScoreSheets || [],
                managers: managers || [],
            },
            200
        );
    } catch (error) {
        return ReE(res, error.message, 422);
    }
};

module.exports.getScoreSheet = getScoreSheet;
