import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), "public/uploads/notices");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Store files in public/uploads/notices
  },
  filename: function (req, file, cb) {
    // Unique filename: timestamp + random number + original extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "notice-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// File Filter (Optional: restrict to PDF, images, docs)
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPG, PNG, PDF, and DOC/DOCX files are allowed."));
  }
};

// Multer Upload Instance (Notices)
export const uploadNoticeAttachment = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter,
});

// --- Discipline Uploads ---
const disciplineUploadDir = path.join(process.cwd(), "public/uploads/discipline");
if (!fs.existsSync(disciplineUploadDir)) {
  fs.mkdirSync(disciplineUploadDir, { recursive: true });
}

const disciplineStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, disciplineUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "discipline-" + uniqueSuffix + path.extname(file.originalname));
  },
});

export const uploadDisciplineAttachment = multer({
  storage: disciplineStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter,
});
