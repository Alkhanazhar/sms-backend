import express from "express";
import { createNotice, getNotices, deleteNotice, markNoticeAsRead } from "../controllers/notice.controller.js";
import { uploadNoticeAttachment } from "../middleware/upload.middleware.js";
import { authorize, protect } from "../middleware/protect.js";

const router = express.Router();

router.post("/", protect, authorize(["admin"]), uploadNoticeAttachment.single("attachment"), createNotice);
router.get("/", protect, getNotices);
router.patch("/:id/read", protect, markNoticeAsRead);
router.delete("/:id", protect, authorize(["admin"]), deleteNotice);

export default router;
