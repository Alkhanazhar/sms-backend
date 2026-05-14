import express from "express";

import { protect, authorize } from "../middleware/protect.js";
import { getAllActivities } from "../controllers/activitylog.controller.js";

const LogsRouter = express.Router();

LogsRouter.get("/", protect, authorize(["admin", "teacher"]), getAllActivities);

export default LogsRouter;
