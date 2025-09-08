const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client } = require("@aws-sdk/client-s3");
const CONFIG = require("../config/config");

const s3Client = new S3Client({
  region: CONFIG.s3Region,
  credentials: {
    accessKeyId: CONFIG.s3AccessKeyId,
    secretAccessKey: CONFIG.s3SecretAccessKey,
  },
});

// 🔹 Common S3 Storage Builder
const buildS3Storage = (pathPrefix) =>
  multerS3({
    s3: s3Client,
    bucket: CONFIG.s3Bucket, // make sure CONFIG.s3Bucket = "eduroom-registration-details"
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const fileName = `${Date.now()}-${file.originalname}`;
      cb(null, `${pathPrefix}/${fileName}`);
    },
  });

// ✅ Profile Picture Upload (to eduroom.registration.details/profile)
const uploadProfilePicture = multer({
  storage: buildS3Storage("eduroom.registration.details/profile"),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ✅ General File Upload (to eduroom-registration-details/uploads)
const uploadGeneralFile = multer({
  storage: buildS3Storage("eduroom.registration.details/domain-images"),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ✅ General File Upload (to eduroom-registration-details/uploads)
const uploadGeneralFile2 = multer({
  storage: buildS3Storage("eduroom.registration.details/course-images"),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});


module.exports = {
  uploadProfilePicture,
  uploadGeneralFile,
  uploadGeneralFile2
};
