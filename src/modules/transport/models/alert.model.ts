import mongoose, { Document, Schema } from "mongoose";

export enum AlertStatus {
    ACTIVE = "ACTIVE",
    RESOLVED = "RESOLVED",
}

export interface ITransportAlert extends Document {
    bus: mongoose.Types.ObjectId;
    driver: mongoose.Types.ObjectId;
    route?: mongoose.Types.ObjectId;
    message: string;
    status: AlertStatus;
}

const transportAlertSchema: Schema<ITransportAlert> = new Schema(
    {
        bus: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bus",
            required: true,
        },
        driver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        route: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "TransportRoute",
        },
        message: { type: String, required: true },
        status: {
            type: String,
            enum: Object.values(AlertStatus),
            default: AlertStatus.ACTIVE,
        },
    },
    { timestamps: true }
);

const TransportAlert = mongoose.model<ITransportAlert>(
    "TransportAlert",
    transportAlertSchema
);
export default TransportAlert;
