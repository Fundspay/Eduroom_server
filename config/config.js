if (process.env.NODE_ENV !== "production") {
  require("dotenv").config(); // Load .env only in non-production
}

let CONFIG = {};

// General
CONFIG.app = process.env.APP || "dev";
CONFIG.port = process.env.PORT || 3001;

// Database
CONFIG.db_dialect   = process.env.DB_DIALECT || "postgres";
CONFIG.db_host      = process.env.DB_HOST || "localhost";
CONFIG.db_port      = process.env.DB_PORT || 3000;
CONFIG.db_name      = process.env.DB_NAME || "hrdashboard";
CONFIG.db_user      = process.env.DB_USER || "postgres";
CONFIG.db_password  = process.env.DB_PASSWORD || "pass1122me";
CONFIG.db_usePassword = (process.env.DB_USE_PASSWORD || "true") === "true";


CONFIG.godaddyBaseUrl = process.env.GODADDY_BASE_URL;
CONFIG.godaddyApiKey = process.env.GODADDY_API_KEY;
CONFIG.godaddyApiSecret = process.env.GODADDY_API_SECRET;

// Mail (GoDaddy SMTP)
CONFIG.mailService = process.env.MAIL_SERVICE;
CONFIG.mailUser = process.env.MAIL_USER;
CONFIG.mailPassword = process.env.MAIL_PASSWORD;
CONFIG.mailHost = process.env.MAIL_HOST;
CONFIG.mailPort = process.env.MAIL_PORT;
CONFIG.mailSecure = process.env.MAIL_SECURE;

CONFIG.awsRegion = process.env.AWS_REGION || "us-east-1";
CONFIG.awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID || "your-aws-access-key-id";
CONFIG.awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || "your-aws-secret-access-key";


CONFIG.s3Region = process.env.S3_REGION || 'ap-south-1';
CONFIG.s3AccessKeyId = process.env.S3_ACCESS_KEY_ID || 'your-access-key-id';
CONFIG.s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY || 'your-secret-access-key';
CONFIG.s3Bucket = process.env.S3_BUCKET || 'your-bucket-name';


module.exports = CONFIG;  // <-- ✅ export it
