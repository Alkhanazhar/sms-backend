import { type Response } from "express";
import Bus from "../models/bus.model.js";
import TransportAssignment from "../models/assignment.model.js";
import TransportTrip from "../models/trip.model.js";
import TripStopStatus from "../models/trip-stop.model.js";
import TripStudentStatus from "../models/trip-student.model.js";
import TransportAlert, { AlertStatus } from "../models/alert.model.js";
import type { AuthRequest } from "../../../middleware/protect.js";

export const getRouteOccupancy = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const busId = req.query.busId as string;
        if (!busId) {
            res.status(400).json({ message: "busId is required" });
            return;
        }

        const bus = await Bus.findById(busId).populate("route", "routeName");
        if (!bus) {
            res.status(404).json({ message: "Bus not found" });
            return;
        }

        const assigned = await TransportAssignment.countDocuments({ bus: bus._id });
        res.json({
            busId: bus._id,
            busName: bus.busName,
            route: bus.route,
            capacity: bus.capacity,
            assigned,
            available: Math.max(0, bus.capacity - assigned),
        });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const getTripLogs = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const busId = req.query.busId as string;
        const from = req.query.from as string;
        const to = req.query.to as string;

        const filter: any = {};
        if (busId) filter.bus = busId;
        if (from || to) {
            filter.serviceDate = {};
            if (from) filter.serviceDate.$gte = new Date(from);
            if (to) filter.serviceDate.$lte = new Date(to);
        }

        const trips = await TransportTrip.find(filter)
            .populate("bus", "busNumber busName")
            .populate("route", "routeName")
            .sort({ serviceDate: -1, createdAt: -1 })
            .limit(200);

        res.json({ trips });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const getStopPunctuality = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tripId = req.query.tripId as string;
        if (!tripId) {
            res.status(400).json({ message: "tripId is required" });
            return;
        }

        const stops = await TripStopStatus.find({ trip: tripId }).sort({ createdAt: 1 });
        res.json({ tripId, stops });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const getComplianceExpiries = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const now = new Date();
        const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const buses = await Bus.find({
            $or: [
                { rcExpiry: { $lte: in30, $ne: null } },
                { insuranceExpiry: { $lte: in30, $ne: null } },
                { pollutionExpiry: { $lte: in30, $ne: null } },
                { fitnessExpiry: { $lte: in30, $ne: null } },
            ],
        }).select("busNumber busName rcExpiry insuranceExpiry pollutionExpiry fitnessExpiry");

        res.json({ windowDays: 30, buses });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const getActiveSOS = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const alerts = await TransportAlert.find({ status: AlertStatus.ACTIVE })
            .populate("bus", "busNumber busName")
            .populate("driver", "name email")
            .sort({ createdAt: -1 });
        res.json({ alerts });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

