import express from "express";
import { getDashboardStats } from "../controllers/dashboard.controller.js";
// import { generateDashboardInsight } from "../controllers/aiController.js";
import { protect } from "../middleware/protect.js";

const dashboardRouter = express.Router();

// Get Stats (Role is determined by token)
dashboardRouter.get("/stats", protect, getDashboardStats);

// Get AI Insight
// router.post("/insight", protect, generateDashboardInsight);

export default dashboardRouter;
