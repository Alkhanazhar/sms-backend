import { type Response } from "express";
import Bus from "../models/bus.model.js";
import TransportRoute from "../models/route.model.js";
import TransportTrip, { TripStatus, TripType } from "../models/trip.model.js";
import TripStopStatus from "../models/trip-stop.model.js";
import TripStudentStatus, { RideStatus } from "../models/trip-student.model.js";
import TransportAssignment from "../models/assignment.model.js";
import { getIO } from "../sockets/transport.socket.js";
import type { AuthRequest } from "../../../middleware/protect.js";

const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

export const startTrip = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { busId, type } = req.body as { busId: string; type: TripType };

        if (!busId || !type) {
            res.status(400).json({ message: "busId and type are required" });
            return;
        }

        if (!Object.values(TripType).includes(type)) {
            res.status(400).json({ message: `Invalid type. Must be ${Object.values(TripType).join(", ")}` });
            return;
        }

        const bus = await Bus.findById(busId);
        if (!bus) {
            res.status(404).json({ message: "Bus not found" });
            return;
        }

        if (req.user?.role === "driver") {
            if (!bus.driver || bus.driver.toString() !== req.user._id.toString()) {
                res.status(403).json({ message: "Unauthorized" });
                return;
            }
        }

        if (!bus.route) {
            res.status(400).json({ message: "Bus is not assigned to any route" });
            return;
        }

        const serviceDate = startOfDay(new Date());

        const trip = await TransportTrip.findOneAndUpdate(
            { bus: bus._id, serviceDate, type },
            {
                $setOnInsert: { route: bus.route, serviceDate, type },
                $set: { status: TripStatus.LIVE, startedAt: new Date(), endedAt: null },
            },
            { upsert: true, new: true }
        );

        const io = getIO();
        io.to(`bus:${busId}`).emit("trip.live", {
            tripId: trip._id,
            busId,
            routeId: trip.route,
            type,
            status: trip.status,
            startedAt: trip.startedAt,
        });

        res.status(201).json({ message: "Trip started", trip });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const endTrip = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const trip = await TransportTrip.findById(req.params.id);
        if (!trip) {
            res.status(404).json({ message: "Trip not found" });
            return;
        }

        const bus = await Bus.findById(trip.bus);
        if (!bus) {
            res.status(404).json({ message: "Bus not found" });
            return;
        }

        if (req.user?.role === "driver") {
            if (!bus.driver || bus.driver.toString() !== req.user._id.toString()) {
                res.status(403).json({ message: "Unauthorized" });
                return;
            }
        }

        trip.status = TripStatus.ENDED;
        trip.endedAt = new Date();
        await trip.save();

        const io = getIO();
        io.to(`bus:${bus._id.toString()}`).emit("trip.ended", {
            tripId: trip._id,
            busId: bus._id,
            endedAt: trip.endedAt,
        });

        res.json({ message: "Trip ended", trip });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const stopArrived = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { tripId, stopName, eta, at } = req.body as { tripId: string; stopName: string; eta?: string; at?: string };
        if (!tripId || !stopName) {
            res.status(400).json({ message: "tripId and stopName are required" });
            return;
        }

        const trip = await TransportTrip.findById(tripId);
        if (!trip) {
            res.status(404).json({ message: "Trip not found" });
            return;
        }

        const bus = await Bus.findById(trip.bus);
        if (!bus) {
            res.status(404).json({ message: "Bus not found" });
            return;
        }

        if (req.user?.role === "driver") {
            if (!bus.driver || bus.driver.toString() !== req.user._id.toString()) {
                res.status(403).json({ message: "Unauthorized" });
                return;
            }
        }

        const record = await TripStopStatus.findOneAndUpdate(
            { trip: trip._id, stopName },
            { $set: { eta: eta ? new Date(eta) : null, arrivedAt: at ? new Date(at) : new Date() } },
            { upsert: true, new: true }
        );

        const io = getIO();
        io.to(`bus:${bus._id.toString()}`).emit("trip.stop", {
            tripId: trip._id,
            stopName,
            eta: record.eta,
            arrivedAt: record.arrivedAt,
            departedAt: record.departedAt,
        });

        res.status(201).json({ message: "Stop arrived", record });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const stopDeparted = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { tripId, stopName, at } = req.body as { tripId: string; stopName: string; at?: string };
        if (!tripId || !stopName) {
            res.status(400).json({ message: "tripId and stopName are required" });
            return;
        }

        const trip = await TransportTrip.findById(tripId);
        if (!trip) {
            res.status(404).json({ message: "Trip not found" });
            return;
        }

        const bus = await Bus.findById(trip.bus);
        if (!bus) {
            res.status(404).json({ message: "Bus not found" });
            return;
        }

        if (req.user?.role === "driver") {
            if (!bus.driver || bus.driver.toString() !== req.user._id.toString()) {
                res.status(403).json({ message: "Unauthorized" });
                return;
            }
        }

        const record = await TripStopStatus.findOneAndUpdate(
            { trip: trip._id, stopName },
            { $set: { departedAt: at ? new Date(at) : new Date() } },
            { upsert: true, new: true }
        );

        const io = getIO();
        io.to(`bus:${bus._id.toString()}`).emit("trip.stop", {
            tripId: trip._id,
            stopName,
            eta: record.eta,
            arrivedAt: record.arrivedAt,
            departedAt: record.departedAt,
        });

        res.status(201).json({ message: "Stop departed", record });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const setStudentRideStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { tripId, studentId, status, stopName, at } = req.body as {
            tripId: string;
            studentId: string;
            status: RideStatus;
            stopName?: string;
            at?: string;
        };

        if (!tripId || !studentId || !status) {
            res.status(400).json({ message: "tripId, studentId, and status are required" });
            return;
        }

        if (!Object.values(RideStatus).includes(status)) {
            res.status(400).json({ message: `Invalid status. Must be ${Object.values(RideStatus).join(", ")}` });
            return;
        }

        const trip = await TransportTrip.findById(tripId);
        if (!trip) {
            res.status(404).json({ message: "Trip not found" });
            return;
        }

        const bus = await Bus.findById(trip.bus);
        if (!bus) {
            res.status(404).json({ message: "Bus not found" });
            return;
        }

        if (req.user?.role === "driver") {
            if (!bus.driver || bus.driver.toString() !== req.user._id.toString()) {
                res.status(403).json({ message: "Unauthorized" });
                return;
            }
        }

        // Ensure student belongs to this bus (assigned)
        const assignment = await TransportAssignment.findOne({ student: studentId, bus: bus._id });
        if (!assignment) {
            res.status(400).json({ message: "Student is not assigned to this bus" });
            return;
        }

        const record = await TripStudentStatus.findOneAndUpdate(
            { trip: trip._id, student: studentId },
            { $set: { status, stopName: stopName || null, at: at ? new Date(at) : new Date() } },
            { upsert: true, new: true }
        );

        const io = getIO();
        const payload = {
            tripId: trip._id,
            busId: bus._id,
            studentId,
            status,
            stopName: record.stopName,
            at: record.at,
        };

        io.to(`student:${studentId}`).emit("student.ride", payload);
        io.to("admin-alerts").emit("student.ride", payload);

        res.status(201).json({ message: "Student ride status updated", record });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const getTripSummary = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const trip = await TransportTrip.findById(req.params.id)
            .populate("bus", "busNumber busName")
            .populate("route", "routeName");
        if (!trip) {
            res.status(404).json({ message: "Trip not found" });
            return;
        }

        const [stops, students] = await Promise.all([
            TripStopStatus.find({ trip: trip._id }).sort({ createdAt: 1 }),
            TripStudentStatus.find({ trip: trip._id }).populate("student", "name email"),
        ]);

        res.json({ trip, stops, students });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

