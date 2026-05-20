import { type Response } from "express";
import TransportStop from "../models/stop.model.js";
import { logActivity } from "../../../utils/activitylog.js";
import type { AuthRequest } from "../../../middleware/protect.js";

export const createStop = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { stopName, lat, lng, pickupTime, dropTime, landmark, isActive } = req.body;

        if (!stopName || lat == null || lng == null) {
            res.status(400).json({ message: "stopName, lat, and lng are required" });
            return;
        }

        const stop = await TransportStop.create({
            stopName,
            lat,
            lng,
            pickupTime: pickupTime || null,
            dropTime: dropTime || null,
            landmark: landmark || null,
            isActive: isActive ?? true,
        });

        if (req.user) {
            await logActivity({
                userId: req.user._id.toString(),
                action: "Created Transport Stop",
                details: `Created stop: ${stop.stopName}`,
            });
        }

        res.status(201).json({ message: "Stop created", stop });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const getStops = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const q = (req.query.q as string) || "";
        const isActive = req.query.isActive as string;

        const filter: any = {};
        if (q) filter.stopName = { $regex: q, $options: "i" };
        if (isActive === "true") filter.isActive = true;
        if (isActive === "false") filter.isActive = false;

        const stops = await TransportStop.find(filter).sort({ stopName: 1 });
        res.json({ stops });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const updateStop = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const stop = await TransportStop.findById(req.params.id);
        if (!stop) {
            res.status(404).json({ message: "Stop not found" });
            return;
        }

        const { stopName, lat, lng, pickupTime, dropTime, landmark, isActive } = req.body;
        if (stopName != null) stop.stopName = stopName;
        if (lat != null) stop.lat = lat;
        if (lng != null) stop.lng = lng;
        if (pickupTime !== undefined) stop.pickupTime = pickupTime || null;
        if (dropTime !== undefined) stop.dropTime = dropTime || null;
        if (landmark !== undefined) stop.landmark = landmark || null;
        if (isActive !== undefined) stop.isActive = isActive;

        await stop.save();

        res.json({ message: "Stop updated", stop });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

