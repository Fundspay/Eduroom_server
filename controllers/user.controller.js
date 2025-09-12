"use strict";
const model = require("../models/index");
const bcrypt = require("bcrypt");
const { ReE, ReS } = require("../utils/util.service.js");
const { sendMail } = require("../middleware/mailer.middleware");
const crypto = require("crypto");
const { Op } = require("sequelize");
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const CONFIG = require("../config/config.js");
const axios = require('axios');
const moment = require("moment");




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

// Fetch users created within a date range (DD-MM-YYYY)
const fetchUsersByDateRange = async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) return ReE(res, "Both 'from' and 'to' dates are required", 400);

    // Parse dates using DD-MM-YYYY
    const fromDate = moment(from, "DD-MM-YYYY").startOf("day").toDate();
    const toDate = moment(to, "DD-MM-YYYY").endOf("day").toDate();

    if (!fromDate || !toDate) return ReE(res, "Invalid date format. Use DD-MM-YYYY", 400);

    // Fetch users within range
    const users = await model.User.findAll({
      where: {
        isDeleted: false,
        createdAt: {
          [Op.between]: [fromDate, toDate]
        }
      },
      include: [
        { model: model.Gender, attributes: { exclude: ["createdAt", "updatedAt"] } }
      ]
    });

    return ReS(res, {
      success: true,
      count: users.length,
      users: users.map(u => u.get({ plain: true }))
    }, 200);

  } catch (error) {
    console.error("Fetch Users By Date Range Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchUsersByDateRange = fetchUsersByDateRange;



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

    console.log("Uploaded files:", req.files);

    // Extract file URLs safely, only if they exist
    const studentIdCard = req.files?.studentIdCard?.[0]?.location;
    const governmentIdProof = req.files?.governmentIdProof?.[0]?.location;
    const passportPhoto = req.files?.passportPhoto?.[0]?.location;

    // Check if at least one file is uploaded
    if (!studentIdCard && !governmentIdProof && !passportPhoto) {
      return ReE(res, "At least one document must be uploaded", 400);
    }

    // Prepare update object dynamically
    const updateData = {};
    if (studentIdCard) updateData.studentIdCard = studentIdCard;
    if (governmentIdProof) updateData.governmentIdProof = governmentIdProof;
    if (passportPhoto) updateData.passportPhoto = passportPhoto;

    // Save to DB
    await user.update(updateData);

    return ReS(
      res,
      {
        success: true,
        message: "Verification docs uploaded successfully",
        data: updateData,
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

var updatePersonalInfo = async function (req, res) {
    try {
        const {
            userId,
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

        if (!userId) {
            return ReE(res, "User ID is required", 400);
        }

        // Find user
        const user = await model.User.findByPk(userId);
        if (!user) {
            return ReE(res, "User not found", 404);
        }

        // Update fields
        await user.update({
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

        return ReS(res, { success: true, message: "User info updated successfully" }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.updatePersonalInfo = updatePersonalInfo;



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

// ===================== LOGIN =====================
// ===================== LOGIN =====================
const loginWithEmailPassword = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) return ReE(res, "Missing email or password", 400);

        let account = await model.User.findOne({ where: { email, isDeleted: false } });
        let role = "user";

        if (!account) {
            account = await model.TeamManager.findOne({ where: { email, isDeleted: false } });
            role = "manager";
        }

        if (!account) return ReE(res, "Invalid credentials", 401);

        const isMatch = await bcrypt.compare(password, account.password);
        if (!isMatch) return ReE(res, "Invalid credentials", 401);

        const isFirstLogin = !account.hasLoggedIn;
        if (isFirstLogin) await account.update({ hasLoggedIn: true });
        await account.update({ lastLoginAt: new Date() });

        let payload;
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
                internshipStatus: account.internshipStatus || null   // ✅ Added here
            };
        } else {
            payload = {
                managerId: account.managerId,
                name: account.name,
                email: account.email,
                mobileNumber: account.mobileNumber,
                department: account.department,
                position: account.position,
                internshipStatus: account.internshipStatus || null   // ✅ Added here
            };
        }

        const token = jwt.sign({ ...payload, role }, CONFIG.jwtSecret, { expiresIn: "365d" });

        return ReS(res, {
            success: true,
            account: {
                ...payload,
                isFirstLogin,
                token,
                role
            }
        }, 200);

    } catch (error) {
        console.error("Login Error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.loginWithEmailPassword = loginWithEmailPassword;
// ===================== LOGOUT =====================
const logoutUser = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return ReE(res, "Missing id", 400);

        let account = await model.User.findOne({ where: { id, isDeleted: false } });
        let role = "user";

        if (!account) {
            account = await model.TeamManager.findOne({ where: { managerId: id, isDeleted: false } });
            role = "manager";
        }

        if (!account) return ReE(res, "Account not found", 404);

        await account.update({ lastLogoutAt: new Date() });

        return ReS(res, { success: true, message: `${role} logged out successfully` }, 200);

    } catch (error) {
        console.error("Logout Error:", error);
        return ReE(res, error.message, 500);
    }
};
module.exports.logoutUser = logoutUser;

// ===================== REQUEST PASSWORD RESET =====================
const requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return ReE(res, "Email is required", 400);

        let account = await model.User.findOne({ where: { email, isDeleted: false } });
        let role = "user";

        if (!account) {
            account = await model.TeamManager.findOne({ where: { email, isDeleted: false } });
            role = "manager";
        }

        if (!account) return ReS(res, { message: "If the email is registered, a reset link has been sent." }, 200);

        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenExpiry = Date.now() + 3600000;

        await account.update({ resetToken, resetTokenExpiry });

        const queryParams = new URLSearchParams({ token: resetToken, email }).toString();
        const resetUrl = `https://eduroom.in/reset-password?${queryParams}`;

        const htmlContent = `
          <h3>Hello ${account.name || account.firstName},</h3>
          <p>You requested a password reset for your EduRoom account.</p>
          <p>Click the link below to reset your password (valid for 1 hour):</p>
          <p><a href="${resetUrl}" target="_blank" style="color:#007bff; text-decoration:underline;">Reset Password</a></p>
          <br>
          <p>If you didn’t request this, you can safely ignore this email.</p>
          <p>– The EduRoom Team</p>
        `;

        const mailResult = await sendMail(email, "EduRoom - Password Reset Request", htmlContent);
        if (!mailResult.success) return ReE(res, "Failed to send reset email", 500);

        return ReS(res, { message: "If the email is registered, a reset link has been sent." }, 200);

    } catch (error) {
        console.error("Password reset error:", error);
        return ReE(res, error.message, 500);
    }
};
module.exports.requestPasswordReset = requestPasswordReset;

// ===================== RESET PASSWORD =====================
const resetPassword = async (req, res) => {
    try {
        const { email, token, newPassword } = req.body;
        if (!email || !token || !newPassword) return ReE(res, "All fields are required", 400);

        let account = await model.User.findOne({
            where: {
                email,
                resetToken: token,
                resetTokenExpiry: { [Op.gt]: Date.now() },
                isDeleted: false,
            }
        });
        let role = "user";

        if (!account) {
            account = await model.TeamManager.findOne({
                where: {
                    email,
                    resetToken: token,
                    resetTokenExpiry: { [Op.gt]: Date.now() },
                    isDeleted: false,
                }
            });
            role = "manager";
        }

        if (!account) return ReE(res, "Invalid or expired reset token", 400);

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await account.update({ password: hashedPassword, resetToken: null, resetTokenExpiry: null });

        return ReS(res, { message: "Password has been reset successfully" }, 200);

    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.resetPassword = resetPassword;

// ===================== GOOGLE LOGIN =====================
const loginWithGoogle = async (req, res) => {
    try {
        const firebaseUser = req.user;

        let account = await model.User.findOne({ where: { email: firebaseUser.email, isDeleted: false } });
        let role = "user";

        if (!account) {
            account = await model.TeamManager.findOne({ where: { email: firebaseUser.email, isDeleted: false } });
            role = "manager";
        }

        if (!account) return ReE(res, "Account not found. Please register first.", 404);

        let isFirstLogin = !account.hasLoggedIn;
        if (isFirstLogin) await account.update({ hasLoggedIn: true });

        const payload = {
            user_id: account.id || null,
            managerId: account.managerId || null,
            firstName: account.firstName || null,
            lastName: account.lastName || null,
            fullName: account.fullName || account.name || `${account.firstName || ""} ${account.lastName || ""}`,
            dateOfBirth: account.dateOfBirth || null,
            gender: account.gender || null,
            phoneNumber: account.phoneNumber || account.mobileNumber || null,
            alternatePhoneNumber: account.alternatePhoneNumber || null,
            email: account.email,
            residentialAddress: account.residentialAddress || null,
            emergencyContactName: account.emergencyContactName || null,
            emergencyContactNumber: account.emergencyContactNumber || null,
            city: account.city || null,
            state: account.state || null,
            pinCode: account.pinCode || null,
            internshipStatus: account.internshipStatus || null   // ✅ Added here
        };

        const token = jwt.sign({ ...payload, role }, CONFIG.jwtSecret, { expiresIn: "365d" });

        return ReS(res, { success: true, user: { ...payload, isFirstLogin, token, role } });

    } catch (error) {
        console.error("Google login failed:", error);
        return ReE(res, "Login failed", 500);
    }
};
module.exports.loginWithGoogle = loginWithGoogle;

//  Fetch Single User Info by ID with profile completion and filtered fields
const fetchSingleUserById = async (req, res) => {
    try {
        const { id } = req.params; // get ID from URL

        if (!id) {
            return ReE(res, "Missing user ID", 400);
        }

        const user = await model.User.findOne({
            where: { id, isDeleted: false },
            include: [
                {
                    model: model.TeamManager,
                    as: "teamManager",
                    attributes: ["id", "managerId", "name", "email", "mobileNumber", "department", "position", "internshipStatus"]
                }
            ]
        });

        if (!user) {
            return ReE(res, "User not found", 404);
        }

        const userData = user.get({ plain: true });

        //  Calculate profile completion
        const fields = [
            "firstName", "lastName", "fullName", "dateOfBirth", "gender",
            "phoneNumber", "alternatePhoneNumber", "email", "residentialAddress",
            "emergencyContactName", "emergencyContactNumber", "city", "state", "pinCode",
            "collegeName", "collegeRollNumber", "course", "specialization", "currentYear",
            "currentSemester", "collegeAddress", "placementCoordinatorName",
            "placementCoordinatorContact", "internshipProgram", "internshipDuration",
            "internshipModeId", "preferredStartDate", "referralCode", "referralLink",
            "referralSource", "studentIdCard", "governmentIdProof", "passportPhoto",
            "accountHolderName", "bankName", "branchAddress", "ifscCode", "accountNumber",
            "preferredCommunicationId", "linkedInProfile", "studentDeclaration", "consentAgreement","internshipStatus"
        ];

        let filled = 0;
        fields.forEach(f => {
            if (userData[f] !== null && userData[f] !== "" && userData[f] !== false) filled++;
        });

        const profileCompletion = Math.round((filled / fields.length) * 100);

        //  Calculate total subscriptions
        const totalSubscriptions = userData.businessTargets
            ? Object.keys(userData.businessTargets).length
            : 0;

        //  Prepare filtered response
        const filteredData = {
            Name: userData.fullName || `${userData.firstName} ${userData.lastName}`,
            Email: userData.email,
            PhoneNumber: userData.phoneNumber,
            CollegeName: userData.collegeName,
            ReferralCode: userData.referralCode,
            ReferralLink: userData.referralLink,
            ProfileCompletion: profileCompletion,
            TotalSubscriptions: totalSubscriptions,
            InternshipStatus: userData.internshipStatus || null,
            TeamManager: userData.teamManager || null
        };

        return ReS(res, { success: true, data: filteredData }, 200);

    } catch (error) {
        console.error("Fetch user error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.fetchSingleUserById = fetchSingleUserById;

//  Fetch All Users with full data + profile completion + subscriptions
const fetchAllUsers = async (req, res) => {
    try {
        const users = await model.User.findAll({
            where: { isDeleted: false }, // exclude deleted ones
        });

        if (!users || users.length === 0) {
            return ReE(res, "No users found", 404);
        }

        const fields = [
            "firstName", "lastName", "fullName", "dateOfBirth", "gender",
            "phoneNumber", "alternatePhoneNumber", "email", "residentialAddress",
            "emergencyContactName", "emergencyContactNumber", "city", "state", "pinCode",
            "collegeName", "collegeRollNumber", "course", "specialization", "currentYear",
            "currentSemester", "collegeAddress", "placementCoordinatorName",
            "placementCoordinatorContact", "internshipProgram", "internshipDuration",
            "internshipModeId", "preferredStartDate", "referralCode", "referralLink",
            "referralSource", "studentIdCard", "governmentIdProof", "passportPhoto",
            "accountHolderName", "bankName", "branchAddress", "ifscCode", "accountNumber",
            "preferredCommunicationId", "linkedInProfile", "studentDeclaration", "consentAgreement","internshipStatus"
        ];

        const formattedUsers = users.map(user => {
            const userData = user.get({ plain: true });

            // Profile completion
            let filled = 0;
            fields.forEach(f => {
                if (userData[f] !== null && userData[f] !== "" && userData[f] !== false) filled++;
            });
            const profileCompletion = Math.round((filled / fields.length) * 100);

            //  Total subscriptions
            const totalSubscriptions = userData.businessTargets
                ? Object.keys(userData.businessTargets).length
                : 0;

            //  Return all user fields + extra fields
            return {
                ...userData,
                ProfileCompletion: profileCompletion,
                TotalSubscriptions: totalSubscriptions
            };
        });

        return ReS(res, { 
            success: true, 
            totalUsers: formattedUsers.length,
            data: formattedUsers 
        }, 200);

    } catch (error) {
        console.error("Fetch all users error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.fetchAllUsers = fetchAllUsers;

const getReferralPaymentStatus = async (req, res) => {
  try {
    let { userId } = req.params;
    userId = parseInt(userId, 10);
    if (isNaN(userId)) return ReE(res, "Invalid userId", 400);

    const user = await model.User.findByPk(userId);
    if (!user) return ReE(res, "User not found", 404);
    if (!user.referralCode) {
      return ReS(res, { success: true, message: "User has no referral code", data: null }, 200);
    }

    // Call external Lambda
    const apiUrl = `https://lc8j8r2xza.execute-api.ap-south-1.amazonaws.com/prod/auth/getReferralPaymentStatus?referral_code=${user.referralCode}`;
    const apiResponse = await axios.get(apiUrl);
    let modifiedData = { ...apiResponse.data };

    const regUsers = Array.isArray(modifiedData.registered_users)
      ? modifiedData.registered_users.map(u => ({ ...u }))
      : [];

    if (regUsers.length === 0) {
      modifiedData.registered_users = [];
      return ReS(res, { success: true, data: modifiedData }, 200);
    }

    // Helper: pick a sensible external id field from the registered user object
    const pickExternalId = (u) => u.user_id ?? u.id ?? u.uid ?? u.userId ?? u.externalId ?? null;

    // 1) Split numeric (likely local DB id) vs external (string) ids
    const numericIndexToLocalId = new Map();
    const externalValues = new Set();

    regUsers.forEach((u, idx) => {
      const ext = pickExternalId(u);
      if (!ext) return;

      const sExt = String(ext);
      if (/^\d+$/.test(sExt)) {
        numericIndexToLocalId.set(idx, parseInt(sExt, 10));
      } else {
        externalValues.add(sExt);
      }
    });

    // 2) Try to resolve external ids to local User.id
    const externalList = [...externalValues];
    const localIdByExternal = {};

    if (externalList.length > 0) {
      const candidateUserCols = ['firebaseUid', 'externalId', 'authId', 'uuid', 'uid', 'userUid'];
      const userAttrs = Object.keys(model.User.rawAttributes || {});
      const availableUserCols = candidateUserCols.filter(c => userAttrs.includes(c));

      if (availableUserCols.length > 0) {
        const userWhere = { [Op.or]: availableUserCols.map(col => ({ [col]: { [Op.in]: externalList } })) };

        const foundUsers = await model.User.findAll({
          where: userWhere,
          attributes: ['id', ...availableUserCols],
          raw: true,
        });

        for (const fu of foundUsers) {
          for (const col of availableUserCols) {
            const val = fu[col];
            if (val && externalValues.has(String(val))) {
              localIdByExternal[String(val)] = fu.id;
            }
          }
        }
      }
    }

    // 3) Build candidate IDs for RaiseQuery search
    const candidateLocalIds = new Set();
    for (const lid of numericIndexToLocalId.values()) candidateLocalIds.add(lid);
    for (const lid of Object.values(localIdByExternal)) candidateLocalIds.add(lid);

    const candidateExternalIds = externalList; // external IDs to match against fundsAuditUserId

    let raiseQueries = [];
    if (candidateLocalIds.size > 0 || candidateExternalIds.length > 0) {
      const rqAttrs = Object.keys(model.RaiseQuery.rawAttributes || {});

      const whereClause = { [Op.or]: [] };

      if (rqAttrs.includes("userId") && candidateLocalIds.size > 0) {
        whereClause[Op.or].push({ userId: { [Op.in]: [...candidateLocalIds] } });
      }

      if (rqAttrs.includes("fundsAuditUserId") && candidateExternalIds.length > 0) {
        whereClause[Op.or].push({ fundsAuditUserId: { [Op.in]: candidateExternalIds } });
      }

      raiseQueries = await model.RaiseQuery.findAll({
        where: whereClause,
        attributes: ["id", "queryStatus", "isQueryRaised", "createdAt", "userId", "fundsAuditUserId"],
        order: [["createdAt", "DESC"]],
        raw: true,
      });
    }

    // 4) Attach RaiseQuery info to registered users
    const updatedRegisteredUsers = regUsers.map((u, idx) => {
      const cloned = { ...u, isDownloaded: true };

      const localId = numericIndexToLocalId.get(idx) || localIdByExternal[String(pickExternalId(u))] || null;
      const extId = pickExternalId(u);

      let rq = null;
      if (localId != null) {
        rq = raiseQueries.find(r => String(r.userId) === String(localId));
      }
      if (!rq && extId) {
        rq = raiseQueries.find(r => String(r.fundsAuditUserId) === String(extId));
      }

      cloned.queryStatus = rq ? rq.queryStatus : null;
      cloned.isQueryRaised = rq ? rq.isQueryRaised : false;

      return cloned;
    });

    modifiedData.registered_users = updatedRegisteredUsers;

    return ReS(res, { success: true, data: modifiedData }, 200);
  } catch (error) {
    console.error("Get Referral Payment Status Error:", error);
    return ReE(res, error.message || "Internal error", 500);
  }
};

module.exports.getReferralPaymentStatus = getReferralPaymentStatus;

// ✅ Get internship status summary per managerId (userId of manager)
const getInternshipStatusByUser = async (req, res) => {
  try {
    let { userId } = req.params;
    userId = parseInt(userId, 10);

    if (isNaN(userId)) return ReE(res, "Invalid userId", 400);

    // Check if manager exists
    const manager = await model.TeamManager.findOne({ where: { managerId: userId, isDeleted: false } });
    if (!manager) return ReE(res, "Manager not found", 404);

    // Fetch interns under this manager
    const interns = await model.User.findAll({
      where: { managerId: userId, isDeleted: false },
      attributes: ["id", "firstName", "lastName", "internshipStatus"]
    });

    // Count by status
    let completed = 0, onHold = 0, inProgress = 0;

    interns.forEach(intern => {
      switch ((intern.internshipStatus || "").toLowerCase()) {
        case "completed":
          completed++;
          break;
        case "on-hold":
        case "hold":
          onHold++;
          break;
        case "in-progress":
        case "progress":
          inProgress++;
          break;
      }
    });

    return ReS(res, {
      success: true,
      managerId: userId,
      data: {
        totalInterns: interns.length,
        completed,
        onHold,
        inProgress
      }
    }, 200);

  } catch (error) {
    console.error("Get Internship Status By User Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getInternshipStatusByUser = getInternshipStatusByUser;
