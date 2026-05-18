import { type Response } from "express";
import Bus from "../models/bus.model.js";
import User from "../../../models/user.model.js";
import { logActivity } from "../../../utils/activitylog.js";
import type { AuthRequest } from "../../../middleware/protect.js";

// @desc    Create a new bus
// @route   POST /api/transport/buses
// @access  Private (Admin only)
export const createBus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { busNumber, busName, capacity, driver, route, status } = req.body;

        // Check if bus number already exists
        const existing = await Bus.findOne({ busNumber });
        if (existing) {
            res.status(400).json({ message: "Bus with this number already exists" });
            return;
        }

        // If driver is provided, validate they exist and have "driver" role
        if (driver) {
            const driverUser = await User.findById(driver);
            if (!driverUser || driverUser.role !== "driver") {
                res.status(400).json({ message: "Invalid driver. User must have 'driver' role." });
                return;
            }
        }

        const bus = await Bus.create({
            busNumber,
            busName,
            capacity,
            driver: driver || null,
            route: route || null,
            status,
        });

        if (req.user) {
            await logActivity({
                userId: req.user._id.toString(),
                action: "Created Bus",
                details: `Created bus: ${busName} (${busNumber})`,
            });
        }

        res.status(201).json({ message: "Bus created successfully", bus });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// @desc    Get all buses
// @route   GET /api/transport/buses
// @access  Private (Admin)
export const getBuses = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;
        const status = req.query.status as string;

        const filter: any = {};
        if (status && status !== "all") {
            filter.status = status;
        }

        const [total, buses] = await Promise.all([
            Bus.countDocuments(filter),
            Bus.find(filter)
                .populate("driver", "name email")
                .populate("route", "routeName estimatedTime")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
        ]);

        res.json({
            buses,
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

// @desc    Get single bus by ID
// @route   GET /api/transport/buses/:id
// @access  Private (Admin)
export const getBusById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const bus = await Bus.findById(req.params.id)
            .populate("driver", "name email")
            .populate("route", "routeName estimatedTime stops");

        if (!bus) {
            res.status(404).json({ message: "Bus not found" });
            return;
        }

        res.json(bus);
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// @desc    Update a bus
// @route   PUT /api/transport/buses/:id
// @access  Private (Admin only)
export const updateBus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const bus = await Bus.findById(req.params.id);
        if (!bus) {
            res.status(404).json({ message: "Bus not found" });
            return;
        }

        const { busNumber, busName, capacity, driver, route, status } = req.body;

        // If driver is being changed, validate
        if (driver && driver !== bus.driver?.toString()) {
            const driverUser = await User.findById(driver);
            if (!driverUser || driverUser.role !== "driver") {
                res.status(400).json({ message: "Invalid driver. User must have 'driver' role." });
                return;
            }
        }

        bus.busNumber = busNumber || bus.busNumber;
        bus.busName = busName || bus.busName;
        bus.capacity = capacity ?? bus.capacity;
        bus.driver = driver || bus.driver;
        bus.route = route || bus.route;
        bus.status = status || bus.status;

        const updatedBus = await bus.save();

        if (req.user) {
            await logActivity({
                userId: req.user._id.toString(),
                action: "Updated Bus",
                details: `Updated bus: ${updatedBus.busName} (${updatedBus.busNumber})`,
            });
        }

        res.json({ message: "Bus updated successfully", bus: updatedBus });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// @desc    Delete a bus
// @route   DELETE /api/transport/buses/:id
// @access  Private (Admin only)
export const deleteBus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const bus = await Bus.findById(req.params.id);
        if (!bus) {
            res.status(404).json({ message: "Bus not found" });
            return;
        }

        await bus.deleteOne();

        if (req.user) {
            await logActivity({
                userId: req.user._id.toString(),
                action: "Deleted Bus",
                details: `Deleted bus: ${bus.busName} (${bus.busNumber})`,
            });
        }

        res.json({ message: "Bus deleted successfully" });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};
