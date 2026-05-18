import express from "express";
import { protect, authorize } from "../../../middleware/protect.js";

// Bus controllers
import {
    createBus,
    getBuses,
    getBusById,
    updateBus,
    deleteBus,
} from "../controllers/bus.controller.js";

// Route controllers
import {
    createRoute,
    getRoutes,
    getRouteById,
    updateRoute,
    deleteRoute,
} from "../controllers/route.controller.js";

// Assignment controllers
import {
    assignStudent,
    getAssignments,
    removeAssignment,
} from "../controllers/assignment.controller.js";

// Tracking controllers
import {
    updateBusLocation,
    getLiveStudentTracking,
    triggerSOS,
    resolveSOS,
    getAlerts,
    logStudentAttendance,
    getBusAttendance,
} from "../controllers/tracking.controller.js";

const transportRouter = express.Router();

// ──────────────────────────────────────────────
// Bus APIs (Admin only for CRUD, Driver can view list and single)
// ──────────────────────────────────────────────
transportRouter.post("/buses", protect, authorize(["admin"]), createBus);
transportRouter.get("/buses", protect, authorize(["admin", "driver"]), getBuses);
transportRouter.get("/buses/:id", protect, authorize(["admin", "driver"]), getBusById);
transportRouter.put("/buses/:id", protect, authorize(["admin"]), updateBus);
transportRouter.delete("/buses/:id", protect, authorize(["admin"]), deleteBus);

// ──────────────────────────────────────────────
// Route APIs (Admin for CRUD, Driver can view)
// ──────────────────────────────────────────────
transportRouter.post("/routes", protect, authorize(["admin"]), createRoute);
transportRouter.get("/routes", protect, authorize(["admin", "driver"]), getRoutes);
transportRouter.get("/routes/:id", protect, authorize(["admin", "driver"]), getRouteById);
transportRouter.put("/routes/:id", protect, authorize(["admin"]), updateRoute);
transportRouter.delete("/routes/:id", protect, authorize(["admin"]), deleteRoute);

// ──────────────────────────────────────────────
// Assignment APIs (Admin and Driver can view)
// ──────────────────────────────────────────────
transportRouter.post("/assignments", protect, authorize(["admin"]), assignStudent);
transportRouter.get("/assignments", protect, authorize(["admin", "driver"]), getAssignments);
transportRouter.delete("/assignments/:id", protect, authorize(["admin"]), removeAssignment);

// ──────────────────────────────────────────────
// Live Tracking APIs
// ──────────────────────────────────────────────
// Driver pushes GPS (NO storage — pure Socket.IO broadcast)
transportRouter.post("/location", protect, authorize(["driver"]), updateBusLocation);

// Parent/Student/Admin fetches tracking info (bus details + route, NOT GPS)
transportRouter.get("/live/:studentId", protect, authorize(["parent", "student", "admin"]), getLiveStudentTracking);

// ──────────────────────────────────────────────
// SOS / Emergency Alerts
// ──────────────────────────────────────────────
transportRouter.post("/sos", protect, authorize(["driver"]), triggerSOS);
transportRouter.put("/sos/:id/resolve", protect, authorize(["admin"]), resolveSOS);
transportRouter.get("/sos", protect, authorize(["admin"]), getAlerts);

// ──────────────────────────────────────────────
// Student Attendance (Boarding/Drop)
// ──────────────────────────────────────────────
transportRouter.post("/attendance", protect, authorize(["driver"]), logStudentAttendance);
transportRouter.get("/attendance/:busId", protect, authorize(["admin", "driver"]), getBusAttendance);

export default transportRouter;
