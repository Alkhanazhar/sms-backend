import express from "express";
import { authorize, protect } from "../middleware/protect.js";
import {
  createSubject,
  getAllSubjects,
  updateSubject,
  deleteSubject,
} from "../controllers/subject.controller.js";

const subjectRouter = express.Router();

subjectRouter
  .route("/create")
  .post(protect, authorize(["admin"]), createSubject);

subjectRouter
  .route("/")
  .get(protect, authorize(["admin", "teacher"]), getAllSubjects);

subjectRouter
  .route("/delete/:id")
  .delete(protect, authorize(["admin"]), deleteSubject);

subjectRouter
  .route("/update/:id")
  .patch(protect, authorize(["admin"]), updateSubject);

export default subjectRouter;
