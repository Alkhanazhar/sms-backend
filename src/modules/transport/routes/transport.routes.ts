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
    getLastBusLocation,
    getLiveStudentTracking,
    triggerSOS,
    resolveSOS,
    getAlerts,
    logStudentAttendance,
    getBusAttendance,
} from "../controllers/tracking.controller.js";

import { createStop, getStops, updateStop } from "../controllers/stop.controller.js";
import {
    startTrip,
    endTrip,
    stopArrived,
    stopDeparted,
    setStudentRideStatus,
    getTripSummary,
} from "../controllers/trip.controller.js";

import {
    createFeePlan,
    getFeePlans,
    generateDemand,
    recordPayment,
    getDefaulters,
} from "../controllers/fees.controller.js";

import {
    getRouteOccupancy,
    getTripLogs,
    getStopPunctuality,
    getComplianceExpiries,
    getActiveSOS,
} from "../controllers/reports.controller.js";

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
transportRouter.get("/location/:busId/last", protect, authorize(["admin", "driver", "parent", "student"]), getLastBusLocation);

// Parent/Student/Admin fetches tracking info (bus details + route, NOT GPS)
transportRouter.get("/live/:studentId", protect, authorize(["parent", "student", "admin"]), getLiveStudentTracking);

// Stops master
transportRouter.post("/stops", protect, authorize(["admin", "transport_incharge"]), createStop);
transportRouter.get("/stops", protect, authorize(["admin", "transport_incharge", "driver"]), getStops);
transportRouter.put("/stops/:id", protect, authorize(["admin", "transport_incharge"]), updateStop);

// Trip operations (daily run)
transportRouter.post("/trips/start", protect, authorize(["admin", "transport_incharge", "driver"]), startTrip);
transportRouter.put("/trips/:id/end", protect, authorize(["admin", "transport_incharge", "driver"]), endTrip);
transportRouter.post("/trips/stop-arrived", protect, authorize(["admin", "transport_incharge", "driver"]), stopArrived);
transportRouter.post("/trips/stop-departed", protect, authorize(["admin", "transport_incharge", "driver"]), stopDeparted);
transportRouter.post("/trips/student-status", protect, authorize(["admin", "transport_incharge", "driver"]), setStudentRideStatus);
transportRouter.get("/trips/:id/summary", protect, authorize(["admin", "transport_incharge", "driver"]), getTripSummary);

// Fees (manual ledger-style; no payment gateway integration)
transportRouter.post("/fees/plans", protect, authorize(["admin", "transport_incharge"]), createFeePlan);
transportRouter.get("/fees/plans", protect, authorize(["admin", "transport_incharge"]), getFeePlans);
transportRouter.post("/fees/demands", protect, authorize(["admin", "transport_incharge"]), generateDemand);
transportRouter.post("/fees/payments", protect, authorize(["admin", "transport_incharge"]), recordPayment);
transportRouter.get("/fees/defaulters", protect, authorize(["admin", "transport_incharge"]), getDefaulters);

// Reports
transportRouter.get("/reports/occupancy", protect, authorize(["admin", "transport_incharge"]), getRouteOccupancy);
transportRouter.get("/reports/trips", protect, authorize(["admin", "transport_incharge"]), getTripLogs);
transportRouter.get("/reports/punctuality", protect, authorize(["admin", "transport_incharge"]), getStopPunctuality);
transportRouter.get("/reports/compliance-expiries", protect, authorize(["admin", "transport_incharge"]), getComplianceExpiries);
transportRouter.get("/reports/sos-active", protect, authorize(["admin", "transport_incharge"]), getActiveSOS);

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
