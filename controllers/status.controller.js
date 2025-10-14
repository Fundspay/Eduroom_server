"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Status,TeamManager } = require("../models");
const { sendMail } = require("../middleware/mailer.middleware");

// ✅ Fetch all Statuses (active only, excluding soft-deleted)
var listAll = async function (req, res) {
    try {
        // 1️⃣ Get all Status data
        const statuses = await model.Status.findAll({
            where: { isDeleted: false },
            raw: true
        });

        // 2️⃣ Get all FundsAudit data directly
        const fundsAudits = await model.FundsAudit.findAll({
            where: {}, // add conditions if needed
            raw: true
        });

        // 3️⃣ Map: Match userName in Status ↔ firstName + lastName in FundsAudit
        const statusWithFunds = statuses.map(status => {
            const matchedFunds = fundsAudits.filter(fund => {
                const fullName = `${fund.firstName ?? ""} ${fund.lastName ?? ""}`.trim().toLowerCase();
                const statusName = (status.userName ?? "").trim().toLowerCase();
                return fullName === statusName;
            });

            // if found, attach matchedFunds + first matching user's data
            const matchedUser = matchedFunds.length > 0
                ? { firstName: matchedFunds[0].firstName, lastName: matchedFunds[0].lastName, email: matchedFunds[0].email }
                : null;

            return {
                ...status,
                matchedUser,
                fundsAudit: matchedFunds
            };
        });

        // 4️⃣ Fetch team managers as before
        const allTeamManagers = await model.TeamManager.findAll({
            where: { isDeleted: false },
            attributes: ["id", "managerId", "name", "email", "mobileNumber", "department", "position", "internshipStatus"]
        });

        // 5️⃣ Return final response
        return ReS(res, {
            success: true,
            data: statusWithFunds,
            teamManagers: {
                total: allTeamManagers.length,
                list: allTeamManagers
            }
        }, 200);

    } catch (error) {
        return ReE(res, error.message, 500);
    }
};

module.exports.listAll = listAll;


var updateStatus = async function (req, res) {
    try {
        const { id } = req.params;
        if (!id) return ReE(res, "ID is required", 400);

        const status = await Status.findByPk(id);
        if (!status) return ReE(res, "Status not found", 404);

        const oldTeamManager = status.teamManager;

        // 📝 Update the fields
        await status.update(req.body);
        await status.reload();

        const newManagerName = req.body.teamManager;

        // ✅ Send mail if teamManager assigned or changed
        if (newManagerName && newManagerName !== oldTeamManager) {
            const manager = await TeamManager.findOne({ where: { name: newManagerName } });

            if (manager && status.email) {
                const isFirstAssignment = !oldTeamManager || oldTeamManager === null || oldTeamManager === "";

                let subject = "";
                let html = "";

                if (isFirstAssignment) {
                    // 🟢 First Time Assignment Mail
                    subject = `Your Team Manager Has Been Assigned`;

                    html = `
                        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                            <p>Dear <strong>${status.userName}</strong>,</p>

                            <p>We are pleased to inform you that <strong>${manager.name}</strong> has been assigned as your <strong>Team Manager</strong>.</p>

                            <p>You can reach out to your Team Manager for any queries, doubts, or guidance during your internship.</p>

                            <ul>
                                <li><strong>Email:</strong> ${manager.email}</li>
                                <li><strong>Phone:</strong> ${manager.mobileNumber}</li>
                            </ul>

                            <p>If your Team Manager is not available, please contact our <strong>HR Support 8446874534</strong>.</p>

                            <p>Welcome again to <strong>EduRoom</strong>!</p>

                            <p>Best regards,<br>
                            <strong>EduRoom HR Team</strong></p>
                        </div>
                    `;
                } else {
                    // 🔵 Manager Changed Mail
                    subject = `Your Team Manager Has Been Updated`;

                    html = `
                        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                            <p>Dear <strong>${status.userName}</strong>,</p>

                            <p>We wanted to let you know that your <strong>Team Manager</strong> has been updated.</p>

                            <p>Your new Team Manager is <strong>${manager.name}</strong>.</p>

                            <p>You can contact them for any internship-related doubts or queries:</p>

                            <ul>
                                <li><strong>Email:</strong> ${manager.email}</li>
                                <li><strong>Phone:</strong> ${manager.mobileNumber}</li>
                            </ul>

                            <p>If your Team Manager is not available, please reach out to our <strong>HR Support 8446874534</strong>.</p>

                            <p>Thank you for your understanding and cooperation.</p>

                            <p>Warm regards,<br>
                            <strong>EduRoom HR Team</strong></p>
                        </div>
                    `;
                }

                // ✉️ Send the email
                await sendMail(status.email, subject, html);
                console.log(`📩 Mail sent to ${status.email} — ${isFirstAssignment ? "assigned" : "updated"} manager ${manager.name}`);
            }
        }

        return ReS(res, status, 200);
    } catch (error) {
        console.error("❌ Error updating status:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.updateStatus = updateStatus;
