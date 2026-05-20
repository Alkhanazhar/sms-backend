import mongoose, { Document, Schema } from "mongoose";

export enum PaymentMode {
    CASH = "CASH",
    UPI = "UPI",
    BANK = "BANK",
    CARD = "CARD",
    OTHER = "OTHER",
}

export interface ITransportPayment extends Document {
    demand: mongoose.Types.ObjectId;
    amount: number;
    mode: PaymentMode;
    reference?: string | null;
    receivedAt: Date;
    receivedBy?: mongoose.Types.ObjectId | null; // admin/incharge user
}

const transportPaymentSchema = new Schema<ITransportPayment>(
    {
        demand: { type: mongoose.Schema.Types.ObjectId, ref: "TransportFeeDemand", required: true, index: true },
        amount: { type: Number, required: true, min: 0.01 },
        mode: { type: String, enum: Object.values(PaymentMode), default: PaymentMode.CASH },
        reference: { type: String, default: null },
        receivedAt: { type: Date, required: true },
        receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
    { timestamps: true }
);

const TransportPayment = mongoose.model<ITransportPayment>("TransportPayment", transportPaymentSchema);
export default TransportPayment;

