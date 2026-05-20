import { type Response } from "express";
import User from "../../../models/user.model.js";
import type { AuthRequest } from "../../../middleware/protect.js";
import TransportFeePlan, { FeeCycle, TripWay } from "../models/fee-plan.model.js";
import TransportFeeDemand, { DemandStatus } from "../models/fee-demand.model.js";
import TransportPayment, { PaymentMode } from "../models/payment.model.js";

export const createFeePlan = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, cycle, way, amount, isActive } = req.body;

        if (!name || !cycle || !way || amount == null) {
            res.status(400).json({ message: "name, cycle, way, amount are required" });
            return;
        }

        if (!Object.values(FeeCycle).includes(cycle)) {
            res.status(400).json({ message: `Invalid cycle. Must be ${Object.values(FeeCycle).join(", ")}` });
            return;
        }

        if (!Object.values(TripWay).includes(way)) {
            res.status(400).json({ message: `Invalid way. Must be ${Object.values(TripWay).join(", ")}` });
            return;
        }

        const plan = await TransportFeePlan.create({ name, cycle, way, amount, isActive: isActive ?? true });
        res.status(201).json({ message: "Fee plan created", plan });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const getFeePlans = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const plans = await TransportFeePlan.find().sort({ createdAt: -1 });
        res.json({ plans });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const generateDemand = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { studentId, planId, periodKey, dueDate } = req.body as {
            studentId: string;
            planId: string;
            periodKey: string;
            dueDate?: string;
        };

        if (!studentId || !planId || !periodKey) {
            res.status(400).json({ message: "studentId, planId, periodKey are required" });
            return;
        }

        const student = await User.findById(studentId);
        if (!student || student.role !== "student") {
            res.status(400).json({ message: "Invalid studentId" });
            return;
        }

        const plan = await TransportFeePlan.findById(planId);
        if (!plan || !plan.isActive) {
            res.status(400).json({ message: "Invalid/Inactive planId" });
            return;
        }

        const demand = await TransportFeeDemand.create({
            student: studentId,
            plan: planId,
            periodKey,
            amount: plan.amount,
            paidAmount: 0,
            status: DemandStatus.UNPAID,
            dueDate: dueDate ? new Date(dueDate) : null,
        });

        res.status(201).json({ message: "Demand generated", demand });
    } catch (error: any) {
        if (error?.code === 11000) {
            res.status(409).json({ message: "Demand already exists for this student and period" });
            return;
        }
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const recordPayment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { demandId, amount, mode, reference, receivedAt } = req.body as {
            demandId: string;
            amount: number;
            mode?: PaymentMode;
            reference?: string;
            receivedAt?: string;
        };

        if (!demandId || !amount) {
            res.status(400).json({ message: "demandId and amount are required" });
            return;
        }

        const demand = await TransportFeeDemand.findById(demandId);
        if (!demand || demand.status === DemandStatus.CANCELLED) {
            res.status(404).json({ message: "Demand not found" });
            return;
        }

        const payment = await TransportPayment.create({
            demand: demand._id,
            amount,
            mode: mode && Object.values(PaymentMode).includes(mode) ? mode : PaymentMode.CASH,
            reference: reference || null,
            receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
            receivedBy: req.user?._id || null,
        });

        demand.paidAmount = (demand.paidAmount || 0) + amount;
        if (demand.paidAmount >= demand.amount) demand.status = DemandStatus.PAID;
        else if (demand.paidAmount > 0) demand.status = DemandStatus.PARTIAL;
        await demand.save();

        res.status(201).json({ message: "Payment recorded", payment, demand });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const getDefaulters = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const periodKey = req.query.periodKey as string;
        if (!periodKey) {
            res.status(400).json({ message: "periodKey is required" });
            return;
        }

        const demands = await TransportFeeDemand.find({
            periodKey,
            status: { $in: [DemandStatus.UNPAID, DemandStatus.PARTIAL] },
        })
            .populate("student", "name email")
            .populate("plan", "name cycle way amount")
            .sort({ createdAt: -1 });

        res.json({ periodKey, defaulters: demands });
    } catch (error: any) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

