import { type Request, type Response } from "express";
import Class from "../models/class.model.js";
import { logActivity } from "../utils/activitylog.js";
import redisClient from "../config/redis.js";

// @desc    Create a new Class
// @route   POST /api/classes
// @access  Private/Admin
export const createClass = async (req: Request, res: Response) => {
  try {
    const { name, academicYear, classTeacher, capacity } = req.body;

    const existingClass = await Class.findOne({ name, academicYear });
    console.log(existingClass);
    if (existingClass) {
      return res.status(400).json({
        message:
          "Class with this name already exists for the specified academic year.",
      });
    }

    const newClass = await Class.create({
      name,
      academicYear,
      classTeacher,
      capacity,
    });
    await logActivity({
      userId: (req as any).user.id,
      action: `Created new class: ${newClass.name}`,
    });
    await redisClient.del("classes");
    res.status(201).json(newClass);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get All Classes
// @route   GET /api/classes
// @access  Private
export const getAllClasses = async (req: Request, res: Response) => {
  try {
    // 1. Parse Query Parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;

    // 2. Build Search Query (Case-insensitive regex on Name)
    const query: any = {};
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const cacheKey = `classes?page=${page}&limit=${limit}&search=${search}`;

    // 3. Check Redis Cache
    const cache = await redisClient.get(cacheKey);
    if (cache) {
      res.status(200).json(JSON.parse(cache));
      return;
    }

    // 4. Execute Query (Count & Find)
    const [total, classes] = await Promise.all([
      Class.countDocuments(query),
      Class.find(query)
        .populate("academicYear", "name")
        .populate("classTeacher", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    // 4. Return Data + Pagination Meta
    const responseData = {
      classes,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    };

    await redisClient.setEx(cacheKey, 60 * 5, JSON.stringify(responseData));
    res.status(200).json(responseData);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Update Class
// @route   PUT /api/classes/:id
// @access  Private/Admin
export const updateClass = async (req: Request, res: Response) => {
  try {
    const classId = req.params.id;
    const { name, academicYear } = req.body;

    const existingClass = await Class.findOne({
      _id: { $ne: classId },
    });
    if (existingClass) {
      const updatedClass = await Class.findByIdAndUpdate(classId, req.body, {
        new: true,
        runValidators: true,
      });
      if (!updatedClass) {
        return res.status(404).json({ message: "Class not found" });
      }
      await logActivity({
        userId: (req as any).user.id,
        action: `Updated class: ${updatedClass.name}`,
      });
      return res.status(200).json(updatedClass);
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Delete Class
// @route   DELETE /api/classes/:id
// @access  Private/Admin
export const deleteClass = async (req: Request, res: Response) => {
  try {
    const deletedClass = await Class.findByIdAndDelete(req.params.id);
    const userId = (req as any).user._id;
    await logActivity({
      userId,
      action: `Deleted class: ${deletedClass?.name}`,
    });
    if (!deletedClass) {
      return res.status(404).json({ message: "Class not found" });
    }
    res.json({ message: "Class removed" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
