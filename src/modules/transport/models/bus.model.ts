import mongoose, { Document, Schema } from "mongoose";

export enum BusStatus {
    ACTIVE = "ACTIVE",
    OFFLINE = "OFFLINE",
    MAINTENANCE = "MAINTENANCE",
}

export interface IBus extends Document {
    busNumber: string;
    busName: string;
    capacity: number;
    driver?: mongoose.Types.ObjectId;
    route?: mongoose.Types.ObjectId;
    status: BusStatus;
}

const busSchema: Schema<IBus> = new Schema(
    {
        busNumber: { type: String, required: true, unique: true },
        busName: { type: String, required: true },
        capacity: { type: Number, required: true },
        driver: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        route: { type: mongoose.Schema.Types.ObjectId, ref: "TransportRoute", default: null },
        status: {
            type: String,
            enum: Object.values(BusStatus),
            default: BusStatus.OFFLINE,
        },
        // NOTE: No currentLocation field — live GPS data is NEVER stored in the DB.
        // It flows purely through Socket.IO in real-time.
    },
    { timestamps: true }
);

const Bus = mongoose.model<IBus>("Bus", busSchema);
export default Bus;
