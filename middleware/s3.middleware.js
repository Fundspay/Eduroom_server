const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client } = require("@aws-sdk/client-s3");
const CONFIG = require("../config/config");

// ✅ Initialize S3 Client
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
    bucket: CONFIG.s3Bucket, // ensure CONFIG.s3Bucket = "eduroom-registration-details"
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const fileName = `${Date.now()}-${file.originalname}`;
      cb(null, `${pathPrefix}/${fileName}`);
    },
  });

// ✅ File type filter for images only
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const ext = file.originalname.toLowerCase().match(/\.(jpeg|jpg|png)$/);
  const mime = allowedTypes.test(file.mimetype);

  if (ext && mime) {
    cb(null, true); // accept file
  } else {
    cb(new Error("Only PNG, JPEG, JPG files are allowed"));
  }
};

// ✅ Profile Picture Upload (to eduroom.registration.details/profile)
const uploadProfilePicture = multer({
  storage: buildS3Storage("eduroom-registration-details/profile"),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: imageFileFilter,
});

// ✅ General Domain Images Upload (to eduroom.registration.details/domain-images)
const uploadGeneralFile = multer({
  storage: buildS3Storage("eduroom-registration-details/domain-images"),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: imageFileFilter,
});

// ✅ General Course Images Upload (to eduroom.registration.details/course-images)
const uploadGeneralFile2 = multer({
  storage: buildS3Storage("eduroom-registration-details/course-images"),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: imageFileFilter,
});

module.exports = {
  uploadProfilePicture,
  uploadGeneralFile,
  uploadGeneralFile2,
};
