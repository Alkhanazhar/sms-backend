import { type Request, type Response } from "express";
import { logActivity } from "../utils/activitylog.js";
import Timetable from "../models/timetable.model.js";
import { generateTimeTable } from "../service/ai.service.js";
import redisClient from "../config/redis.js";

// @desc    Generate a Timetable using AI
// @route   POST /api/timetables/generate
// @access  Private/Admin
export const generateTimetable = async (req: Request, res: Response) => {
  try {
    const { classId, academicYearId, settings } = req.body;
    console.log(classId, academicYearId, settings);
    await generateTimeTable(classId, academicYearId, settings);
    await redisClient.delPattern(`timetable:*`);
    const userId = (req as any).user._id;
    await logActivity({
      userId,
      action: `Requested timetable generation for class ID: ${classId}`,
    });
    await redisClient.del("timetable");
    return res.status(200).json({ message: "Timetable generated successfully" });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
    console.log(error.message);
    console.log(error);
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
    await redisClient.setEx(cacheKey, 60 * 5, JSON.stringify(timetable));
    res.status(200).json(timetable);
    return;
  } catch (error: any) {
    res.status(500).json({ message: error.message });
    return;
  }
};
