const express = require("express");
const router = express.Router();


// Example Route Imports
// const exampleRouter = require("./example.route");
const userRouter = require("./user.route");
const genderRouter = require("./gender.route")

// Health Check Route
router.get("/health", (req, res) => {
  res.status(200).send("Healthy Server!");
});


// Add your route imports and `router.use()` registrations below
// router.use("/example", exampleRouter);
router.use("/user", userRouter);
router.use("/gender", genderRouter);

module.exports = router;
