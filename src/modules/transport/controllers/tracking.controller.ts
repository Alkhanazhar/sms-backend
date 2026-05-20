import { type Response } from "express";
import Bus from "../models/bus.model.js";
import TransportAssignment from "../models/assignment.model.js";
import TransportAlert, { AlertStatus } from "../models/alert.model.js";
import TransportAttendance, { BoardingStatus } from "../models/attendance.model.js";
import { getIO } from "../sockets/transport.socket.js";
import { logActivity } from "../../../utils/activitylog.js";
import type { AuthRequest } from "../../../middleware/protect.js";
import redisClient from "../../../config/redis.js";

// ============================================================
// LIVE GPS TRACKING
// GPS data is NEVER stored anywhere — not in MongoDB, not in
// Redis, not on any network. It exists ONLY as a Socket.IO
// event emitted in real-time to connected clients.
// ============================================================

const MAX_SPEED_KMH = 140; // fake GPS detection threshold
const MAX_ACCURACY_METERS = 100; // GPS accuracy threshold
const LAST_LOCATION_TTL_SECONDS = 60 * 60; // 1 hour

// @desc    Update bus location (real-time only, no storage)
// @route   POST /api/transport/location
// @access  Private (Driver only)
export const updateBusLocation = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { busId, lat, lng, speed, accuracy } = req.body;

        if (!busId || lat == null || lng == null) {
            res.status(400).json({ message: "busId, lat, and lng are required" });
            return;
        }

        // Validate the bus exists and this driver is assigned to it
        const bus = await Bus.findById(busId);
        if (!bus) {
            res.status(404).json({ message: "Bus not found" });
            return;
        }

        if (!bus.driver || bus.driver.toString() !== req.user!._id.toString()) {
            res.status(403).json({ message: "Unauthorized. You are not the assigned driver for this bus." });
            return;
        }

        // GPS accuracy check — discard noisy readings
        if (accuracy && accuracy > MAX_ACCURACY_METERS) {
            res.status(200).json({
                success: false,
                message: "GPS accuracy too low, update discarded",
            });
            return;
        }

        // Fake GPS detection — flag suspiciously high speed
        if (speed && speed > MAX_SPEED_KMH) {
            console.warn(`[Transport] Fake GPS suspected for bus ${busId} — speed: ${speed} km/h`);

            // Emit warning to admin room
            const io = getIO();
            io.to("admin-alerts").emit("driver-flagged", {
                busId,
                driverId: req.user!._id,
                speed,
                message: `Suspicious speed detected: ${speed} km/h`,
                timestamp: new Date(),
            });

            res.status(200).json({
                success: false,
                message: "Suspicious speed detected, driver flagged",
            });
            return;
        }

        // *** NO DATABASE WRITE — Pure real-time emission ***
        const io = getIO();
        const locationPayload = {
            busId,
            lat,
            lng,
            speed: speed || 0,
            timestamp: new Date(),
        };

        // Cache last-known location for late-joining clients (short TTL)
        // NOTE: This is not a full history; it is only the most recent point.
        try {
            await redisClient.set(
                `transport:bus:${busId}:lastLocation`,
                JSON.stringify(locationPayload),
                { EX: LAST_LOCATION_TTL_SECONDS }
            );
        } catch (e) {
            // Best-effort cache; do not fail the request if Redis is unavailable.
            console.warn("[Transport] Failed to cache lastLocation in Redis:", (e as Error)?.message || e);
        }

        // Emit to all clients watching this specific bus
        io.to(`bus:${busId}`).emit("bus-location-updated", locationPayload);
        // ProSchool360-style event alias (new clients should prefer this)
        io.to(`bus:${busId}`).emit("vehicle.location", locationPayload);

        res.json({ success: true, message: "Location broadcast sent" });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// @desc    Get last-known cached location for a bus (Redis)
// @route   GET /api/transport/location/:busId/last
// @access  Private (Admin, Driver, Parent, Student)
export const getLastBusLocation = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { busId } = req.params;

        const bus = await Bus.findById(busId);
        if (!bus) {
            res.status(404).json({ message: "Bus not found" });
            return;
        }

        // Driver can only read their assigned bus
        if (req.user?.role === "driver") {
            if (!bus.driver || bus.driver.toString() !== req.user._id.toString()) {
                res.status(403).json({ message: "Unauthorized" });
                return;
            }
        }

        const raw = await redisClient.get(`transport:bus:${busId}:lastLocation`);
        if (!raw) {
            res.status(404).json({ message: "No live location available" });
            return;
        }

        res.json({ busId, lastLocation: JSON.parse(raw) });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// @desc    Get live tracking info for a student (bus details + route)
// @route   GET /api/transport/live/:studentId
// @access  Private (Parent, Student, Admin)
export const getLiveStudentTracking = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { studentId } = req.params;

        // Find the student's transport assignment
        const assignment = await TransportAssignment.findOne({ student: studentId })
            .populate("bus", "busNumber busName status driver")
            .populate("route", "routeName estimatedTime stops");

        if (!assignment) {
            res.status(404).json({ message: "No transport assignment found for this student" });
            return;
        }

        // Populate driver details from the bus
        const bus = await Bus.findById(assignment.bus)
            .populate("driver", "name email");

        res.json({
            assignment: {
                stopName: assignment.stopName,
                bus: bus,
                route: assignment.route,
            },
            // NOTE: Live GPS coordinates are NOT returned here.
            // Clients must connect via Socket.IO and join the bus room
            // to receive real-time location updates.
            instructions: {
                liveLocation: "Connect to Socket.IO and emit 'join-bus-room' with the busId to receive live GPS updates.",
                attendance: "Connect to Socket.IO and emit 'join-student-room' with the studentId to receive boarding/drop notifications.",
                lastKnownLocation: "Optionally call GET /api/transport/location/:busId/last for last-known cached location (Redis, short TTL).",
            },
        });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// ============================================================
// SOS / EMERGENCY ALERTS
// ============================================================

// @desc    Driver triggers an SOS emergency alert
// @route   POST /api/transport/sos
// @access  Private (Driver only)
export const triggerSOS = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { busId, message } = req.body;

        const bus = await Bus.findById(busId);
        if (!bus) {
            res.status(404).json({ message: "Bus not found" });
            return;
        }

        if (!bus.driver || bus.driver.toString() !== req.user!._id.toString()) {
            res.status(403).json({ message: "Unauthorized" });
            return;
        }

        // Save alert to DB (alerts ARE persisted — only GPS is not)
        const alert = await TransportAlert.create({
            bus: busId,
            driver: req.user!._id,
            route: bus.route || undefined,
            message: message || "Emergency SOS triggered by driver",
            status: AlertStatus.ACTIVE,
        });

        // Emit real-time SOS to admin room
        const io = getIO();
        io.to("admin-alerts").emit("sos-alert", {
            alertId: alert._id,
            busId,
            busName: bus.busName,
            driverId: req.user!._id,
            driverName: req.user!.name,
            message: alert.message,
            timestamp: new Date(),
        });

        res.status(201).json({ message: "SOS alert sent", alert });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// @desc    Admin resolves an SOS alert
// @route   PUT /api/transport/sos/:id/resolve
// @access  Private (Admin only)
export const resolveSOS = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const alert = await TransportAlert.findById(req.params.id);
        if (!alert) {
            res.status(404).json({ message: "Alert not found" });
            return;
        }

        alert.status = AlertStatus.RESOLVED;
        await alert.save();

        if (req.user) {
            await logActivity({
                userId: req.user._id.toString(),
                action: "Resolved SOS Alert",
                details: `Resolved SOS alert for bus ${alert.bus}`,
            });
        }

        res.json({ message: "SOS alert resolved", alert });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// @desc    Get all active SOS alerts
// @route   GET /api/transport/sos
// @access  Private (Admin only)
export const getAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const status = req.query.status as string;
        const filter: any = {};
        if (status) filter.status = status;

        const alerts = await TransportAlert.find(filter)
            .populate("bus", "busNumber busName")
            .populate("driver", "name email")
            .populate("route", "routeName")
            .sort({ createdAt: -1 });

        res.json({ alerts });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// ============================================================
// STUDENT ATTENDANCE (Boarding / Drop)
// ============================================================

// @desc    Log student boarding or drop
// @route   POST /api/transport/attendance
// @access  Private (Driver only)
export const logStudentAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { studentId, busId, routeId, status } = req.body;

        if (!studentId || !busId || !routeId || !status) {
            res.status(400).json({ message: "studentId, busId, routeId, and status are required" });
            return;
        }

        if (!Object.values(BoardingStatus).includes(status)) {
            res.status(400).json({ message: `Invalid status. Must be one of: ${Object.values(BoardingStatus).join(", ")}` });
            return;
        }

        // Validate bus ownership
        const bus = await Bus.findById(busId);
        if (!bus || !bus.driver || bus.driver.toString() !== req.user!._id.toString()) {
            res.status(403).json({ message: "Unauthorized" });
            return;
        }

        const record = await TransportAttendance.create({
            student: studentId,
            bus: busId,
            route: routeId,
            status,
        });

        // Emit boarding/drop notification to the student's parent room
        const io = getIO();

        // Find the student's assignment to get parent context
        const assignment = await TransportAssignment.findOne({ student: studentId })
            .populate("student", "name");

        const studentName = (assignment?.student as any)?.name || "Student";

        const notificationPayload = {
            studentId,
            studentName,
            busId,
            busName: bus.busName,
            status,
            timestamp: new Date(),
            message: status === BoardingStatus.BOARDED
                ? `${studentName} has boarded bus ${bus.busName}`
                : `${studentName} has been dropped safely from bus ${bus.busName}`,
        };

        // Notify the student's room (parent app should join `student:{studentId}`)
        io.to(`student:${studentId}`).emit("student-attendance-update", notificationPayload);
        // Backward-compatible alias (older clients may have joined `user:{studentId}`)
        io.to(`user:${studentId}`).emit("student-attendance-update", notificationPayload);

        // Also notify admin
        io.to("admin-alerts").emit("student-attendance-update", notificationPayload);

        res.status(201).json({ message: "Attendance logged", record });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// @desc    Get attendance records for a bus (today)
// @route   GET /api/transport/attendance/:busId
// @access  Private (Admin, Driver)
export const getBusAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { busId } = req.params;

        // Get today's records
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const records = await TransportAttendance.find({
            bus: busId,
            date: { $gte: startOfDay },
        })
            .populate("student", "name email")
            .sort({ createdAt: -1 });

        res.json({ records });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};
