import { type Request, type Response } from "express";
import User from "../models/user.model.js";
import { generateToken } from "../utils/generateToken.js";
import { logActivity } from "../utils/activitylog.js";
import type { AuthRequest } from "../middleware/protect.js";
import redisClient, { clearCache } from "../config/redis.js";
import subjectModel from "../models/subject.model.js";

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Private (Admin & Teacher only)
export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            name,
            email,
            password,
            role,
            studentClass,
            teacherSubject,
            isActive,
        } = req.body;

        // check if user already exists
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            res.status(400).json({ message: "User already exists" });
            return;
        }

        // create user
        const newUser = await User.create({
            name,
            email,
            password,
            role,
            studentClass,
            teacherSubject,
            isActive,
        });
        if (teacherSubject && Array.isArray(teacherSubject)) {
            await Promise.all(
                teacherSubject.map(async (sub: string) => {
                    await subjectModel.findByIdAndUpdate(sub, {
                        $addToSet: { teacher: newUser._id }
                    })
                })
            );
            // await redisClient.del(`subjects:${JSON.stringify({ teacher: newUser._id })}:page=${page}:limit=${limit}`);
        }
        if (newUser) {
            // we don't have req.user type defined, so we use a type assertion
            if ((req as any).user) {
                await logActivity({
                    userId: (req as any).user._id,
                    action: "Registered User",
                    details: `Registered user with email: ${newUser.email}`,
                });
            }
            await clearCache("users");
            res.status(201).json({
                _id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                isActive: newUser.isActive,
                studentClass: newUser.studentClass,
                teacherSubject: newUser.teacherSubject,
                message: "User registered successfully",
            });
            return;
        } else {
            res.status(400).json({ message: "Invalid user data" });
        }
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        // check if user exists and password matches
        if (user && (await user.matchPassword(password))) {
            // generate token
            generateToken(user.id.toString(), res);
            res.json(user);
        } else {
            res.status(401).json({ message: "Invalid email or password" });
        }
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

// @desc    Update user (Admin)
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;
            user.role = req.body.role || user.role;
            user.isActive =
                req.body.isActive !== undefined ? req.body.isActive : user.isActive;
            user.studentClass = req.body.studentClass || user.studentClass;
            user.teacherSubject = req.body.teacherSubject || user.teacherSubject;
            if (req.body.password) {
                user.password = req.body.password;
            }
            const updatedUser = await user.save();
            // up to here it's working
            if ((req as any).user) {
                // here we passing userId as objectId instead of string
                // we also have other problem
                await logActivity({
                    userId: (req as any).user._id.toString(),
                    action: "Updated User",
                    details: `Updated user with email: ${updatedUser.email}`,
                });
            }
            // we are not returning something here (res.json) so the client is waiting forever
            // sorry about that!
            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                isActive: updatedUser.isActive,
                studentClass: updatedUser.studentClass,
                teacherSubject: updatedUser.teacherSubject,
                message: "User updated successfully",
            });
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

// @desc    Get all users (With Pagination & Filtering)
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        // 1. Parse Query Params safely
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const role = req.query.role as string;
        const search = req.query.search as string; // Optional: Add search later

        const skip = (page - 1) * limit;

        // 2. Build Filter Object
        const filter: any = {};

        if (role && role !== "all" && role !== "") {
            filter.role = role;
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }
        const cacheKey = `users:${JSON.stringify(filter)}:page=${page}:limit=${limit}`;
        const cachedUsers = await redisClient.get(cacheKey);
        if (cachedUsers) {
            res.json(JSON.parse(cachedUsers));
            return
        }
        console.log(filter)
        // 3. Fetch Users with Pagination & Filtering
        const [total, users] = await Promise.all([
            User.countDocuments(filter), // Get total count for pagination logic
            User.find(filter)
                .select("-password")
                .populate("studentClass", "_id name section") // Added section for context
                .populate("teacherSubject", "_id name section code")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
        ]);
        console.log(users, "users")


        await redisClient.setEx(cacheKey, 60 * 5, JSON.stringify({
            users,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit,
            },
        }));

        // 4. Send Response
        res.json({
            users,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit,
            },
        });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

// next
// @desc    Delete user (Admin)
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            await user.deleteOne();
            if ((req as any).user) {
                // here we passing userId as objectId instead of string
                // we also have other problem
                await logActivity({
                    userId: (req as any).user._id.toString(),
                    action: "Deleted User",
                    details: `Deleted user with email: ${user.email}`,
                });
            }
            res.json({ message: "User deleted successfully" });
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

// @desc    Get user profile (via cookie)
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user) {
            res.json({
                user: {
                    _id: req.user._id,
                    name: req.user.name,
                    email: req.user.email,
                    role: req.user.role,
                },
            });
        } else {
            res.status(401).json({ message: "Not authorized" });
        }
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};

// @desc    Logout user / clear cookie
// @route   POST /api/users/logout
// @access  Public
export const logoutUser = async (req: Request, res: Response) => {
    try {
        res.cookie("jwt", "", {
            httpOnly: true,
            expires: new Date(0), //expire the cookie immediately
        });
        res.json({ message: "Logged out successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};
