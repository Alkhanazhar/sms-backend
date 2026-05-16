import { type Request, type Response } from "express";
import { logActivity } from "../utils/activitylog.js";
import Timetable from "../models/timetable.model.js";
import { inngest } from "../innegest/index.js";
import redisClient from "../config/redis.js";

// @desc    Generate a Timetable using AI
// @route   POST /api/timetables/generate
// @access  Private/Admin
export const generateTimetable = async (req: Request, res: Response) => {
  try {
    const { classId, academicYearId, settings } = req.body;

    await inngest.send({
      name: "generate/timetable",
      data: {
        classId,
        academicYearId,
        settings,
      },
    });
    const userId = (req as any).user._id;
    await logActivity({
      userId,
      action: `Requested timetable generation for class ID: ${classId}`,
    });
    return res.status(200).json({ message: "Timetable generation initiated" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
    return;
  }
};

// @desc    Get Timetable by Class
// @route   GET /api/timetables/:classId
export const getTimetable = async (req: Request, res: Response) => {
  try {
    const cacheKey = `timetable:${req.params.classId}`;
    const cachedTimetable = await redisClient.get(cacheKey);
    if (cachedTimetable) {
      return res.json(JSON.parse(cachedTimetable));
    }
    const timetable = await Timetable.findOne({ class: req.params.classId })
      .populate("schedule.periods.subject", "name code")
      .populate("schedule.periods.teacher", "name email");

    if (!timetable) {
      res.status(404).json({ message: "Timetable not found" });
      return;
    }
    await redisClient.setEx(cacheKey, 60 * 60 * 24 * 7, JSON.stringify(timetable));
    res.status(200).json(timetable);
    return;
  } catch (error: any) {
    res.status(500).json({ message: error.message });
    return;
  }
};
