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

module.exports = router;
