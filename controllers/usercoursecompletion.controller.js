"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const PDFDocument = require("pdfkit");
const { sendMail } = require("../middleware/mailer"); // your existing mailer

// Helper to generate PDF certificate
const generateCertificate = (userName, courseTitle) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const buffers = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    doc.fontSize(25).text("Internship Completion Certificate", { align: "center" });
    doc.moveDown();
    doc.fontSize(18).text(`This is to certify that ${userName}`, { align: "center" });
    doc.moveDown();
    doc.text(`has successfully completed the course: ${courseTitle}`, { align: "center" });
    doc.moveDown();
    doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: "center" });

    doc.end();
  });
};

// ✅ Main endpoint
const completeCourseAndSendCertificate = async (req, res) => {
  try {
    const { userId, courseId } = req.body;

    if (!userId || !courseId) {
      return ReE(res, "userId and courseId are required", 400);
    }

    // 1️⃣ Fetch user and course
    const user = await model.User.findByPk(userId);
    const course = await model.Course.findByPk(courseId);

    if (!user || !course) return ReE(res, "User or Course not found", 404);

    // 2️⃣ Evaluate MCQs
    const mcqs = await model.MCQ.findAll({ where: { courseId }, include: [model.MCQAnswer] });
    const totalMCQs = mcqs.length;

    const userMCQAnswers = await model.MCQAnswer.findAll({
      where: { userId, mcqId: mcqs.map(m => m.id) }
    });

    let correctMCQs = 0;
    mcqs.forEach(mcq => {
      const correctAnswers = mcq.MCQAnswers?.filter(a => a.isCorrect).map(a => a.answerText) || [];
      const userAnswer = userMCQAnswers.find(a => a.mcqId === mcq.id);
      if (userAnswer && correctAnswers.some(ans => ans.trim().toLowerCase() === userAnswer.answerText.trim().toLowerCase())) {
        correctMCQs++;
      }
    });

    const mcqPercentage = totalMCQs > 0 ? (correctMCQs / totalMCQs) * 100 : 0;

    // 3️⃣ Evaluate CaseStudies
    const caseStudies = await model.CaseStudy.findAll({ where: { courseId } });
    const totalCS = caseStudies.length;
    let correctCS = 0;

    const userCSAnswers = await model.CaseStudy.findAll({ where: { userId, courseId } });

    caseStudies.forEach(cs => {
      const submitted = userCSAnswers.find(a => a.id === cs.id);
      if (!submitted) return;

      let keywords = typeof cs.answerKeywords === "string" ? cs.answerKeywords.split(",") : cs.answerKeywords;
      const text = submitted.result?.toLowerCase() || "";
      const matched = keywords.filter(k => text.includes(k.toLowerCase()));

      if (matched.length >= 3) correctCS++;
    });

    const csCompleted = correctCS === totalCS;

    // 4️⃣ Check completion criteria
    if (mcqPercentage >= 75 && csCompleted) {
      // Check if certificate already sent
      let completionRecord = await model.UserCourseCompletion.findOne({ where: { userId, courseId } });
      if (!completionRecord) {
        completionRecord = await model.UserCourseCompletion.create({ userId, courseId });
      }

      if (!completionRecord.certificateSent) {
        const pdfBuffer = await generateCertificate(user.name, course.title);

        // Send email using your existing sendMail middleware
        const emailHtml = `<p>Congratulations ${user.name}! Please find your Internship Certificate attached.</p>`;
        const mailResult = await sendMail(user.email, "Your Internship Certificate", emailHtml, [
          {
            filename: "Certificate.pdf",
            content: pdfBuffer,
            contentType: "application/pdf",
          }
        ]);

        if (!mailResult.success) {
          console.error("Failed to send certificate:", mailResult.error);
        }

        await completionRecord.update({
          mcqScore: mcqPercentage,
          caseStudyScore: (correctCS / totalCS) * 100,
          percentage: ((mcqPercentage + (correctCS / totalCS) * 100) / 2).toFixed(2),
          certificateSent: true,
          completionDate: new Date()
        });
      }

      return ReS(res, { success: true, message: "Course completed and certificate sent." }, 200);
    } else {
      return ReS(res, {
        success: false,
        message: "Course not completed. MCQ ≥75% and all Case Studies must be completed."
      }, 200);
    }

  } catch (error) {
    console.error("Complete Course Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.completeCourseAndSendCertificate = completeCourseAndSendCertificate;
