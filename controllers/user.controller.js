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


// ✅  STEP 1: Create Student Personal Information


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


//  ✅ STEP 2: Add Educational Details
 
var addEducationalDetails = async function (req, res) {
    try {
        const { userId } = req.params;
        const {
            collegeName,
            collegeRollNumber,
            course,
            specialization,
            currentYear,
            currentSemester,
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
            currentYear,
            currentSemester,
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


// ✅ STEP 3: Add Internship Details
 
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

// ✅ STEP 4: Add Verification Docs

const addVerificationDocs = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await model.User.findByPk(userId);
    if (!user) return ReE(res, "User not found", 404);

    // Debug log incoming files
    console.log("Uploaded files:", req.files);

    // Extract file URLs from multer-S3
    const studentIdCard = req.files?.studentIdCard?.[0]?.location || null;
    const governmentIdProof = req.files?.governmentIdProof?.[0]?.location || null;
    const passportPhoto = req.files?.passportPhoto?.[0]?.location || null;

    // Ensure all files are uploaded
    if (!studentIdCard || !governmentIdProof || !passportPhoto) {
      return ReE(res, "All 3 documents (Student ID, Government ID, Passport Photo) are required", 400);
    }

    // Save to DB
    await user.update({
      studentIdCard,
      governmentIdProof,
      passportPhoto,
    });

    return ReS(
      res,
      {
        success: true,
        message: "Verification docs uploaded successfully",
        data: { studentIdCard, governmentIdProof, passportPhoto },
      },
      200
    );
  } catch (error) {
    console.error("Error uploading verification docs:", error);
    return ReE(res, error.message || "Internal Server Error", 500);
  }
};

module.exports.addVerificationDocs = addVerificationDocs;




//✅  STEP 5: Add Bank Details

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


// ✅  STEP 6: Add Communication Preferences

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


// ✅  STEP 7: Add Declaration & Consent
 
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

// Unified Login for User & TeamManager
const loginWithEmailPassword = async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password || !role) {
            return ReE(res, "Missing email, password or role", 400);
        }

        let modelRef, identifierField, payload;

        if (role === "user") {
            modelRef = model.User;
            identifierField = "id";
        } else if (role === "manager") {
            modelRef = model.TeamManager;
            identifierField = "managerId";
        } else {
            return ReE(res, "Invalid role specified", 400);
        }

        // Find record in the correct model
        const account = await modelRef.findOne({
            where: { email, isDeleted: false }
        });

        if (!account) return ReE(res, "Invalid credentials", 401);

        // Compare password
        const isMatch = await bcrypt.compare(password, account.password);
        if (!isMatch) return ReE(res, "Invalid credentials", 401);

        // Update login timestamp
        const isFirstLogin = !account.hasLoggedIn;
        if (isFirstLogin) await account.update({ hasLoggedIn: true });
        await account.update({ lastLoginAt: new Date() });

        // Build payload based on role
        if (role === "user") {
            payload = {
                user_id: account.id,
                firstName: account.firstName,
                lastName: account.lastName,
                fullName: account.fullName,
                dateOfBirth: account.dateOfBirth,
                gender: account.gender,
                phoneNumber: account.phoneNumber,
                alternatePhoneNumber: account.alternatePhoneNumber,
                email: account.email,
                residentialAddress: account.residentialAddress,
                emergencyContactName: account.emergencyContactName,
                emergencyContactNumber: account.emergencyContactNumber,
                city: account.city,
                state: account.state,
                pinCode: account.pinCode,
                role: "user"
            };
        } else if (role === "manager") {
            payload = {
                managerId: account.managerId,
                name: account.name,
                email: account.email,
                mobileNumber: account.mobileNumber,
                department: account.department,
                position: account.position,
                role: "manager"
            };
        }

        // Sign JWT with role info
        const token = jwt.sign(payload, CONFIG.jwtSecret, { expiresIn: "365d" });

        return ReS(res, {
            success: true,
            account: { ...payload, isFirstLogin, token }
        }, 200);

    } catch (error) {
        console.error("Login Error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.loginWithEmailPassword = loginWithEmailPassword;

//  Logout User (works for both User & TeamManager)
const logoutUser = async (req, res) => {
    try {
        const { id, role } = req.body;

        if (!id || !role) {
            return ReE(res, "Missing id or role", 400);
        }

        let modelRef, identifierField;

        if (role === "user") {
            modelRef = model.User;
            identifierField = "id";
        } else if (role === "manager") {
            modelRef = model.TeamManager;
            identifierField = "managerId";
        } else {
            return ReE(res, "Invalid role specified", 400);
        }

        //  Find the record
        const account = await modelRef.findOne({
            where: { [identifierField]: id, isDeleted: false }
        });

        if (!account) {
            return ReE(res, `${role} not found`, 404);
        }

        //  Update logout timestamp
        await account.update({ lastLogoutAt: new Date() });

        return ReS(res, {
            success: true,
            message: `${role} logged out successfully`
        }, 200);

    } catch (error) {
        console.error("Logout Error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.logoutUser = logoutUser;


//  Request Password Reset (works for both User & TeamManager)
const requestPasswordReset = async (req, res) => {
    try {
        const { email, role } = req.body;

        if (!email || !role) return ReE(res, "Email and role are required", 400);

        let modelRef;

        if (role === "user") {
            modelRef = model.User;
        } else if (role === "manager") {
            modelRef = model.TeamManager;
        } else {
            return ReE(res, "Invalid role specified", 400);
        }

        const account = await modelRef.findOne({ where: { email, isDeleted: false } });

        if (!account) {
            // Generic response to prevent user enumeration
            return ReS(res, { message: "If the email is registered, a reset link has been sent." }, 200);
        }

        // Generate secure token
        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenExpiry = Date.now() + 3600000; // 1 hour

        await account.update({ resetToken, resetTokenExpiry });

        // Generate password reset link
        const queryParams = new URLSearchParams({ token: resetToken, email }).toString();
        const resetUrl = `https://eduroom.in/reset-password?${queryParams}`;

        //  Email template
        const htmlContent = `
          <h3>Hello ${account.name || account.firstName},</h3>
          <p>You requested a password reset for your EduRoom account.</p>
          <p>Click the link below to reset your password (valid for 1 hour):</p>
          <p><a href="${resetUrl}" target="_blank" style="color:#007bff; text-decoration:underline;">Reset Password</a></p>
          <br>
          <p>If you didn’t request this, you can safely ignore this email.</p>
          <p>– The EduRoom Team</p>
        `;

        // Send email
        const mailResult = await sendMail(email, "EduRoom - Password Reset Request", htmlContent);
        console.log("Password Reset Email Result:", mailResult);

        if (!mailResult.success) {
            console.error("Failed to send reset email:", mailResult.error);
            return ReE(res, "Failed to send reset email. Please try again later.", 500);
        }

        return ReS(res, { message: "If the email is registered, a reset link has been sent." }, 200);

    } catch (error) {
        console.error("Password reset error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.requestPasswordReset = requestPasswordReset;


// Reset Password (works for both User & TeamManager)
const resetPassword = async (req, res) => {
    try {
        const { email, token, newPassword, role } = req.body;

        if (!email || !token || !newPassword || !role) {
            return ReE(res, "All fields are required", 400);
        }

        let modelRef;

        if (role === "user") {
            modelRef = model.User;
        } else if (role === "manager") {
            modelRef = model.TeamManager;
        } else {
            return ReE(res, "Invalid role specified", 400);
        }

        const account = await modelRef.findOne({
            where: {
                email,
                resetToken: token,
                resetTokenExpiry: { [Op.gt]: Date.now() },
                isDeleted: false,
            },
        });

        if (!account) return ReE(res, "Invalid or expired reset token", 400);

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await account.update({
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


//  Google Login (works for both User & TeamManager)
const loginWithGoogle = async (req, res) => {
    try {
        const { role } = req.body; // role must be "user" or "manager"
        const firebaseUser = req.user; // Comes from firebaseAuth middleware

        if (!role || (role !== "user" && role !== "manager")) {
            return ReE(res, "Invalid or missing role", 400);
        }

        const modelRef = role === "user" ? model.User : model.TeamManager;

        // Find existing account
        const account = await modelRef.findOne({
            where: { email: firebaseUser.email, isDeleted: false }
        });

        if (!account) return ReE(res, `${role === "user" ? "User" : "Manager"} not found. Please register first.`, 404);

        // Mark first login if needed
        let isFirstLogin = false;
        if (!account.hasLoggedIn) {
            await account.update({ hasLoggedIn: true });
            isFirstLogin = true;
        }

        //  Only return allowed fields
        const payload = {
            user_id: account.id,
            firstName: account.firstName,
            lastName: account.lastName,
            fullName: account.fullName || `${account.firstName} ${account.lastName}`,
            dateOfBirth: account.dateOfBirth || null,
            gender: account.gender || null,
            phoneNumber: account.phoneNumber || null,
            alternatePhoneNumber: account.alternatePhoneNumber || null,
            email: account.email,
            residentialAddress: account.residentialAddress || null,
            emergencyContactName: account.emergencyContactName || null,
            emergencyContactNumber: account.emergencyContactNumber || null,
            city: account.city || null,
            state: account.state || null,
            pinCode: account.pinCode || null
        };

        const token = jwt.sign(payload, CONFIG.jwtSecret, { expiresIn: "365d" });

        return ReS(res, { success: true, user: { ...payload, isFirstLogin, token } });

    } catch (error) {
        console.error("Google login failed:", error);
        return ReE(res, "Login failed", 500);
    }
};

module.exports.loginWithGoogle = loginWithGoogle;

