"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");


const safeParseJSON = (data) => {
  try {
    if (!data) return [];
    if (typeof data === "string") {
      return JSON.parse(data);
    }
    return data; // already object/array
  } catch (err) {
    console.warn(" JSON parse failed, returning raw data:", data);
    return data;
  }
};

// ✅ Create a new Course with Tutor, MCQs (with answers), and Case Studies
const createCourse = async (req, res) => {
  try {
    const {
      title,
      description,   // JSON array [{ type, content }]
      youtubeLink,
      type,
      duration,
      tutor,
      mcqs,
      caseStudies,
      userId
    } = req.body;

    if (!title || !tutor?.name || !userId) {
      return ReE(res, "Course title, tutor name, and userId are required", 400);
    }

    // 1️⃣ Create or reuse Tutor
    let tutorObj = await model.Tutor.findOne({
      where: { name: tutor.name, userId }
    });

    if (!tutorObj) {
      tutorObj = await model.Tutor.create({
        name: tutor.name,
        description: tutor.description || "",
        userId
      });
    }

    // 2️⃣ Prevent duplicate Course
    const existingCourse = await model.Course.findOne({
      where: { title, tutorId: tutorObj.id, userId, isDeleted: false }
    });
    if (existingCourse) {
      return ReE(res, "Course with this title already exists for this tutor.", 400);
    }

    // 3️⃣ Create Course
    const course = await model.Course.create({
      title,
      description: description || [],
      youtubeLink,
      type,
      duration,
      tutorId: tutorObj.id,
      userId
    });

    // 4️⃣ Create MCQs + Answers
    if (Array.isArray(mcqs)) {
      for (let i = 0; i < mcqs.length; i++) {
        const mcq = await model.MCQ.create({
          courseId: course.id,
          questionText: mcqs[i].questionText,
          serialNo: i + 1,
          userId
        });

        if (Array.isArray(mcqs[i].options)) {
          await Promise.all(
            mcqs[i].options.map(opt =>
              model.MCQAnswer.create({
                courseId: course.id,   // ✅ link to course
                mcqId: mcq.id,         // ✅ link to mcq
                answerText: opt.optionText,
                isCorrect: opt.isCorrect || false,
                userId
              })
            )
          );
        }
      }
    }

    // 5️⃣ Create Case Studies
    if (Array.isArray(caseStudies)) {
      await Promise.all(
        caseStudies.map(cs =>
          model.CaseStudy.create({
            courseId: course.id,     // ✅ link to course
            problemStatement: cs.problemStatement,
            answerKeywords: cs.answerKeywords,
            result: cs.result,
            userId
          })
        )
      );
    }

    return ReS(res, { success: true, courseId: course.id }, 201);
  } catch (error) {
    console.error("Create Course Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.createCourse = createCourse;


// ✅ Get all courses
const getAllCourses = async (req, res) => {
  try {
    const courses = await model.Course.findAll({
      where: { isDeleted: false },
      include: [
        { model: model.Tutor },
        {
          model: model.MCQ,
          include: [model.MCQAnswer]
        },
        { model: model.CaseStudy }
      ]
    });

    const parsedCourses = courses.map((course) => ({
      ...course.toJSON(),
      description: safeParseJSON(course.description)
    }));

    return ReS(res, { success: true, data: parsedCourses }, 200);
  } catch (error) {
    console.error("Get All Courses Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getAllCourses = getAllCourses;

// ✅ Fetch single course by ID
const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await model.Course.findOne({
      where: { id, isDeleted: false }, // ✅ consistent filter
      include: [
        { model: model.Tutor },
        {
          model: model.MCQ,
          include: [model.MCQAnswer] // ✅ fixed include
        },
        { model: model.CaseStudy }
      ]
    });

    if (!course) {
      return ReE(res, "Course not found", 404);
    }

    const parsedCourse = {
      ...course.toJSON(),
      description: safeParseJSON(course.description)
    };

    return ReS(res, { success: true, data: parsedCourse }, 200);
  } catch (error) {
    console.error("Get Course Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getCourseById = getCourseById;

// ✅ Update course (with nested data if provided)
const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      youtubeLink,
      type,
      duration,
      tutor,
      mcqs,
      caseStudies,
      userId
    } = req.body;

    //  Find the course
    const course = await model.Course.findByPk(id);
    if (!course || course.isDeleted) {
      return ReE(res, "Course not found", 404);
    }

    // Update course fields
    await course.update({
      title,
      description: description || [],
      youtubeLink,
      type,
      duration
    });

    //  Update or assign Tutor
    if (tutor) {
      let tutorObj = await model.Tutor.findOne({ where: { name: tutor.name, userId } });
      if (!tutorObj) {
        tutorObj = await model.Tutor.create({
          name: tutor.name,
          description: tutor.description || "",
          userId
        });
      }
      await course.update({ tutorId: tutorObj.id });
    }

    //  Replace MCQs + MCQAnswers if provided
    if (Array.isArray(mcqs)) {
      await model.MCQ.destroy({ where: { courseId: id } });

      for (let i = 0; i < mcqs.length; i++) {
        const mcq = await model.MCQ.create({
          courseId: id,
          questionText: mcqs[i].questionText,
          serialNo: i + 1,
          userId
        });

        if (Array.isArray(mcqs[i].options)) {
          await Promise.all(
            mcqs[i].options.map(opt =>
              model.MCQAnswer.create({
                courseId: id,
                mcqId: mcq.id,   
                answerText: opt.optionText,
                isCorrect: opt.isCorrect || false,
                userId
              })
            )
          );
        }
      }
    }

    //  Replace Case Studies if provided
    if (Array.isArray(caseStudies)) {
      await model.CaseStudy.destroy({ where: { courseId: id } });

      await Promise.all(
        caseStudies.map(cs =>
          model.CaseStudy.create({
            courseId: id,
            problemStatement: cs.problemStatement,
            answerKeywords: cs.answerKeywords,
            result: cs.result,
            userId
          })
        )
      );
    }

    return ReS(res, { success: true, message: "Course updated successfully" }, 200);
  } catch (error) {
    console.error("Update Course Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.updateCourse = updateCourse;

// ✅ Soft delete a course
const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await model.Course.findByPk(id);
    if (!course) return ReE(res, "Course not found", 404);

    await course.update({ isDeleted: true });

    return ReS(res, { success: true, message: "Course deleted successfully" }, 200);
  } catch (error) {
    console.error("Delete Course Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.deleteCourse = deleteCourse;

// ✅ Get Course with Tutor only by course ID
const getCourseWithTutorById = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await model.Course.findOne({
      where: { id, isDeleted: false },
      include: [
        {
          model: model.Tutor,
          attributes: ['id', 'name', 'description', 'userId'] // only tutor details
        }
      ]
    });

    if (!course) {
      return ReE(res, "Course not found", 404);
    }

    const parsedCourse = {
      ...course.toJSON(),
      description: course.description || []
    };

    return ReS(res, { success: true, data: parsedCourse }, 200);
  } catch (error) {
    console.error("Get Course with Tutor Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getCourseWithTutorById = getCourseWithTutorById;

// ✅ Get Course YouTube link + MCQ questions only by course ID
const getCourseMCQsAndYouTube = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await model.Course.findOne({
      where: { id, isDeleted: false },
      attributes: ['id', 'title', 'youtubeLink'], // only title + youtubeLink
      include: [
        {
          model: model.MCQ,
          attributes: ['id', 'questionText', 'serialNo'], // ✅ no answers
          order: [['serialNo', 'ASC']]
        }
      ]
    });

    if (!course) {
      return ReE(res, "Course not found", 404);
    }

    return ReS(res, { success: true, data: course }, 200);
  } catch (error) {
    console.error("Get Course MCQs and YouTube Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getCourseMCQsAndYouTube = getCourseMCQsAndYouTube;

// ✅ Evaluate MCQ quiz for a course
// req.body: { courseId, answers: [{ mcqId, answerText }] }
const evaluateCourseMCQ = async (req, res) => {
  try {
    const { courseId, answers, userId } = req.body;

    if (!courseId || !Array.isArray(answers)) {
      return ReE(res, "Course ID and answers array are required", 400);
    }

    // 1️⃣ Fetch all MCQs and correct answers for the course
    const mcqs = await model.MCQ.findAll({
      where: { courseId },
      include: [
        {
          model: model.MCQAnswer,
          attributes: ['id', 'answerText', 'isCorrect']
        }
      ]
    });

    if (!mcqs.length) {
      return ReE(res, "No MCQs found for this course", 404);
    }

    // 2️⃣ Evaluate submitted answers
    let correctCount = 0;
    let incorrectCount = 0;

    answers.forEach(submitted => {
      const mcq = mcqs.find(m => m.id === submitted.mcqId);
      if (!mcq) return; // ignore invalid mcqId

      const correctAnswers = mcq.MCQAnswers.filter(a => a.isCorrect).map(a => a.answerText);
      // check if submitted answer matches any correct answer (case-insensitive)
      if (correctAnswers.some(a => a.trim().toLowerCase() === submitted.answerText.trim().toLowerCase())) {
        correctCount++;
      } else {
        incorrectCount++;
      }
    });

    const totalQuestions = mcqs.length;
    const score = correctCount; // 1 point per correct answer
    const percentage = ((correctCount / totalQuestions) * 100).toFixed(2);

    // 3️⃣ Return evaluation
    return ReS(res, {
      success: true,
      totalQuestions,
      correctAnswers: correctCount,
      incorrectAnswers: incorrectCount,
      score,
      percentage
    }, 200);

  } catch (error) {
    console.error("Evaluate Course MCQ Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.evaluateCourseMCQ = evaluateCourseMCQ;

// ✅ Get CaseStudy problem statements by course ID
const getCaseStudiesByCourseId = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch all case studies for this course
    const caseStudies = await model.CaseStudy.findAll({
      where: { courseId: id },
      attributes: ['id', 'problemStatement'] // only problem statement
    });

    if (!caseStudies.length) {
      return ReE(res, "No Case Studies found for this course", 404);
    }

    return ReS(res, { success: true, data: caseStudies }, 200);
  } catch (error) {
    console.error("Get Case Studies Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getCaseStudiesByCourseId = getCaseStudiesByCourseId;

// ✅ Evaluate CaseStudy answers
// req.body: { courseId, answers: [{ caseStudyId, answerParagraph }] }
const evaluateCaseStudies = async (req, res) => {
  try {
    const { courseId, answers, userId } = req.body;

    if (!courseId || !Array.isArray(answers)) {
      return ReE(res, "Course ID and answers array are required", 400);
    }

    // 1️⃣ Fetch all CaseStudies for this course
    const caseStudies = await model.CaseStudy.findAll({
      where: { courseId },
      attributes: ['id', 'answerKeywords']
    });

    if (!caseStudies.length) {
      return ReE(res, "No Case Studies found for this course", 404);
    }

    let correctCount = 0;
    let incorrectCount = 0;

    answers.forEach(submitted => {
      const cs = caseStudies.find(c => c.id === submitted.caseStudyId);
      if (!cs) return;

      // 2️⃣ Get keywords (comma-separated or JSON array)
      let keywords = [];
      try {
        keywords = typeof cs.answerKeywords === 'string' ? cs.answerKeywords.split(',') : cs.answerKeywords;
      } catch {
        keywords = [];
      }

      // 3️⃣ Count matched keywords in submitted paragraph (case-insensitive)
      const text = submitted.answerParagraph.toLowerCase();
      const matchedKeywords = keywords.filter(k => text.includes(k.toLowerCase()));

      // 4️⃣ Accept if 3 or more keywords found
      if (matchedKeywords.length >= 3) {
        correctCount++;
      } else {
        incorrectCount++;
      }
    });

    const totalQuestions = caseStudies.length;
    const score = ((correctCount / totalQuestions) * 100).toFixed(2);
    const percentage = score;

    return ReS(res, {
      success: true,
      totalQuestions,
      correctAnswers: correctCount,
      incorrectAnswers: incorrectCount,
      score,
      percentage
    }, 200);

  } catch (error) {
    console.error("Evaluate Case Studies Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.evaluateCaseStudies = evaluateCaseStudies;




