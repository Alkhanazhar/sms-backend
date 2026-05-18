import { type Response } from "express";
import TransportAssignment from "../models/assignment.model.js";
import Bus from "../models/bus.model.js";
import TransportRoute from "../models/route.model.js";
import User from "../../../models/user.model.js";
import { logActivity } from "../../../utils/activitylog.js";
import type { AuthRequest } from "../../../middleware/protect.js";

// @desc    Assign a student to a bus/route/stop
// @route   POST /api/transport/assignments
// @access  Private (Admin only)
export const assignStudent = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { student, bus, route, stopName } = req.body;

        // Validate student exists and has "student" role
        const studentUser = await User.findById(student);
        if (!studentUser || studentUser.role !== "student") {
            res.status(400).json({ message: "Invalid student. User must have 'student' role." });
            return;
        }

        // Validate bus exists
        const busDoc = await Bus.findById(bus);
        if (!busDoc) {
            res.status(400).json({ message: "Bus not found." });
            return;
        }

        // Validate route exists
        const routeDoc = await TransportRoute.findById(route);
        if (!routeDoc) {
            res.status(400).json({ message: "Route not found." });
            return;
        }

        // Validate stop exists in the route
        const stopExists = routeDoc.stops.some((s) => s.stopName === stopName);
        if (!stopExists) {
            res.status(400).json({ message: `Stop '${stopName}' not found in route '${routeDoc.routeName}'.` });
            return;
        }

        // Check if student is already assigned (unique index will also catch this)
        const existing = await TransportAssignment.findOne({ student });
        if (existing) {
            res.status(400).json({
                message: "Student is already assigned to a bus. Remove the existing assignment first.",
            });
            return;
        }

        const assignment = await TransportAssignment.create({
            student,
            bus,
            route,
            stopName,
        });

        if (req.user) {
            await logActivity({
                userId: req.user._id.toString(),
                action: "Assigned Student to Bus",
                details: `Assigned ${studentUser.name} to bus ${busDoc.busName} at stop ${stopName}`,
            });
        }

        res.status(201).json({ message: "Student assigned successfully", assignment });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// @desc    Get all assignments (with filters)
// @route   GET /api/transport/assignments
// @access  Private (Admin)
export const getAssignments = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;
        const busId = req.query.bus as string;

        const filter: any = {};
        if (busId) filter.bus = busId;

        const [total, assignments] = await Promise.all([
            TransportAssignment.countDocuments(filter),
            TransportAssignment.find(filter)
                .populate("student", "name email")
                .populate("bus", "busNumber busName")
                .populate("route", "routeName")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
        ]);

        res.json({
            assignments,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit,
            },
        });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// @desc    Remove a student assignment
// @route   DELETE /api/transport/assignments/:id
// @access  Private (Admin only)
export const removeAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const assignment = await TransportAssignment.findById(req.params.id);
        if (!assignment) {
            res.status(404).json({ message: "Assignment not found" });
            return;
        }

        await assignment.deleteOne();

        if (req.user) {
            await logActivity({
                userId: req.user._id.toString(),
                action: "Removed Student Assignment",
                details: `Removed transport assignment ${req.params.id}`,
            });
        }

        res.json({ message: "Assignment removed successfully" });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};
