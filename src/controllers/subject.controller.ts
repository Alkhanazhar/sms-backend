import { type Request, type Response } from "express";
import { logActivity } from "../utils/activitylog.js";
import subject from "../models/subject.model.js";

// @desc    Create a new Subject
// @route   POST /api/subjects
// @access  Private/Admin
export const createSubject = async (req: Request, res: Response) => {
  try {
    const { name, code, teacher, isActive } = req.body; // Expecting teacher to be ["ID1", "ID2"]
    const subjectExists = await subject.findOne({ code });
    if (subjectExists) {
      return res.status(400).json({ message: "Subject code already exists" });
    }
    const newSubject = await subject.create({
      name,
      code,
      isActive,
      teacher: Array.isArray(teacher) ? teacher : [],
    });
    if (newSubject) {
      const userId = (req as any).user._id;
      await logActivity({
        userId,
        action: `Created subject: ${newSubject.name}`,
      });
      res.status(201).json(newSubject);
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get all Subjects
// @route   GET /api/subjects
// @access  Private
export const getAllSubjects = async (req: Request, res: Response) => {
  try {
    // 1. Parse Query Parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;

    // 2. Build Search Query (Search by Name OR Code)
    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }
    // 3. Execute Query (Count & Find)
    const [total, subjects] = await Promise.all([
      subject.countDocuments(query),
      subject
        .find(query)
        .populate("teacher", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    // 4. Return Data + Pagination Meta
    res.json({
      subjects,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Update Subject
// @route   PUT /api/subjects/:id
// @access  Private/Admin
export const updateSubject = async (req: Request, res: Response) => {
  try {
    const { name, code, teacher, isActive } = req.body;

    const updatedSubject = await subject.findByIdAndUpdate(
      req.params.id,
      {
        name,
        code,
        isActive,
        teacher: Array.isArray(teacher) ? teacher : [],
      },
      { new: true, runValidators: true }
    );
    const userId = (req as any).user._id;
    await logActivity({
      userId,
      action: `Updated subject: ${updatedSubject?.name}`,
    });
    if (!updatedSubject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    res.json(updatedSubject);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Delete Subject
// @route   DELETE /api/subjects/:id
// @access  Private/Admin
export const deleteSubject = async (req: Request, res: Response) => {
  try {
    const deletedSubject = await subject.findByIdAndDelete(req.params.id);
    if (!deletedSubject) {
      return res.status(404).json({ message: "Subject not found" });
    }
    const userId = (req as any).user._id;
    await logActivity({
      userId,
      action: `Updated subject: ${deletedSubject?.name}`,
    });
    res.json({ message: "Subject deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};
