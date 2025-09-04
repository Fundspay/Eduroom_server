"use strict";
const model = require("../models/index");
const bcrypt = require("bcrypt");
const { ReE, ReS } = require("../utils/util.service.js");
const { sendMail } = require("../middleware/mailer.middleware");
const crypto = require("crypto");
const { Op } = require("sequelize");

// ✅ Add User
var addUser = async (req, res) => {
    try {
        const { firstName, lastName, email, phoneNumber, password, gender,
            collegeName, course, state, city, referralCode, referralLink } = req.body;

        // Basic validation
        if (!firstName || !lastName || !email || !password) {
            return ReE(res, "Missing required fields", 400);
        }

        // Validate Gender (if provided)
        let userGender = null;
        if (gender) {
            const gen = await model.Gender.findByPk(gender);
            if (!gen) return ReE(res, "Invalid gender ID", 400);
            userGender = gen.id;
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the user
        const user = await model.User.create({
            firstName,
            lastName,
            email,
            phoneNumber,
            password: hashedPassword,
            gender: userGender,
            collegeName,
            course,
            state,
            city,
            referralCode,
            referralLink
        });

        /// Send welcome email
        const subject = "Welcome to EduRoom! 🎓";
        const html = `
    <h3>Hi ${firstName},</h3>
    <p>Welcome to <strong>EduRoom</strong> – your learning journey starts here! 🚀</p>
    <p>Your account has been successfully created. You can now login with your email: <strong>${email}</strong></p>
    <p>Explore your courses, track your progress, and grow your skills with us.</p>
    <p><a href="https://eduroom.in/login" target="_blank">👉 Click here to login</a></p>
    <br>
    <p>Happy Learning,<br>The EduRoom Team</p>
`;

        const mailResponse = await sendMail(email, subject, html);
        if (!mailResponse.success) {
            console.error("Failed to send welcome email:", mailResponse.error);
        }

        return ReS(res, { success: true, user }, 201);

    } catch (error) {
        console.error("Error:", error);

        if (error.name === "SequelizeValidationError") {
            return ReE(res, error.errors.map(e => e.message), 422);
        }

        if (error.name === "SequelizeUniqueConstraintError") {
            return ReE(res, "Duplicate entry detected!", 422);
        }

        return ReE(res, error.message, 422);
    }
};
module.exports.addUser = addUser;

// ✅ Fetch All Users
var fetchAllUsers = async (req, res) => {
    try {
        const users = await model.User.findAll({
            where: { isDeleted: false },
            include: [model.Gender] // only Gender left
        });
        return ReS(res, { success: true, data: users }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchAllUsers = fetchAllUsers;

// ✅ Fetch Single User
var fetchSingleUser = async (req, res) => {
    try {
        const user = await model.User.findByPk(req.params.id, {
            include: [
                { model: model.Gender, attributes: { exclude: ["createdAt", "updatedAt"] } }
            ]
        });

        if (!user || user.isDeleted) return ReE(res, "User not found", 404);

        return ReS(res, { success: true, user: user.get({ plain: true }) }, 200);

    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchSingleUser = fetchSingleUser;

// ✅ Update User
var updateUser = async (req, res) => {
    try {
        const user = await model.User.findByPk(req.params.id);
        if (!user || user.isDeleted) return ReE(res, "User not found", 404);

        const { firstName, lastName, phoneNumber, gender, email,
            collegeName, course, state, city, referralCode, referralLink } = req.body;

        // Validate gender if provided
        if (gender && !(await model.Gender.findByPk(gender))) {
            return ReE(res, "Invalid gender", 400);
        }

        let updatedFields = {
            firstName: firstName || user.firstName,
            lastName: lastName || user.lastName,
            phoneNumber: phoneNumber || user.phoneNumber,
            gender: gender || user.gender,
            email: email || user.email,
            collegeName: collegeName || user.collegeName,
            course: course || user.course,
            state: state || user.state,
            city: city || user.city,
            referralCode: referralCode || user.referralCode,
            referralLink: referralLink || user.referralLink
        };

        await user.update(updatedFields);

        return ReS(res, { success: true, user }, 200);

    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.updateUser = updateUser;

// ✅ Soft Delete User
var deleteUser = async (req, res) => {
    try {
        const user = await model.User.findByPk(req.params.id);
        if (!user) return ReE(res, "User not found", 404);

        await user.update({ isDeleted: true });
        return ReS(res, { success: true, message: "User deleted successfully" }, 200);

    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.deleteUser = deleteUser;

// ✅ Login User
const loginWithEmailPassword = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return ReE(res, "Missing email or password", 400);
        }

        const user = await model.User.findOne({
            where: { email, isDeleted: false }
        });

        if (!user) return ReE(res, "Invalid credentials", 401);

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return ReE(res, "Invalid credentials", 401);

        const isFirstLogin = !user.hasLoggedIn;
        if (isFirstLogin) await user.update({ hasLoggedIn: true });

        await user.update({ lastLoginAt: new Date() });

        return ReS(res, {
            user_id: user.id,
            name: user.firstName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            photoUrl: user.photoUrl || null,
            collegeName: user.collegeName,
            course: user.course,
            state: user.state,
            city: user.city,
            referralCode: user.referralCode,
            referralLink: user.referralLink,
            isFirstLogin,
        }, 200);

    } catch (error) {
        console.error("Login Error:", error);
        return ReE(res, error.message, 500);
    }
};
module.exports.loginWithEmailPassword = loginWithEmailPassword;

// ✅ Logout User
const logoutUser = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return ReE(res, "Missing userId", 400);
        }

        const user = await model.User.findByPk(userId);
        if (!user || user.isDeleted) {
            return ReE(res, "User not found", 404);
        }

        await user.update({ lastLogoutAt: new Date() });

        return ReS(res, { success: true, message: "Logged out successfully" }, 200);
    } catch (error) {
        console.error("Logout Error:", error);
        return ReE(res, error.message, 500);
    }
};
module.exports.logoutUser = logoutUser;

// ✅ Request Password Reset
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return ReE(res, "Email is required", 400);

    const user = await model.User.findOne({ where: { email, isDeleted: false } });

    if (!user) {
      // Generic response to prevent user enumeration
      return ReS(res, { message: "If the email is registered, a reset link has been sent." }, 200);
    }

    // Generate secure token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    await user.update({ resetToken, resetTokenExpiry });

    // Generate password reset link
    const queryParams = new URLSearchParams({ token: resetToken, email }).toString();
    const resetUrl = `https://eduroom.in/reset-password?${queryParams}`;

    // Email template
    const htmlContent = `
      <h3>Hello ${user.firstName},</h3>
      <p>You requested a password reset for your EduRoom account.</p>
      <p>Click the link below to reset your password (valid for 1 hour):</p>
      <p><a href="${resetUrl}" target="_blank" style="color:#007bff; text-decoration:underline;">Reset Password</a></p>
      <br>
      <p>If you didn’t request this, you can safely ignore this email.</p>
      <p>– The EduRoom Team</p>
    `;

    // ✅ Capture mail result
    const mailResult = await sendMail(email, "EduRoom - Password Reset Request", htmlContent);
    console.log(" Password Reset Email Result:", mailResult);

    if (!mailResult.success) {
      console.error(" Failed to send reset email:", mailResult.error);
      return ReE(res, "Failed to send reset email. Please try again later.", 500);
    }

    return ReS(res, { message: "If the email is registered, a reset link has been sent." }, 200);

  } catch (error) {
    console.error("Password reset error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.requestPasswordReset = requestPasswordReset;

// ✅ Reset Password
const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return ReE(res, "All fields are required", 400);
    }

    const user = await model.User.findOne({
      where: {
        email,
        resetToken: token,
        resetTokenExpiry: { [Op.gt]: Date.now() },
        isDeleted: false,
      },
    });

    if (!user) return ReE(res, "Invalid or expired reset token", 400);

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await user.update({
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    });

    return ReS(res, { message: "Password has been reset successfully" }, 200);

  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.resetPassword = resetPassword;

