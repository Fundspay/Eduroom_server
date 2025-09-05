"use strict";
const model = require("../models/index");
const bcrypt = require("bcrypt");
const { ReE, ReS } = require("../utils/util.service.js");
const { sendMail } = require("../middleware/mailer.middleware");
const crypto = require("crypto");
const { Op } = require("sequelize");
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require("../config/firebase-service-account.json"))
    });
}

// **
//  * 🔹 STEP 1: Create Student Personal Information
//  */
var addPersonalInfo = async function (req, res) {
    try {
        const {
            firstName,
            lastName,
            fullName,
            dateOfBirth,
            gender,
            phoneNumber,
            alternatePhoneNumber,
            email,
            residentialAddress,
            emergencyContactName,
            emergencyContactNumber,
            city,
            state,
            pinCode,
            password,
        } = req.body;

        if (!firstName || !lastName || !email || !phoneNumber || !password) {
            return ReE(res, "Required fields missing", 400);
        }

        const user = await model.User.create({
            firstName,
            lastName,
            fullName,
            dateOfBirth,
            gender,
            phoneNumber,
            alternatePhoneNumber,
            email,
            residentialAddress,
            emergencyContactName,
            emergencyContactNumber,
            city,
            state,
            pinCode,
            password,
        });

        return ReS(res, { success: true, userId: user.id }, 201);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.addPersonalInfo = addPersonalInfo;

/**
 * 🔹 STEP 2: Add Educational Details
 */
var addEducationalDetails = async function (req, res) {
    try {
        const { userId } = req.params;
        const {
            collegeName,
            collegeRollNumber,
            course,
            specialization,
            currentYearSemester,
            collegeAddress,
            placementCoordinatorName,
            placementCoordinatorContact,
        } = req.body;

        const user = await model.User.findByPk(userId);
        if (!user) return ReE(res, "User not found", 404);

        await user.update({
            collegeName,
            collegeRollNumber,
            course,
            specialization,
            currentYearSemester,
            collegeAddress,
            placementCoordinatorName,
            placementCoordinatorContact,
        });

        return ReS(res, { success: true, message: "Educational details updated" }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.addEducationalDetails = addEducationalDetails;

/**
 * 🔹 STEP 3: Add Internship Details
 */
var addInternshipDetails = async function (req, res) {
    try {
        const { userId } = req.params;
        const {
            internshipProgram,
            internshipDuration,
            internshipModeId,
            preferredStartDate,
            referralCode,
            referralLink,
            referralSource,
        } = req.body;

        const user = await model.User.findByPk(userId);
        if (!user) return ReE(res, "User not found", 404);

        await user.update({
            internshipProgram,
            internshipDuration,
            internshipModeId,
            preferredStartDate,
            referralCode,
            referralLink,
            referralSource,
        });

        return ReS(res, { success: true, message: "Internship details updated" }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.addInternshipDetails = addInternshipDetails;

/**
 * 🔹 STEP 4: Add Verification Docs
 */
/**
 * Upload & Save Verification Documents
 * Accepts: studentIdCard, governmentIdProof, passportPhoto
 */
var addVerificationDocs = async function (req, res) {
  try {
    const { userId } = req.params;

    const user = await model.User.findByPk(userId);
    if (!user) return ReE(res, "User not found", 404);

    // S3 file URLs from multer
    const studentIdCard = req.files?.studentIdCard?.[0]?.location || null;
    const governmentIdProof = req.files?.governmentIdProof?.[0]?.location || null;
    const passportPhoto = req.files?.passportPhoto?.[0]?.location || null;

    await user.update({
      studentIdCard,
      governmentIdProof,
      passportPhoto,
    });

    return ReS(res, { success: true, message: "Verification docs uploaded successfully" }, 200);
  } catch (error) {
    console.error("Error uploading verification docs:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.addVerificationDocs = addVerificationDocs;


/**
 * 🔹 STEP 5: Add Bank Details
 */
var addBankDetails = async function (req, res) {
    try {
        const { userId } = req.params;
        const {
            accountHolderName,
            bankName,
            branchAddress,
            ifscCode,
            accountNumber,
        } = req.body;

        const user = await model.User.findByPk(userId);
        if (!user) return ReE(res, "User not found", 404);

        await user.update({
            accountHolderName,
            bankName,
            branchAddress,
            ifscCode,
            accountNumber,
        });

        return ReS(res, { success: true, message: "Bank details updated" }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.addBankDetails = addBankDetails;

/**
 * 🔹 STEP 6: Add Communication Preferences
 */
var addCommunicationPreferences = async function (req, res) {
    try {
        const { userId } = req.params;
        const { preferredCommunicationId, linkedInProfile } = req.body;

        const user = await model.User.findByPk(userId);
        if (!user) return ReE(res, "User not found", 404);

        await user.update({
            preferredCommunicationId,
            linkedInProfile,
        });

        return ReS(res, { success: true, message: "Communication preferences updated" }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.addCommunicationPreferences = addCommunicationPreferences;

/**
 * 🔹 STEP 7: Add Declaration & Consent
 */
var addConsent = async function (req, res) {
    try {
        const { userId } = req.params;
        const { studentDeclaration, consentAgreement } = req.body;

        const user = await model.User.findByPk(userId);
        if (!user) return ReE(res, "User not found", 404);

        await user.update({
            studentDeclaration,
            consentAgreement,
        });

        return ReS(res, { success: true, message: "Consent updated" }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.addConsent = addConsent;

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

        // ✅ Only return allowed fields
        const payload = {
            user_id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.fullName,
            dateOfBirth: user.dateOfBirth,
            gender: user.gender,
            phoneNumber: user.phoneNumber,
            alternatePhoneNumber: user.alternatePhoneNumber,
            email: user.email,
            residentialAddress: user.residentialAddress,
            emergencyContactName: user.emergencyContactName,
            emergencyContactNumber: user.emergencyContactNumber,
            city: user.city,
            state: user.state,
            pinCode: user.pinCode
        };

        const token = jwt.sign(payload, CONFIG.jwtSecret, { expiresIn: "365d" });

        return ReS(res, { success: true, user: { ...payload, isFirstLogin, token } }, 200);

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

const loginWithGoogle = async (req, res) => {
    try {
        const firebaseUser = req.user; // Comes from firebaseAuth middleware

        // Find existing user
        const user = await model.User.findOne({ where: { email: firebaseUser.email, isDeleted: false } });
        if (!user) return ReE(res, "User not found. Please register first.", 404);

        // Mark first login if needed
        let isFirstLogin = false;
        if (!user.hasLoggedIn) {
            await user.update({ hasLoggedIn: true });
            isFirstLogin = true;
        }

        // ✅ Only return the allowed fields
        const payload = {
            user_id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.fullName,
            dateOfBirth: user.dateOfBirth,
            gender: user.gender,
            phoneNumber: user.phoneNumber,
            alternatePhoneNumber: user.alternatePhoneNumber,
            email: user.email,
            residentialAddress: user.residentialAddress,
            emergencyContactName: user.emergencyContactName,
            emergencyContactNumber: user.emergencyContactNumber,
            city: user.city,
            state: user.state,
            pinCode: user.pinCode
        };

        const token = jwt.sign(payload, CONFIG.jwtSecret, { expiresIn: "365d" });

        return ReS(res, { success: true, user: { ...payload, isFirstLogin, token } });

    } catch (error) {
        console.error("Google login failed:", error);
        return ReE(res, "Login failed", 500);
    }
};

module.exports.loginWithGoogle = loginWithGoogle;
