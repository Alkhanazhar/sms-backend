import { type Request, type Response } from "express";
import Discipline from "../models/discipline.model.js";
import User from "../models/user.model.js";
import { generateGeminiResponse } from "../config/ai-sdk.js";
import redisClient, { clearCache } from "../config/redis.js";

// @desc    Log a new student discipline incident with AI analysis
// @route   POST /api/discipline
// @access  Private (Any logged-in user can report)
export const createIncident = async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId, title, description, incidentDate } = req.body;
    const reportedBy = (req as any).user?._id;

    if (!studentId || !title || !description) {
      res.status(400).json({ message: "Student, title, and description are required" });
      return;
    }

    // Verify student exists
    const student = await User.findById(studentId);
    if (!student || student.role !== "student") {
      res.status(404).json({ message: "Student not found" });
      return;
    }

    // Call Google Gemini to analyze the incident
    const prompt = `You are an expert school behavior analyst and child psychologist.
Analyze the following student behavior incident and return a strict JSON response.

Incident Title: "${title}"
Incident Description: "${description}"

Determine the severity level (LOW, MEDIUM, HIGH) based on standard school rules.
Determine the most appropriate category: "Academic Dishonesty", "Bullying", "Disruption", "Insubordination", "Property Damage", or "Other".
Assign demerit points (from 1 to 10):
- LOW severity: 1-3 points (e.g., minor disruption, dress code, lateness)
- MEDIUM severity: 4-7 points (e.g., cheating on small quiz, disrespect, skipping class, mild disruption)
- HIGH severity: 8-10 points (e.g., severe cheating on final exams, bullying, physical fights, property damage)

Provide a dynamic AI Action Plan containing 2-3 specific, actionable recommendations each for the Teacher, the Parent, and the Student. Keep the tone helpful, professional, and restorative.

CRITICAL: Return ONLY a raw JSON object. Do not wrap it in markdown. Do not include backticks. It must parse successfully using JSON.parse.

JSON structure:
{
  "category": "Academic Dishonesty" | "Bullying" | "Disruption" | "Insubordination" | "Property Damage" | "Other",
  "severity": "LOW" | "MEDIUM" | "HIGH",
  "demerits": number,
  "aiActionPlan": {
    "teacherAdvice": "string advice for the teacher",
    "parentAdvice": "string advice for the parent",
    "studentAdvice": "string advice for the student"
  }
}
`;

    const aiResponseString = await generateGeminiResponse(prompt);
    let aiParsedData;
    try {
      aiParsedData = JSON.parse(aiResponseString);
    } catch (parseError) {
      console.error("Failed to parse Gemini JSON output:", aiResponseString);
      // Fallback in case AI doesn't return clean JSON
      aiParsedData = {
        category: "Other",
        severity: "MEDIUM",
        demerits: 3,
        aiActionPlan: {
          teacherAdvice: "Monitor behavior and have a 1-on-1 dialogue with the student.",
          parentAdvice: "Discuss this incident at home and encourage positive choices.",
          studentAdvice: "Reflect on your actions and their impact on your classroom environment."
        }
      };
    }

    // Build attachment URL if file was uploaded
    const attachmentPath = (req as any).file
      ? `/uploads/discipline/${(req as any).file.filename}`
      : "";

    const newIncident = await Discipline.create({
      student: studentId,
      teacher: reportedBy, // whoever reports the incident (any role)
      title,
      description,
      incidentDate: incidentDate || new Date(),
      category: aiParsedData.category,
      severity: aiParsedData.severity,
      demerits: aiParsedData.demerits,
      aiActionPlan: aiParsedData.aiActionPlan,
      attachment: attachmentPath,
      status: "PENDING",
      escalatedToAdmin: aiParsedData.severity === "HIGH"
    });

    await clearCache("discipline");

    res.status(201).json(newIncident);
  } catch (error) {
    console.error("Create incident error:", error);
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get all discipline incidents filtered by role
// @route   GET /api/discipline
// @access  Private
export const getIncidents = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userId = user?._id;
    const userRole = user?.role;

    let query: any = {};

    if (userRole === "admin") {
      // Admins see all incidents
      query = {};
    } else if (userRole === "teacher" || userRole === "student") {
      // Teachers & Students see incidents where they are involved
      // (either as the reporter OR as the subject student)
      query = { $or: [{ teacher: userId }, { student: userId }] };
    } else if (userRole === "parent") {
      // For parents, check if they passed a studentId query
      const studentId = req.query.studentId;
      if (!studentId) {
        res.status(400).json({ message: "Student ID is required for parent access" });
        return;
      }
      query = { student: studentId };
    } else {
      res.status(403).json({ message: "Unauthorized access" });
      return;
    }

    // Optional filters
    if (req.query.severity) {
      query.severity = req.query.severity;
    }
    if (req.query.status) {
      query.status = req.query.status;
    }

    const cacheKey = `discipline:${userRole}:${userId}:${JSON.stringify(query)}`;
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    const incidents = await Discipline.find(query)
      .populate("student", "name email role")
      .populate("teacher", "name email role")
      .sort({ createdAt: -1 });

    await redisClient.setEx(cacheKey, 60 * 5, JSON.stringify(incidents)); // Cache for 5 minutes

    res.json(incidents);
  } catch (error) {
    console.error("Get incidents error:", error);
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Update incident status and add admin feedback
// @route   PATCH /api/discipline/:id/status
// @access  Private (Admin)
export const updateIncidentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, adminComment, escalatedToAdmin } = req.body;
    const incidentId = req.params.id;

    const incident = await Discipline.findById(incidentId);
    if (!incident) {
      res.status(404).json({ message: "Incident not found" });
      return;
    }

    if (status) incident.status = status;
    if (adminComment !== undefined) incident.adminComment = adminComment;
    if (escalatedToAdmin !== undefined) incident.escalatedToAdmin = escalatedToAdmin;

    await incident.save();

    // Clear caches
    clearCache("discipline");


    res.json({ message: "Incident updated successfully", incident });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Add parent feedback/response to an incident
// @route   PATCH /api/discipline/:id/parent-feedback
// @access  Private (Parent)
export const addParentFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { parentFeedback } = req.body;
    const incidentId = req.params.id;

    if (!parentFeedback) {
      res.status(400).json({ message: "Feedback comment is required" });
      return;
    }

    const incident = await Discipline.findById(incidentId);
    if (!incident) {
      res.status(404).json({ message: "Incident not found" });
      return;
    }

    incident.parentFeedback = parentFeedback;
    // Mark status as under review once parent acknowledges/replies
    if (incident.status === "PENDING") {
      incident.status = "UNDER_REVIEW";
    }

    await incident.save();

    await clearCache("discipline");

    res.json({ message: "Feedback added successfully", incident });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};
