import mongoose, { Document, Schema } from "mongoose";

export enum DemandStatus {
    UNPAID = "UNPAID",
    PARTIAL = "PARTIAL",
    PAID = "PAID",
    CANCELLED = "CANCELLED",
}

export interface ITransportFeeDemand extends Document {
    student: mongoose.Types.ObjectId;
    plan: mongoose.Types.ObjectId;
    periodKey: string; // e.g. "2026-05" or "TERM-1-2026"
    amount: number;
    paidAmount: number;
    status: DemandStatus;
    dueDate?: Date | null;
}

const transportFeeDemandSchema = new Schema<ITransportFeeDemand>(
    {
        student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        plan: { type: mongoose.Schema.Types.ObjectId, ref: "TransportFeePlan", required: true },
        periodKey: { type: String, required: true },
        amount: { type: Number, required: true, min: 0 },
        paidAmount: { type: Number, required: true, min: 0, default: 0 },
        status: { type: String, enum: Object.values(DemandStatus), default: DemandStatus.UNPAID },
        dueDate: { type: Date, default: null },
    },
    { timestamps: true }
);

transportFeeDemandSchema.index({ student: 1, periodKey: 1 }, { unique: true });

const TransportFeeDemand = mongoose.model<ITransportFeeDemand>("TransportFeeDemand", transportFeeDemandSchema);
export default TransportFeeDemand;

