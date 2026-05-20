import mongoose, { Document, Schema } from "mongoose";

export enum TripType {
    PICKUP = "PICKUP",
    DROP = "DROP",
}

export enum TripStatus {
    PLANNED = "PLANNED",
    LIVE = "LIVE",
    ENDED = "ENDED",
}

export interface ITransportTrip extends Document {
    bus: mongoose.Types.ObjectId;
    route: mongoose.Types.ObjectId;
    type: TripType;
    serviceDate: Date; // day (00:00)
    startedAt?: Date | null;
    endedAt?: Date | null;
    status: TripStatus;
}

const transportTripSchema = new Schema<ITransportTrip>(
    {
        bus: { type: mongoose.Schema.Types.ObjectId, ref: "Bus", required: true },
        route: { type: mongoose.Schema.Types.ObjectId, ref: "TransportRoute", required: true },
        type: { type: String, enum: Object.values(TripType), required: true },
        serviceDate: { type: Date, required: true },
        startedAt: { type: Date, default: null },
        endedAt: { type: Date, default: null },
        status: { type: String, enum: Object.values(TripStatus), default: TripStatus.PLANNED },
    },
    { timestamps: true }
);

transportTripSchema.index({ bus: 1, serviceDate: 1, type: 1 }, { unique: true });

const TransportTrip = mongoose.model<ITransportTrip>("TransportTrip", transportTripSchema);
export default TransportTrip;

