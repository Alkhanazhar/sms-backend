import { type Request, type Response } from "express";
import Notice from "../models/notice.model.js";
import redisClient from "../config/redis.js";

// @desc    Create a new Notice
// @route   POST /api/notices
// @access  Private/Admin
export const createNotice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, content, targetType, targetUsers } = req.body;

    // Parse targetUsers if it comes as a string (FormData limitation)
    let parsedTargetUsers = [];
    if (targetUsers) {
      try {
        parsedTargetUsers = typeof targetUsers === 'string' ? JSON.parse(targetUsers) : targetUsers;
      } catch (e) {
        parsedTargetUsers = targetUsers.split(',');
      }
    }

    let attachmentUrl = "";
    if (req.file) {
      // Create public URL based on the server (adjust for production)
      attachmentUrl = `/uploads/notices/${req.file.filename}`;
    }

    const notice = await Notice.create({
      title,
      content,
      targetType,
      targetUsers: targetType === "SPECIFIC_USERS" ? parsedTargetUsers : [],
      attachmentUrl,
      sender: (req as any).user?._id, // Assume auth middleware adds user to req
    });

    res.status(201).json(notice);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get Notices for logged-in user
// @route   GET /api/notices
// @access  Private
export const getNotices = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userRole = user?.role;
    const userId = user?._id;

    let query: any = { isActive: true };

    if (userRole === "admin") {
      // Admin sees everything
      query = {};
    } else if (userRole === "teacher") {
      query.$or = [
        { targetType: "ALL" },
        { targetType: "ALL_TEACHERS" },
        { targetType: "SPECIFIC_USERS", targetUsers: userId }
      ];
    } else if (userRole === "student") {
      query.$or = [
        { targetType: "ALL" },
        { targetType: "ALL_STUDENTS" },
        { targetType: "SPECIFIC_USERS", targetUsers: userId }
      ];
    }
    const cacheKey = `notices:${userId}`;
    const cachedNotices = await redisClient.get(cacheKey);
    if (cachedNotices) {
      res.status(200).json(JSON.parse(cachedNotices));
      return;
    }
    const notices = await Notice.find(query)
      .populate("sender", "name email role")
      .sort({ createdAt: -1 })
      .lean(); // Use lean() to return plain objects

    // Add isRead flag to each notice
    const noticesWithReadStatus = notices.map((notice: any) => ({
      ...notice,
      isRead: notice.readBy?.some((id: any) => id.toString() === userId.toString()) || false,
      readBy: undefined // Hide the full array from frontend for privacy/size
    }));
    await redisClient.setEx(cacheKey, 60 * 60 * 24 * 7, JSON.stringify(noticesWithReadStatus));
    res.status(200).json(noticesWithReadStatus);
    return;
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Delete a Notice
// @route   DELETE /api/notices/:id
// @access  Private/Admin
export const deleteNotice = async (req: Request, res: Response): Promise<void> => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      res.status(404).json({ message: "Notice not found" });
      return;
    }

    await Notice.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Notice deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Mark a Notice as Read
// @route   PATCH /api/notices/:id/read
// @access  Private
export const markNoticeAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const noticeId = req.params.id;
    const userId = (req as any).user?._id;

    const notice = await Notice.findById(noticeId);

    if (!notice) {
      res.status(404).json({ message: "Notice not found" });
      return;
    }

    // Add user ID to readBy array if not already present
    if (!notice.readBy.includes(userId)) {
      notice.readBy.push(userId);
      await notice.save();
    }

    res.status(200).json({ message: "Notice marked as read", isRead: true });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};
