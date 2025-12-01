const cron = require("node-cron");
const model = require("../models");

process.env.TZ = "Asia/Kolkata"; // ensure correct timezone

// 🔄 Sync FundsAudit → FundsAuditStudent
const syncFundsAudit = async () => {
    try {
        console.log("🕒 Running FundsAudit Sync Cron:", new Date().toLocaleString("en-IN"));

        // 1️⃣ Fetch resumes with user + paid fund audits
        const records = await model.StudentResume.findAll({
            include: [
                {
                    model: model.User,
                    as: "user",
                    attributes: ["id"],
                    include: [
                        {
                            model: model.FundsAudit,
                            attributes: [
                                "id",
                                "registeredUserId",
                                "firstName",
                                "lastName",
                                "phoneNumber",
                                "email",
                                "dateOfPayment",
                                "dateOfDownload",
                                "hasPaid",
                                "isDownloaded",
                                "queryStatus",
                                "isQueryRaised",
                                "occupation",
                            ],
                            where: { hasPaid: true },
                            required: false,
                        },
                        {
                            model: model.TeamManager,
                            as: "teamManager",
                            attributes: ["name"],
                            required: false,
                        }
                    ],
                },
            ],
        });

        // 2️⃣ Insert FundsAuditStudent rows (skip duplicates)
        for (const resume of records) {
            const user = resume.user;
            if (!user || !user.FundsAudits) continue;

            for (const fa of user.FundsAudits) {
                const exists = await model.FundsAuditStudent.findOne({
                    where: {
                        studentResumeId: resume.id,
                        userId: user.id,
                        fundsAuditId: fa.id,
                    },
                });

                if (exists) {
                    console.log(`⚠️ Duplicate skipped: Resume ${resume.id}, Audit ${fa.id}`);
                    continue;
                }

                const teamManagerName = user.teamManager ? user.teamManager.name : resume.teamManagerId;

                await model.FundsAuditStudent.create({
                    studentResumeId: resume.id,
                    userId: user.id,
                    fundsAuditId: fa.id,
                    registeredUserId: fa.registeredUserId,
                    firstName: fa.firstName,
                    lastName: fa.lastName,
                    phoneNumber: fa.phoneNumber,
                    email: fa.email,
                    dateOfPayment: fa.dateOfPayment,
                    dateOfDownload: fa.dateOfDownload,
                    hasPaid: fa.hasPaid,
                    isDownloaded: fa.isDownloaded,
                    queryStatus: fa.queryStatus,
                    isQueryRaised: fa.isQueryRaised,
                    occupation: fa.occupation,
                    teamManager: teamManagerName,
                });

                console.log(`✅ Inserted FundsAuditStudent: Resume ${resume.id}, Audit ${fa.id}`);
            }
        }

        console.log("✅ FundsAudit Sync Completed Successfully.");

    } catch (error) {
        console.error("❌ Cron Error (syncFundsAudit):", error);
    }
};

// 🔁 Run every 5 minutes (adjust if needed)
cron.schedule("*/5 * * * *", async () => {
    await syncFundsAudit();
});

module.exports = { syncFundsAudit };
