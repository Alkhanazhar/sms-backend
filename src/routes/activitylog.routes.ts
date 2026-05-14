import express from "express";

import { protect, authorize } from "../middleware/protect.ts";
import { getAllActivities } from "../controllers/activitylog.controller.ts";

const LogsRouter = express.Router();

LogsRouter.get("/", protect, authorize(["admin", "teacher"]), getAllActivities);

export default LogsRouter;