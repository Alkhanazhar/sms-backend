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
        const { busNumber, busName, capacity, driver, attendant, route, status, gpsDeviceId, rcExpiry, insuranceExpiry, pollutionExpiry, fitnessExpiry } = req.body;

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

        // If attendant is provided, validate they exist and have "attendant" role
        if (attendant) {
            const attendantUser = await User.findById(attendant);
            if (!attendantUser || attendantUser.role !== "attendant") {
                res.status(400).json({ message: "Invalid attendant. User must have 'attendant' role." });
                return;
            }
        }

        const bus = await Bus.create({
            busNumber,
            busName,
            capacity,
            driver: driver || null,
            attendant: attendant || null,
            route: route || null,
            status,
            gpsDeviceId: gpsDeviceId || null,
            rcExpiry: rcExpiry ? new Date(rcExpiry) : null,
            insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : null,
            pollutionExpiry: pollutionExpiry ? new Date(pollutionExpiry) : null,
            fitnessExpiry: fitnessExpiry ? new Date(fitnessExpiry) : null,
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
                .populate("attendant", "name email")
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
            .populate("attendant", "name email")
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

        const { busNumber, busName, capacity, driver, attendant, route, status, gpsDeviceId, rcExpiry, insuranceExpiry, pollutionExpiry, fitnessExpiry } = req.body;

        // If driver is being changed, validate
        if (driver && driver !== bus.driver?.toString()) {
            const driverUser = await User.findById(driver);
            if (!driverUser || driverUser.role !== "driver") {
                res.status(400).json({ message: "Invalid driver. User must have 'driver' role." });
                return;
            }
        }

        if (attendant && attendant !== (bus as any).attendant?.toString()) {
            const attendantUser = await User.findById(attendant);
            if (!attendantUser || attendantUser.role !== "attendant") {
                res.status(400).json({ message: "Invalid attendant. User must have 'attendant' role." });
                return;
            }
        }

        bus.busNumber = busNumber || bus.busNumber;
        bus.busName = busName || bus.busName;
        bus.capacity = capacity ?? bus.capacity;
        bus.driver = driver || bus.driver;
        (bus as any).attendant = attendant || (bus as any).attendant;
        bus.route = route || bus.route;
        bus.status = status || bus.status;
        (bus as any).gpsDeviceId = gpsDeviceId ?? (bus as any).gpsDeviceId;
        (bus as any).rcExpiry = rcExpiry === undefined ? (bus as any).rcExpiry : (rcExpiry ? new Date(rcExpiry) : null);
        (bus as any).insuranceExpiry = insuranceExpiry === undefined ? (bus as any).insuranceExpiry : (insuranceExpiry ? new Date(insuranceExpiry) : null);
        (bus as any).pollutionExpiry = pollutionExpiry === undefined ? (bus as any).pollutionExpiry : (pollutionExpiry ? new Date(pollutionExpiry) : null);
        (bus as any).fitnessExpiry = fitnessExpiry === undefined ? (bus as any).fitnessExpiry : (fitnessExpiry ? new Date(fitnessExpiry) : null);

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
