const express = require("express");
const router = express.Router();


// Example Route Imports
// const exampleRouter = require("./example.route");
const userRouter = require("./user.route");
const genderRouter = require("./gender.route")
const internshipmodeRouter = require("./internshipmode.route");
const communicationmodeRouter = require("./communicationmode.route");
const domainRouter = require("./domain.route");
const courseRouter = require("./course.route");
const coursepreviewRouter = require("./coursepreview.route");
const coursedetailRouter = require("./coursedetail.route");
const teamManagerRouter = require("./teamManager.route");
const offerletterRouter = require("./offerletter.route");
const contactusRouter = require("./contactus.route");
const internshipcertificateRouter = require("./internshipcertificate.route");
const raisequeryRouter = require("./raisequery.route");
const fundsauditRouter = require("./fundsaudit.route");
const statusRouter = require("./status.route");


const cosheetRouter = require("./cosheet.route"); 

const resumedetailsRouter =require("./resumedetails.route")
const mytargetRouter = require("./mytarget.route");

const studentresumeRouter = require("./studentresume.route");
const analysis = require("./analysis.route");
const selectedcoursedetailRouter = require("./selectedcoursedetail.route");

const selectiondomainRouter = require("./selectionDomain.route");




// Health Check Route
router.get("/health", (req, res) => {
  res.status(200).send("Healthy Server!");
});


// Add your route imports and `router.use()` registrations below
// router.use("/example", exampleRouter);
router.use("/user", userRouter);
router.use("/gender", genderRouter);
router.use("/internshipmode", internshipmodeRouter);
router.use("/communicationmode", communicationmodeRouter);
router.use("/domain", domainRouter);
router.use("/course", courseRouter);
router.use("/coursepreview", coursepreviewRouter);
router.use("/coursedetail", coursedetailRouter);
router.use("/teammanager", teamManagerRouter);
router.use("/offerletter", offerletterRouter);
router.use("/contactus", contactusRouter);
router.use("/internshipcertificate", internshipcertificateRouter);
router.use("/raisequery", raisequeryRouter);
router.use("/fundsaudit", fundsauditRouter);
router.use("/status", statusRouter);
router.use("/cosheet", cosheetRouter);

router.use("/resumedetails", resumedetailsRouter);
router.use("/mytarget", mytargetRouter);

router.use("/studentresume", studentresumeRouter);
router.use("/analysis", analysis);
router.use("/selectedcoursedetail", selectedcoursedetailRouter);

router.use("/selection-domain", selectiondomainRouter);


module.exports = router;
