import { type Request, type Response } from "express";
import ActivityLog from "../models/activity.model.js";
import redisClient from "../config/redis.js";

// @desc    Get System Activity Logs(including pagination)
// @route   GET /api/activity
// @access  Private/Admin
export const getAllActivities = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const cache = await redisClient.get(`activityLogs?page=${page}&limit=${limit}`);
    if (cache) {
      res.status(200).json(JSON.parse(cache));
      return;
    }
    const count = await ActivityLog.countDocuments();

    const logs = await ActivityLog.find()
      .populate("user", "name email role") // populate user details
      .sort({ createdAt: -1 }) // latest first
      .skip(skip)
      .limit(limit);

    const responseData = {
      logs,
      page,
      pages: Math.ceil(count / limit),
      total: count,
    };

    await redisClient.setex(`activityLogs?page=${page}&limit=${limit}`, 60 * 60 * 24 * 7, JSON.stringify(responseData));
    res.status(200).json(responseData);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};
