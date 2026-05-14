import express from "express";
import { generateTimetable, getTimetable } from "../controllers/timetable.controller.ts";
import { authorize, protect } from "../middleware/protect.ts";

const timeRouter = express.Router();

// Generate: Admin only (costs money/resources)
timeRouter.post("/generate", protect, authorize(["admin"]), generateTimetable);

// View: Everyone (Students need to see their schedule)
timeRouter.get("/:classId", protect, getTimetable);

export default timeRouter;