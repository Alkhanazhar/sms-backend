import express from "express";
import {
  createIncident,
  getIncidents,
  updateIncidentStatus,
  addParentFeedback,
} from "../controllers/discipline.controller.js";
import { protect, authorize } from "../middleware/protect.js";
import { uploadDisciplineAttachment } from "../middleware/upload.middleware.js";

const   router = express.Router();

// Get incidents (accessible to all logged-in roles, controller handles filtering)
router.get("/", protect, getIncidents);

// Create an incident (Any logged-in user, with optional attachment)
router.post("/", protect, uploadDisciplineAttachment.single("attachment"), createIncident);

// Update incident status/comments (Admins only)
router.patch("/:id/status", protect, authorize(["admin"]), updateIncidentStatus);

// Add parent feedback (Parents & Admins only)
router.patch("/:id/parent-feedback", protect, authorize(["admin", "parent"]), addParentFeedback);

export default router;
