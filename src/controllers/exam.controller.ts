import { type Request, type Response } from "express";
import { logActivity } from "../utils/activitylog.js";
import { generateExam, handleExamSubmission } from "../service/ai.service.js";
import Exam from "../models/exam.model.js";
import Subject from "../models/subject.model.js";
import Submission from "../models/submission.model.js";
import redisClient from "../config/redis.js";

// @desc    Trigger AI Exam Generation
// @route   POST /api/exams/generate
export const triggerExamGeneration = async (req: Request, res: Response) => {
  try {
    const {
      title,
      subject,
      class: classId,
      duration,
      dueDate,
      topic,
      difficulty,
      count,
    } = req.body;
    const subjectDoc = await Subject.findById(subject);
    if (!subjectDoc)
      return res.status(404).json({ message: "Subject not found" });

    const teacherId = (req as any).user._id;
    const draftExam = await Exam.create({
      title: title || `Auto-Generated: ${topic}`,
      subject,
      class: classId,
      teacher: teacherId,
      duration: duration || 60,
      dueDate: dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 1 week
      isActive: false, // Draft mode
      questions: [], // Empty for now, Inngest will fill this
    });

    const userId = (req as any).user._id;
    await logActivity({
      userId,
      action: `User triggered exam generation: ${draftExam._id}`,
    });

    await generateExam({
      examId: draftExam._id.toString(),
      topic,
      subjectName: subjectDoc.name,
      difficulty: difficulty || "Medium",
      count: count || 10,
    });
    res.status(201).json({
      message: "Exam generated successfully.",
      examId: draftExam._id,
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Create/Publish Exam we won't use it
// @route   POST /api/exams
export const createExam = async (req: Request, res: Response) => {
  try {
    const exam = await Exam.create({
      ...req.body,
      teacher: (req as any).user._id, // From Auth Middleware
    });
    const userId = (req as any).user._id;
    await logActivity({ userId, action: "User created a new exam" });
    await redisClient.delPattern(`exams:*`);
    res.status(201).json(exam);
    return;
  } catch (error: any) {
    res.status(500).json({ message: error.message });
    return;
  }
};

// @desc    Get Exams (Student sees available, Teacher sees created)
// @route   GET /api/exams
export const getExams = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let query = {};

    if (user.role === "student") {
      // Students see exams for their class only
      query = { class: user.studentClass, isActive: true };
    } else if (user.role === "teacher") {
      // Teachers see exams they created
      query = { teacher: user._id };
    }
    const cacheKey =
      Object.keys(query).length > 0
        ? `exams:${JSON.stringify(query)}`
        : "exams";
    const cachedExams = await redisClient.get(cacheKey);
    if (cachedExams) {
      return res.json(JSON.parse(cachedExams));
    }
    const exams = await Exam.find(query)
      .populate("subject", "name")
      .populate("class", "name section")
      .select("-questions.correctAnswer"); // Hide answers!
    await redisClient.setEx(cacheKey, 60 * 5, JSON.stringify(exams));

    res.json(exams);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get exam by id
// @route   POST /api/exams/:id
export const getExamById = async (req: Request, res: Response) => {
  try {
    const examId = req.params.id;
    const user = (req as any).user; // Assumes authMiddleware attaches user
    const cacheKey = `exam:${examId}`;
    const cachedExam = await redisClient.get(cacheKey);
    if (cachedExam) {
      return res.json(JSON.parse(cachedExam));
    }
    // 1. Initialize the query
    let query = Exam.findById(examId)
      .populate("subject", "name code")
      .populate("class", "name section")
      .populate("teacher", "name email");

    // 2. Conditional Logic: Reveal answers for Teachers/Admins
    // The '+' syntax forces selection of fields marked as { select: false } in Schema
    if (user.role === "teacher" || user.role === "admin") {
      // @ts-ignore
      query = query.select("+questions.correctAnswer");
    }


    // 3. Execute Query
    const exam = await query;

    // 4. Handle Not Found
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    // 5. Security Check (Optional but recommended)
    // Ensure student belongs to the class this exam is assigned to
    if (user.role === "student") {
      // Assuming user.studentClass is a string or ObjectId
      // We compare it with the exam.class._id (which might be populated or an ID)
      const examClassId = exam.class._id
        ? exam.class._id.toString()
        : exam.class.toString();
      const userClassId = user.studentClass ? user.studentClass.toString() : "";

      if (examClassId !== userClassId) {
        return res
          .status(403)
          .json({ message: "You are not authorized to view this exam." });
      }
    }
    await redisClient.setEx(cacheKey, 60 * 5, JSON.stringify(exam));

    res.json(exam);
    return;
  } catch (error: any) {
    console.error(error);

    // Handle Invalid ID format (CastError)
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid exam ID" });
    }

    // Handle other errors
    return res.status(500).json({ message: "Internal server error" });
  }
};

// @desc    Toggle Exam Status (Active/Inactive)
// @route   PATCH /api/exams/:id/status
// @access  Private (Teacher/Admin)
export const toggleExamStatus = async (req: Request, res: Response) => {
  try {
    const examId = req.params.id;
    const user = (req as any).user;

    const exam = await Exam.findById(examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    // Security Check: Ensure the user owns the exam (if not Admin)
    if (
      user.role !== "admin" &&
      exam.teacher.toString() !== user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to modify this exam" });
    }

    // Toggle the status
    exam.isActive = !exam.isActive;
    await exam.save();
    const userId = (req as any).user._id;
    await logActivity({ userId, action: "User toggled exam status" });
    res.json({
      message: `Exam is now ${exam.isActive ? "Active" : "Inactive"}`,
      _id: exam._id,
      isActive: exam.isActive,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Submit & Auto-Grade Exam let these happen inside inngest
// @route   POST /api/exams/:id/submit
export const submitExam = async (req: Request, res: Response) => {
  try {
    const { answers } = req.body;
    const studentId = (req as any).user._id;
    const examId = req.params.id;

    // Call direct submission handler
    await handleExamSubmission({
      examId: examId as string,
      studentId: studentId.toString(),
      answers,
    });

    const userId = (req as any).user._id;
    await logActivity({ userId, action: "User submitted an exam" });

    res.status(201).json({
      message: "Exam submitted successfully.",
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Exam Results (For Student)
// @route   GET /api/exams/:id/result
export const getExamResult = async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).user._id;
    const examId = req.params.id;

    const submission = await Submission.findOne({
      exam: examId,
      student: studentId,
    }).populate({
      path: "exam",
      select: "title questions._id questions.correctAnswer", // <--- FORCE SELECT correct answers
    });
    if (!submission) {
      return res.status(404).json({ message: "No submission found" });
    }

    res.json(submission);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
