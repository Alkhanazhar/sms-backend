import express from "express";
import {
    triggerExamGeneration,
    getExams,
    submitExam,
    getExamById,
    toggleExamStatus,
    getExamResult,
    deleteExam
} from "../controllers/exam.controller.js";
import { protect, authorize } from "../middleware/protect.js";

const examRouter = express.Router();

// so the issue was only from my end. I had to restart the computer, after
examRouter.post(
    "/generate",
    protect,
    authorize(["teacher", "admin"]),
    triggerExamGeneration
);

examRouter.get(
    "/",
    protect,
    authorize(["teacher", "student", "admin"]),
    getExams
);

// we try on the fronten
// Student Routes
examRouter.post(
    "/:id/submit",
    protect,
    authorize(["student", "admin"]),
    submitExam
);

// teacher and admin routes
examRouter.patch(
    "/:id/status",
    protect,
    authorize(["teacher", "admin"]),
    toggleExamStatus
);

examRouter.get(
    "/:id/result",
    protect,
    getExamResult,
    authorize(["student", "admin", "teacher"])
);

examRouter.get(
    "/:id",
    protect,
    getExamById,
    authorize(["teacher", "student", "admin"])
);

examRouter.delete(
    "/:id",
    protect,
    authorize(["teacher", "admin"]),
    deleteExam
);

export default examRouter;
