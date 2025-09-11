"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const moment = require("moment-timezone");
const { sendMail } = require("../middleware/mailer.middleware.js");

// Add ContactUs entry
var add = async (req, res) => {
  try {
    const { userId, Name, email, phone, message } = req.body;

    if (!userId || !Name || !email) {
      return ReE(res, "Missing required fields", 400);
    }

    // Fetch user
    const user = await model.User.findOne({ where: { id: userId } });
    if (!user || !user.email) return ReE(res, "User email not found", 404);

    // Create ContactUs entry
    const contactEntry = await model.ContactUs.create({
      Name: Name.toString(),
      email: email.toString(),
      phone: phone ? phone.toString() : null,
      message: message ? message.toString() : null,
      user: userId
    });

    // Send confirmation email using mailer middleware
    const subject = "Thank you for contacting us!";
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Thank you for reaching out!</h2>
        <p>Hi ${Name},</p>
        <p>We have received your message and will get back to you shortly.</p>
        <p><strong>Your message:</strong></p>
        <blockquote style="background:#f1f1f1; padding: 10px; border-left: 4px solid #0c7d7d;">
          ${message || "No message provided"}
        </blockquote>
        <p>Best regards,<br/> Eduroom Support </p>
      </div>
    `;

    const mailResult = await sendMail(email, subject, html);
    if (!mailResult.success) {
      console.error("ContactUs Email Send Error:", mailResult.error);
      // You can choose to fail silently or return an error; here we log and continue
    }

    return ReS(res, contactEntry, 201);
  } catch (error) {
    console.error("ContactUs Add Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.add = add;

// Fetch ContactUs entries by user
var fetchByUser = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) return ReE(res, "User ID is required", 400);

    const existingUser = await model.User.findByPk(userId);
    if (!existingUser) return ReE(res, "User not found", 404);

    const contacts = await model.ContactUs.findAll({
      where: { user: userId, isDeleted: false }
    });

    const formattedContacts = contacts.map(contact => ({
      ...contact.dataValues,
      createdAt: moment(contact.createdAt).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: moment(contact.updatedAt).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')
    }));

    return ReS(res, { success: true, data: formattedContacts }, 200);
  } catch (error) {
    console.error("Fetch ContactUs By User Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchByUser = fetchByUser;

// Soft delete a ContactUs entry
const deleteContact = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) return ReE(res, "Missing required ID", 400);

    const contact = await model.ContactUs.findByPk(id);
    if (!contact || contact.isDeleted) return ReE(res, "ContactUs entry not found", 404);

    contact.isDeleted = true;
    await contact.save();

    return ReS(res, { success: true, message: "ContactUs entry soft deleted successfully" }, 200);
  } catch (error) {
    console.error("ContactUs Delete Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.deleteContact = deleteContact;
