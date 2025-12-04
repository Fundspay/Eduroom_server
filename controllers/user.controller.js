"use strict";
const model = require("../models/index");
const bcrypt = require("bcrypt");
const { ReE, ReS } = require("../utils/util.service.js");
const { sendMail } = require("../middleware/mailer.middleware");
const crypto = require("crypto");
const { Op } = require("sequelize");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const CONFIG = require("../config/config.js");
const axios = require("axios");
const moment = require("moment");
const { FundsAudit } = require("../models");
const { User } = require("../models");



if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      require("../config/firebase-service-account.json")
    ),
  });
}

// ✅  STEP 1: Create Student Personal Information

const addPersonalInfo = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      password,
      fullName,
      dateOfBirth,
      gender,
      alternatePhoneNumber,
      residentialAddress,
      emergencyContactName,
      emergencyContactNumber,
      city,
      state,
      pinCode,
      collegeName
    } = req.body;

    // Required fields validation
    if (!firstName || !lastName || !email || !phoneNumber || !password) {
      return ReE(
        res,
        "Required fields missing: firstName, lastName, email, phoneNumber, password",
        400
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phoneNumber.trim();

    // Check if email already exists
    const existingEmail = await model.User.findOne({
      where: { email: normalizedEmail, isDeleted: false },
    });
    if (existingEmail)
      return ReE(res, "User with this email already exists", 409);

    // Check if phone number already exists
    const existingPhone = await model.User.findOne({
      where: { phoneNumber: normalizedPhone, isDeleted: false },
    });
    if (existingPhone)
      return ReE(res, "User with this phone number already exists", 409);

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await model.User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      password: hashedPassword,
      fullName: fullName ? fullName.trim() : null,
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      alternatePhoneNumber: alternatePhoneNumber
        ? alternatePhoneNumber.trim()
        : null,
      residentialAddress: residentialAddress ? residentialAddress.trim() : null,
      emergencyContactName: emergencyContactName
        ? emergencyContactName.trim()
        : null,
      emergencyContactNumber: emergencyContactNumber
        ? emergencyContactNumber.trim()
        : null,
      city: city ? city.trim() : null,
      state: state ? state.trim() : null,
      pinCode: pinCode ? pinCode.trim() : null,
      collegeName: collegeName ? collegeName.trim() : null
    });

    // ✅ Send welcome email after registration
    const emailSubject = "Welcome to EduRoom!";
    const emailBody = `
  <p>Dear ${firstName} ${lastName},</p>

  <p>Thank you for registering with <strong>Eduroom – India’s hands-on internship platform!</strong> 🎉</p>

  <p>
    You are now one step closer to gaining real-world exposure through structured learning, 
    case studies, live projects, and business tasks.
  </p>

  <h3>What’s Next?</h3>
  <ul>
    <li>✅ You’ll receive your internship domain details & schedule shortly</li>
    <li>✅ Get access to learning sessions, quizzes & assignments</li>
    <li>✅ Work on live tasks and build your portfolio</li>
    <li>✅ Earn your Internship Certificate (and unlock extended internship + placement opportunities)</li>
  </ul>

  <p>
    We’re excited to have you onboard and can’t wait to see you grow with Eduroom! 🌟
  </p>

  <p>
    For queries, feel free to reach us at 
    <a href="mailto:recruitment@eduroom.in">recruitment@eduroom.in</a>
  </p>
`;

const mailResult = await sendMail(normalizedEmail, emailSubject, emailBody);


    if (!mailResult.success) {
      console.error("Failed to send welcome email:", mailResult.error);
      // Optional: you can still return success for registration even if email fails
    }

    return ReS(res, { success: true, userId: user.id }, 201);
  } catch (error) {
    console.error("Add Personal Info Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.addPersonalInfo = addPersonalInfo;

// Fetch users created within a date range (DD-MM-YYYY)
const fetchUsersByDateRange = async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to)
      return ReE(res, "Both 'from' and 'to' dates are required", 400);

    // Parse dates using DD-MM-YYYY
    const fromDate = moment(from, "DD-MM-YYYY").startOf("day").toDate();
    const toDate = moment(to, "DD-MM-YYYY").endOf("day").toDate();

    if (!fromDate || !toDate)
      return ReE(res, "Invalid date format. Use DD-MM-YYYY", 400);

    // Fetch users within range
    const users = await model.User.findAll({
      where: {
        isDeleted: false,
        createdAt: {
          [Op.between]: [fromDate, toDate],
        },
      },
      include: [
        {
          model: model.Gender,
          attributes: { exclude: ["createdAt", "updatedAt"] },
        },
      ],
    });

    return ReS(
      res,
      {
        success: true,
        count: users.length,
        users: users.map((u) => u.get({ plain: true })),
      },
      200
    );
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

    return ReS(
      res,
      { success: true, message: "Educational details updated" },
      200
    );
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};
module.exports.addEducationalDetails = addEducationalDetails;

var addInternshipDetails = async function (req, res) {
  try {
    const { userId } = req.params;
    if (!userId || isNaN(userId)) {
      return ReE(res, "Valid user ID is required", 400);
    }

    const {
      internshipProgram,
      internshipDuration,
      internshipModeId, // mandatory
      preferredStartDate,
      referralCode,
      referralLink,
      referralSource,
    } = req.body;

    //  Required validation: only internshipModeId
    if (!internshipModeId) {
      return ReE(res, "internshipModeId is required", 400);
    }

    const user = await model.User.findByPk(userId);
    if (!user) return ReE(res, "User not found", 404);

    await user.update({
      internshipProgram: internshipProgram || null,
      internshipDuration: internshipDuration || null,
      internshipModeId, // required, no null fallback
      preferredStartDate: preferredStartDate || null,
      referralCode: referralCode || null,
      referralLink: referralLink || null,
      referralSource: referralSource || null,
    });

    return ReS(
      res,
      { success: true, message: "Internship details updated" },
      200
    );
  } catch (error) {
    console.error("Error updating internship details:", error);
    return ReE(res, error.message || "Server error", 500);
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

    // Log received files for debugging
    console.log("Received req.files:", req.files);

    // Ensure req.files exists
    if (!req.files || Object.keys(req.files).length === 0) {
      return ReE(
        res,
        "No files uploaded. Make sure you are sending multipart/form-data with correct field names.",
        400
      );
    }

    // Safely extract file URLs if present
    const studentIdCard = req.files?.studentIdCard?.[0]?.location || null;
    const governmentIdProof =
      req.files?.governmentIdProof?.[0]?.location || null;
    const passportPhoto = req.files?.passportPhoto?.[0]?.location || null;

    // Check if at least one file is uploaded
    if (!studentIdCard && !governmentIdProof && !passportPhoto) {
      return ReE(res, "At least one document must be uploaded", 400);
    }

    // Build update object dynamically
    const updateData = {};
    if (studentIdCard) updateData.studentIdCard = studentIdCard;
    if (governmentIdProof) updateData.governmentIdProof = governmentIdProof;
    if (passportPhoto) updateData.passportPhoto = passportPhoto;

    // Save to DB
    await user.update(updateData);

    // Reload user to get latest info
    await user.reload();

    return ReS(
      res,
      {
        success: true,
        message: "Verification documents uploaded successfully",
        data: updateData,
        user,
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

const addBankDetails = async (req, res) => {
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

    // Build update object dynamically; allow null values
    const updateData = {};
    if (accountHolderName !== undefined)
      updateData.accountHolderName = accountHolderName;
    if (bankName !== undefined) updateData.bankName = bankName;
    if (branchAddress !== undefined) updateData.branchAddress = branchAddress;
    if (ifscCode !== undefined) updateData.ifscCode = ifscCode;
    if (accountNumber !== undefined) updateData.accountNumber = accountNumber;

    if (Object.keys(updateData).length === 0) {
      return ReE(res, "No bank details provided to update", 400);
    }

    // Optional: lightweight validation (does not make fields mandatory)
    if (accountNumber !== undefined && accountNumber !== null) {
      if (!/^\d{9,18}$/.test(accountNumber)) {
        return ReE(res, "Account number must be numeric and 9-18 digits", 400);
      }
    }
    if (ifscCode !== undefined && ifscCode !== null) {
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
        return ReE(res, "Invalid IFSC code format", 400);
      }
    }

    // Update user
    await user.update(updateData);
    await user.reload();

    return ReS(
      res,
      {
        success: true,
        message: "Bank details updated successfully",
        user,
      },
      200
    );
  } catch (error) {
    console.error("addBankDetails error:", error);
    return ReE(res, error.message || "Internal Server Error", 500);
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

    return ReS(
      res,
      { success: true, message: "Communication preferences updated" },
      200
    );
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
    const userId = req.params.id; // from URL
    const updateFields = req.body; // all other fields

    if (!userId) return ReE(res, "User ID is required", 400);

    const user = await model.User.findByPk(userId);
    if (!user) return ReE(res, "User not found", 404);

    // Remove undefined fields to avoid validation errors
    Object.keys(updateFields).forEach(
      key => updateFields[key] === undefined && delete updateFields[key]
    );

    await user.update(updateFields);

    return ReS(res, { success: true, message: "User info updated successfully" }, 200);
  } catch (error) {
    console.error("Update Personal Info Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.updatePersonalInfo = updatePersonalInfo;

// ✅ Fetch Single User
var fetchSingleUser = async (req, res) => {
  try {
    const user = await model.User.findByPk(req.params.id, {
      include: [
        {
          model: model.Gender,
          attributes: { exclude: ["createdAt", "updatedAt"] },
        },
      ],
    });

    if (!user || user.isDeleted) return ReE(res, "User not found", 404);

    return ReS(res, { success: true, user: user.get({ plain: true }) }, 200);
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};
module.exports.fetchSingleUser = fetchSingleUser;

// ✅ Update User
const updateUser = async (req, res) => {
  try {
    const user = await model.User.findByPk(req.params.id);
    if (!user || user.isDeleted) return ReE(res, "User not found", 404);

    const allowedFields = [
      "firstName",
      "lastName",
      "phoneNumber",
      "gender",
      "email",
      "collegeName",
      "course",
      "state",
      "city",
      "referralCode",
      "referralLink",
    ];

    const updatedFields = {};

    for (const field of allowedFields) {
      if (req.body.hasOwnProperty(field)) {
        updatedFields[field] = req.body[field];
      }
    }

    // Validate gender only if it's actually sent
    if (updatedFields.gender !== undefined && updatedFields.gender !== null && updatedFields.gender !== "") {
      const genderExists = await model.Gender.findByPk(updatedFields.gender);
      if (!genderExists) return ReE(res, "Invalid gender", 400);
    }

    // If no fields provided, return
    if (Object.keys(updatedFields).length === 0) {
      return ReE(res, "No fields to update", 400);
    }

    await user.update(updatedFields);
    await user.reload();

    return ReS(res, { success: true, user }, 200);
  } catch (error) {
    console.error("updateUser error:", error);
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
    return ReS(
      res,
      { success: true, message: "User deleted successfully" },
      200
    );
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};
module.exports.deleteUser = deleteUser;

// ===================== LOGIN =====================
const loginWithEmailPassword = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return ReE(res, "Missing email or password", 400);

    let account = await model.User.findOne({
      where: { email, isDeleted: false },
      include: [
        {
          model: model.TeamManager,
          as: "teamManager",
          attributes: ["id", "name", "email", "mobileNumber", "internshipStatus"],
        },
      ],
    });

    let role = "user";
    let manager = null;

    if (!account) {
      manager = await model.TeamManager.findOne({
        where: { email, isDeleted: false },
      });
      role = "manager";
    }

    if (!account && !manager) return ReE(res, "Invalid credentials", 401);

    const activeAccount = account || manager;
    const isMatch = await bcrypt.compare(password, activeAccount.password);
    if (!isMatch) return ReE(res, "Invalid credentials", 401);

    const isFirstLogin = !activeAccount.hasLoggedIn;
    if (isFirstLogin) await activeAccount.update({ hasLoggedIn: true });
    await activeAccount.update({ lastLoginAt: new Date() });

    let payload = {};
    if (role === "user") {
      payload = {
        user_id: activeAccount.id,
        firstName: activeAccount.firstName,
        lastName: activeAccount.lastName,
        email: activeAccount.email,
        phoneNumber: activeAccount.phoneNumber,
        internshipStatus: activeAccount.internshipStatus || null,
        selected: activeAccount.selected || null,
      };

      if (activeAccount.teamManager) {
        payload.managerDetails = {
          managerId: activeAccount.teamManager.id,
          name: activeAccount.teamManager.name,
          email: activeAccount.teamManager.email,
          mobileNumber: activeAccount.teamManager.mobileNumber,
          internshipStatus: activeAccount.teamManager.internshipStatus,
        };
      }
    } else {
      payload = {
        managerId: activeAccount.id,
        name: activeAccount.name,
        email: activeAccount.email,
        mobileNumber: activeAccount.mobileNumber,
        department: activeAccount.department,
        position: activeAccount.position,
        internshipStatus: activeAccount.internshipStatus || null,
      };
    }

    const token = jwt.sign({ ...payload, role }, CONFIG.jwtSecret, { expiresIn: "365d" });

    // ✅ dynamic key based on role
    const responseKey = role === "user" ? "user" : "account";

    return ReS(
      res,
      {
        success: true,
        [responseKey]: {
          ...payload,
          isFirstLogin,
          token,
          role,
        },
      },
      200
    );
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

    // Only check if id exists (NO number conversion now)
    if (!id) {
      return ReE(res, "Invalid or missing id", 400);
    }

    const numericId = id; // KEEP AS STRING

    // 🔹 Try USER table
    let account = await model.User.findOne({ 
      where: { id: numericId, isDeleted: false } 
    });

    let role = "user";

    // 🔹 If not found → Try TEAM MANAGER table
    if (!account) {
      account = await model.TeamManager.findOne({
        where: { id: numericId, isDeleted: false }, // FIXED HERE
      });
      role = "manager";
    }

    // 🔹 If still not found
    if (!account) return ReE(res, "Account not found", 404);

    await account.update({ lastLogoutAt: new Date() });

    return ReS(
      res,
      { success: true, message: `${role} logged out successfully` },
      200
    );
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

    // Check if the email exists in User table
    const user = await model.User.findOne({
      where: { email, isDeleted: false },
    });

    // If not found, respond with not registered message
    if (!user) {
      return ReE(res, "Email is not registered with EduRoom", 404);
    }

    // Generate reset token and expiry
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000;

    await user.update({ resetToken, resetTokenExpiry });

    const queryParams = new URLSearchParams({ token: resetToken, email }).toString();
    const resetUrl = `https://eduroom.in/reset-password.html?${queryParams}`;

    const htmlContent = `
      <h3>Hello ${user.name || user.firstName},</h3>
      <p>You requested a password reset for your EduRoom account.</p>
      <p>Click the link below to reset your password (valid for 1 hour):</p>
      <p><a href="${resetUrl}" target="_blank" style="color:#007bff; text-decoration:underline;">Reset Password</a></p>
      <br>
      <p>If you didn’t request this, you can safely ignore this email.</p>
      <p>– The EduRoom Team</p>
    `;

    const mailResult = await sendMail(
      email,
      "EduRoom - Password Reset Request",
      htmlContent
    );

    if (!mailResult.success) return ReE(res, "Failed to send reset email", 500);

    return ReS(res, { message: "Reset link sent to your email." }, 200);
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
    if (!email || !token || !newPassword)
      return ReE(res, "All fields are required", 400);

    let account = await model.User.findOne({
      where: {
        email,
        resetToken: token,
        resetTokenExpiry: { [Op.gt]: Date.now() },
        isDeleted: false,
      },
    });
    let role = "user";

    if (!account) {
      account = await model.TeamManager.findOne({
        where: {
          email,
          resetToken: token,
          resetTokenExpiry: { [Op.gt]: Date.now() },
          isDeleted: false,
        },
      });
      role = "manager";
    }

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

// ===================== GOOGLE LOGIN =====================
const loginWithGoogle = async (req, res) => {
  try {
    const firebaseUser = req.user;

    let account = await model.User.findOne({
      where: { email: firebaseUser.email, isDeleted: false },
      include: [
        {
          model: model.TeamManager,
          as: "teamManager",
          attributes: ["id", "name", "email", "mobileNumber", "internshipStatus"],
        },
      ],
    });

    let role = "user";
    let manager = null;

    // 🔹 If not found in User table, check TeamManager
    if (!account) {
      manager = await model.TeamManager.findOne({
        where: { email: firebaseUser.email, isDeleted: false },
      });
      role = "manager";
    }

    if (!account && !manager)
      return ReE(res, "Account not found. Please register first.", 404);

    // 🔹 Pick the correct account info depending on role
    const activeAccount = account || manager;

    let isFirstLogin = !activeAccount.hasLoggedIn;
    if (isFirstLogin) await activeAccount.update({ hasLoggedIn: true });

    // 🔹 Basic payload
    const payload = {
      user_id: activeAccount.id || null,
      managerId: activeAccount.managerId || null,
      firstName: activeAccount.firstName || null,
      lastName: activeAccount.lastName || null,
      fullName:
        activeAccount.fullName ||
        activeAccount.name ||
        `${activeAccount.firstName || ""} ${activeAccount.lastName || ""}`,
      dateOfBirth: activeAccount.dateOfBirth || null,
      gender: activeAccount.gender || null,
      phoneNumber: activeAccount.phoneNumber || activeAccount.mobileNumber || null,
      email: activeAccount.email,
      city: activeAccount.city || null,
      state: activeAccount.state || null,
      pinCode: activeAccount.pinCode || null,
      internshipStatus: activeAccount.internshipStatus || null,
      selected: activeAccount.selected || null,
    };

    // 🔹 Add manager details if the role is "user"
    if (role === "user" && account && account.teamManager) {
      payload.managerDetails = {
        id: account.teamManager.id,
        name: account.teamManager.name,
        email: account.teamManager.email,
        mobileNumber: account.teamManager.mobileNumber,
        internshipStatus: account.teamManager.internshipStatus,
      };
    }

    const token = jwt.sign({ ...payload, role }, CONFIG.jwtSecret, {
      expiresIn: "365d",
    });

    return ReS(res, {
      success: true,
      user: { ...payload, isFirstLogin, token, role },
    });
  } catch (error) {
    console.error("Google login failed:", error);
    return ReE(res, "Login failed", 500);
  }
};

module.exports.loginWithGoogle = loginWithGoogle;

//  Fetch Single User Info by ID with profile completion and filtered fields
const fetchSingleUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Validate ID to prevent crashes
    if (!id || id === "null") {
      return ReE(res, "Invalid or missing user ID", 400);
    }

    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      return ReE(res, "user ID must be a valid number", 400);
    }

    const user = await model.User.findOne({
      where: { id: parsedId, isDeleted: false },
      include: [
        {
          model: model.TeamManager,
          as: "teamManager",
          attributes: [
            "id",
            "managerId",
            "name",
            "email",
            "mobileNumber",
            "department",
            "position",
            "internshipStatus",
          ],
        },
      ],
    });

    if (!user) return ReE(res, "User not found", 404);

    const userData = user.get({ plain: true });

    // Fetch Status record
    const statusRecord = await model.Status.findOne({
      where: { userId: user.id },
    });

    // Determine final team manager
    let finalTeamManager = null;

    if (statusRecord && statusRecord.teamManager) {
      // Status team manager exists → fetch email & phone from TeamManager table
      const tmFromStatus = await model.TeamManager.findOne({
        where: { name: statusRecord.teamManager },
      });
      if (tmFromStatus) {
        finalTeamManager = {
          name: tmFromStatus.name,
          email: tmFromStatus.email,
          phoneNumber: tmFromStatus.mobileNumber,
        };
      } else {
        finalTeamManager = { name: statusRecord.teamManager, email: null, phoneNumber: null };
      }
    } else if (userData.teamManager) {
      // Fallback to user's current team manager
      finalTeamManager = {
        name: userData.teamManager.name,
        email: userData.teamManager.email,
        phoneNumber: userData.teamManager.mobileNumber,
      };
    }

    // Calculate profile completion
    const fields = [
      "firstName","lastName","fullName","dateOfBirth","gender","phoneNumber","alternatePhoneNumber",
      "email","residentialAddress","emergencyContactName","emergencyContactNumber","city","state",
      "pinCode","collegeName","collegeRollNumber","course","specialization","currentYear","currentSemester",
      "collegeAddress","placementCoordinatorName","placementCoordinatorContact","internshipProgram",
      "internshipDuration","internshipModeId","preferredStartDate","referralCode","referralLink",
      "referralSource","studentIdCard","governmentIdProof","passportPhoto","accountHolderName","bankName",
      "branchAddress","ifscCode","accountNumber","preferredCommunicationId","linkedInProfile",
      "studentDeclaration","consentAgreement","internshipStatus"
    ];

    let filled = 0;
    fields.forEach((f) => {
      if (userData[f] !== null && userData[f] !== "" && userData[f] !== false) filled++;
    });
    const profileCompletion = Math.round((filled / fields.length) * 100);

    // Total subscriptions
    const totalSubscriptions = userData.businessTargets ? Object.keys(userData.businessTargets).length : 0;

    // Referral API logic
    let referralCode = userData.referralCode || null;
    let referralLink = userData.referralLink || null;
    try {
      let phoneNumber = userData.phoneNumber;
      if (!phoneNumber.startsWith("+91")) phoneNumber = `+91${phoneNumber}`;

      const referralRes = await axios.get(
        "https://lc8j8r2xza.execute-api.ap-south-1.amazonaws.com/prod/auth/getReferralByPhone",
        { params: { phone_number: phoneNumber } }
      );

      if (referralRes.data) {
        referralCode = referralRes.data.referral_code || referralCode;
        referralLink = referralRes.data.referral_link || referralLink;

        await user.update({ referralCode, referralLink });
      }
    } catch (err) {
      console.warn("Referral API failed:", err.message);
    }

    // Prepare response
    const filteredData = {
      Name: userData.fullName || `${userData.firstName} ${userData.lastName}`,
      Email: userData.email,
      PhoneNumber: userData.phoneNumber,
      CollegeName: userData.collegeName,
      ReferralCode: referralCode,
      ReferralLink: referralLink,
      ProfileCompletion: profileCompletion,
      TotalSubscriptions: totalSubscriptions,
      InternshipStatus: userData.internshipStatus || null,
      TeamManager: finalTeamManager,
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
      "firstName",
      "lastName",
      "fullName",
      "dateOfBirth",
      "gender",
      "phoneNumber",
      "alternatePhoneNumber",
      "email",
      "residentialAddress",
      "emergencyContactName",
      "emergencyContactNumber",
      "city",
      "state",
      "pinCode",
      "collegeName",
      "collegeRollNumber",
      "course",
      "specialization",
      "currentYear",
      "currentSemester",
      "collegeAddress",
      "placementCoordinatorName",
      "placementCoordinatorContact",
      "internshipProgram",
      "internshipDuration",
      "internshipModeId",
      "preferredStartDate",
      "referralCode",
      "referralLink",
      "referralSource",
      "studentIdCard",
      "governmentIdProof",
      "passportPhoto",
      "accountHolderName",
      "bankName",
      "branchAddress",
      "ifscCode",
      "accountNumber",
      "preferredCommunicationId",
      "linkedInProfile",
      "studentDeclaration",
      "consentAgreement",
      "internshipStatus",
    ];

    const formattedUsers = users.map((user) => {
      const userData = user.get({ plain: true });

      // Profile completion
      let filled = 0;
      fields.forEach((f) => {
        if (userData[f] !== null && userData[f] !== "" && userData[f] !== false)
          filled++;
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
        TotalSubscriptions: totalSubscriptions,
      };
    });

    return ReS(
      res,
      {
        success: true,
        totalUsers: formattedUsers.length,
        data: formattedUsers,
      },
      200
    );
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
      return ReS(
        res,
        { success: true, message: "User has no referral code", data: null },
        200
      );
    }

    // Call external Lambda
    const apiUrl = `https://lc8j8r2xza.execute-api.ap-south-1.amazonaws.com/prod/auth/getReferralPaymentStatus?referral_code=${user.referralCode}`;
    const apiResponse = await axios.get(apiUrl);
    let modifiedData = { ...apiResponse.data };

    const regUsers = Array.isArray(modifiedData.registered_users)
      ? modifiedData.registered_users.map((u) => ({ ...u }))
      : [];

    if (regUsers.length === 0) {
      modifiedData.registered_users = [];
      return ReS(res, { success: true, data: modifiedData }, 200);
    }

    const normalizeId = (id) => (id == null ? null : String(id).trim());

    // Fetch all RaiseQuery rows
    const raiseQueries = await model.RaiseQuery.findAll({
      attributes: [
        "id",
        "queryStatus",
        "isQueryRaised",
        "createdAt",
        "userId",
        "fundsAuditUserId",
        "phone_number",
        "email"
       
      ],
      raw: true,
    });

    // Map registered_users to RaiseQuery by email or phone
    const updatedRegisteredUsers = regUsers.map((u) => {
      const cloned = { ...u, isDownloaded: true };

      // Try to find matching RaiseQuery
      let rq = raiseQueries.find(
        (r) =>
          (r.phone_number && u.phone_number && r.phone_number.trim() === u.phone_number.trim()) ||
          (r.email && u.email && r.email.trim().toLowerCase() === u.email.trim().toLowerCase())
      );

      // Attach queryStatus and isQueryRaised
      cloned.queryStatus = rq && rq.queryStatus ? rq.queryStatus : "";
      cloned.isQueryRaised = rq ? rq.isQueryRaised : false;

      return cloned;
    });

    modifiedData.registered_users = updatedRegisteredUsers;

    // Save all registered users to FundsAudit
    const rowsToInsert = updatedRegisteredUsers.map((u) => ({
      userId: userId,
      registeredUserId: u.user_id,
      firstName: u.first_name,
      lastName: u.last_name,
      phoneNumber: u.phone_number,
      email: u.email,
      dateOfPayment: u.date_of_payment ? new Date(u.date_of_payment) : null,
      dateOfDownload: u.date_of_download ? new Date(u.date_of_download) : null,
      hasPaid: u.has_paid,
      isDownloaded: u.isDownloaded,
      queryStatus: u.queryStatus || null,
      isQueryRaised: u.isQueryRaised,
      occupation: u.occupation || null,
    }));

    await FundsAudit.bulkCreate(rowsToInsert);

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
    const manager = await model.TeamManager.findOne({
      where: { managerId: userId, isDeleted: false },
    });
    if (!manager) return ReE(res, "Manager not found", 404);

    // ✅ Fetch interns using assignedTeamManager (not managerId)
    const interns = await model.User.findAll({
      where: { assignedTeamManager: userId, isDeleted: false },
      attributes: ["id", "firstName", "lastName", "internshipStatus"],
    });

    // Count by status
    let completed = 0,
      onHold = 0,
      inProgress = 0;

    interns.forEach((intern) => {
      const status = (intern.internshipStatus || "").trim().toLowerCase();
      switch (status) {
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

    return ReS(
      res,
      {
        success: true,
        managerId: userId,
        data: {
          totalInterns: interns.length,
          completed,
          onHold,
          inProgress,
        },
      },
      200
    );
  } catch (error) {
    console.error("Get Internship Status By User Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getInternshipStatusByUser = getInternshipStatusByUser;


// ✅ Get Course Start and End Date for a User (handles numeric/string courseId)
const getUserCourseDates = async (req, res) => {
  try {
    let { userId, courseId } = req.query; // Accept via query params
    if (!userId || !courseId) return ReE(res, "userId and courseId are required", 400);

    // Convert courseId to string for JSONB key access
    courseId = String(courseId);

    // Fetch user
    const user = await model.User.findOne({
      where: { id: userId, isDeleted: false },
      attributes: ["id", "firstName", "lastName", "fullName", "courseDates"]
    });

    if (!user) return ReE(res, "User not found", 404);

    const courseDates = user.courseDates?.[courseId];
    if (!courseDates) return ReE(res, "Course dates not found for this user", 404);

    const response = {
      userId: user.id,
      courseId,
      courseName: courseDates.courseName || null,
      startDate: courseDates.startDate || null,
      endDate: courseDates.endDate || null,
      started: courseDates.started || false
    };

    return ReS(res, { success: true, data: response }, 200);

  } catch (error) {
    console.error("getUserCourseDates error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getUserCourseDates = getUserCourseDates;

const getUserRemainingTime = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId);
    if (!user) return ReE(res, "User not found", 404);

    // Registration time
    const registeredAt = moment(user.createdAt);
    const now = moment();

    // Calculate elapsed time since registration
    const diffMs = now.diff(registeredAt);
    const diffHours = diffMs / (1000 * 60 * 60);

    // Handle 24-hour cycle logic
    const hoursSinceLastCycle = diffHours % 24;
    const remainingHours = 24 - hoursSinceLastCycle;

    // Convert to H:M:S
    const totalSeconds = Math.floor(remainingHours * 3600);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    // Save to DB
    await user.update({ selectedTimeLeft: formattedTime });

    return ReS(
      res,
      {
        success: true,
        userId,
        selectedTimeLeft: formattedTime,
        message: `Remaining time in current 24-hour cycle`,
      },
      200
    );
  } catch (err) {
    console.error("Error in getUserRemainingTime:", err);
    return ReE(res, err.message, 500);
  }
};

module.exports.getUserRemainingTime = getUserRemainingTime;



const updateBusinessTarget = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) return ReE(res, "Invalid userId", 400);

    const { courseId, businessTarget, offerMessage } = req.body;

    if (!courseId) return ReE(res, "courseId is required", 400);

    const user = await model.User.findByPk(userId);
    if (!user) return ReE(res, "User not found", 404);

    // ✅ Normalize existing businessTargets for backward compatibility
    const normalizedBusinessTargets = {};
    if (user.businessTargets) {
      for (const [cId, val] of Object.entries(user.businessTargets)) {
        if (typeof val === "number") {
          normalizedBusinessTargets[cId] = { target: val, offerMessage: null };
        } else {
          normalizedBusinessTargets[cId] = val;
        }
      }
    }

    // ✅ Update or add the course entry
    normalizedBusinessTargets[courseId] = {
      target: businessTarget !== undefined ? businessTarget : (normalizedBusinessTargets[courseId]?.target || 0),
      offerMessage: offerMessage !== undefined ? offerMessage : (normalizedBusinessTargets[courseId]?.offerMessage || null),
    };

    // Save the updated JSON field
    await user.update({ businessTargets: normalizedBusinessTargets });

    return ReS(res, { success: true, message: "Business target updated successfully", businessTargets: normalizedBusinessTargets }, 200);

  } catch (err) {
    console.error("Update Business Target Error:", err);
    return ReE(res, err.message, 500);
  }
};

module.exports.updateBusinessTarget = updateBusinessTarget;

const getReferralPaidCount = async (req, res) => {
  try {
    const { managerId, from, to } = req.query;

    if (!managerId || !from || !to) {
      return ReE(res, "managerId, from, to are required", 400);
    }

    const manager = await model.TeamManager.findByPk(managerId);
    if (!manager) return ReE(res, "Team Manager not found", 404);

    const phone = "+91" + manager.mobileNumber;

    const url = `https://lc8j8r2xza.execute-api.ap-south-1.amazonaws.com/prod/auth/getDailyReferralStatsByPhone?phone_number=${phone}&from_date=${from}&to_date=${to}`;

    const response = await axios.get(url);
    const data = response.data;

    if (!data || !data.result || !data.result.referred_users) {
      return ReE(res, "Invalid API response from referral service", 500);
    }

    const referredUsers = data.result.referred_users;

    // -----------------------
    // UNIQUE USERS CALCULATION
    // -----------------------
    const uniqueUsersMap = new Map();

    referredUsers.forEach((entry) => {
      entry.daily_paid_counts.forEach((d) => {
        const paidCount = parseInt(d.paid_count);
        if (paidCount > 0 && entry.user_id) {
          if (!uniqueUsersMap.has(entry.user_id)) {
            uniqueUsersMap.set(entry.user_id, paidCount);
          } else {
            uniqueUsersMap.set(
              entry.user_id,
              Math.max(uniqueUsersMap.get(entry.user_id), paidCount)
            );
          }
        }
      });
    });

    const totalPaidUsers = uniqueUsersMap.size;

    let totalPaidCount = 0;
    for (let count of uniqueUsersMap.values()) totalPaidCount += count;

    // -----------------------
    // DATE-WISE PAID COUNT
    // -----------------------
    const dateWisePaidCount = {}; // { "2025-11-26": X, "2025-11-27": Y }

    referredUsers.forEach((user) => {
      user.daily_paid_counts.forEach((d) => {
        const date = d.date;
        const paidCount = parseInt(d.paid_count);

        if (!dateWisePaidCount[date]) dateWisePaidCount[date] = 0;
        dateWisePaidCount[date] += paidCount;
      });
    });

    return ReS(res, {
      success: true,
      totalPaidUsers,
      totalPaidCount,
      paidUserIds: [...uniqueUsersMap.keys()],
      dateWisePaidCount, // <-- NEW FIELD
    });

  } catch (err) {
    console.error("Referral Count Error:", err);
    return ReE(res, err.message, 500);
  }
};

module.exports.getReferralPaidCount = getReferralPaidCount;
