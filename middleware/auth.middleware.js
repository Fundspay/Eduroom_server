const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const CONFIG = require("../config/config");
const model = require('../models/index');

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require("../config/firebase-service-account.json"))
    });
}

// Middleware to verify JWT token for protected routes
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, CONFIG.jwtSecret, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Invalid token' });

        req.user = decoded; // Attach decoded token info to request
        next();
    });
};

// Middleware to authenticate with Firebase ID token (Google login)
const firebaseAuth = async (req, res, next) => {
    const { idToken } = req.body;

    if (!idToken) return res.status(400).json({ message: "No ID token provided" });

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { email, name, uid } = decodedToken;

        if (!email) return res.status(400).json({ message: "Invalid token. Email not found." });

        // Find user in DB
        const user = await model.User.findOne({ where: { email, isDeleted: false } });
        if (!user) return res.status(401).json({ message: "User not found" });

        req.user = {
            id: user.id,
            name: user.firstName + ' ' + user.lastName,
            email: user.email,
            uid
        };

        next();
    } catch (error) {
        console.error("Error verifying Firebase token:", error);
        return res.status(401).json({ message: "Unauthorized", error: error.message });
    }
};

module.exports = {
    verifyToken,
    firebaseAuth
};
