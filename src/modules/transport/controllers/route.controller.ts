import { type Response } from "express";
import TransportRoute from "../models/route.model.js";
import { logActivity } from "../../../utils/activitylog.js";
import type { AuthRequest } from "../../../middleware/protect.js";

// @desc    Create a new route
// @route   POST /api/transport/routes
// @access  Private (Admin only)
export const createRoute = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { routeName, estimatedTime, stops } = req.body;

        // Sort stops by order before saving
        const sortedStops = stops
            ? [...stops].sort((a: any, b: any) => a.order - b.order)
            : [];

        const route = await TransportRoute.create({
            routeName,
            estimatedTime,
            stops: sortedStops,
        });

        if (req.user) {
            await logActivity({
                userId: req.user._id.toString(),
                action: "Created Transport Route",
                details: `Created route: ${routeName} with ${sortedStops.length} stops`,
            });
        }

        res.status(201).json({ message: "Route created successfully", route });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// @desc    Get all routes
// @route   GET /api/transport/routes
// @access  Private (Admin, Driver)
export const getRoutes = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const [total, routes] = await Promise.all([
            TransportRoute.countDocuments(),
            TransportRoute.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
        ]);

        res.json({
            routes,
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

// @desc    Get a single route by ID
// @route   GET /api/transport/routes/:id
// @access  Private (Admin, Driver)
export const getRouteById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const route = await TransportRoute.findById(req.params.id);
        if (!route) {
            res.status(404).json({ message: "Route not found" });
            return;
        }
        res.json(route);
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// @desc    Update a route
// @route   PUT /api/transport/routes/:id
// @access  Private (Admin only)
export const updateRoute = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const route = await TransportRoute.findById(req.params.id);
        if (!route) {
            res.status(404).json({ message: "Route not found" });
            return;
        }

        const { routeName, estimatedTime, stops } = req.body;

        route.routeName = routeName || route.routeName;
        route.estimatedTime = estimatedTime ?? route.estimatedTime;

        if (stops) {
            route.stops = [...stops].sort((a: any, b: any) => a.order - b.order);
        }

        const updatedRoute = await route.save();

        if (req.user) {
            await logActivity({
                userId: req.user._id.toString(),
                action: "Updated Transport Route",
                details: `Updated route: ${updatedRoute.routeName}`,
            });
        }

        res.json({ message: "Route updated successfully", route: updatedRoute });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// @desc    Delete a route
// @route   DELETE /api/transport/routes/:id
// @access  Private (Admin only)
export const deleteRoute = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const route = await TransportRoute.findById(req.params.id);
        if (!route) {
            res.status(404).json({ message: "Route not found" });
            return;
        }

        await route.deleteOne();

        if (req.user) {
            await logActivity({
                userId: req.user._id.toString(),
                action: "Deleted Transport Route",
                details: `Deleted route: ${route.routeName}`,
            });
        }

        res.json({ message: "Route deleted successfully" });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};
