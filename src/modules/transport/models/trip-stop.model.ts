import mongoose, { Document, Schema } from "mongoose";

export interface ITripStopStatus extends Document {
    trip: mongoose.Types.ObjectId;
    stopName: string;
    eta?: Date | null;
    arrivedAt?: Date | null;
    departedAt?: Date | null;
}

const tripStopStatusSchema = new Schema<ITripStopStatus>(
    {
        trip: { type: mongoose.Schema.Types.ObjectId, ref: "TransportTrip", required: true, index: true },
        stopName: { type: String, required: true },
        eta: { type: Date, default: null },
        arrivedAt: { type: Date, default: null },
        departedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

tripStopStatusSchema.index({ trip: 1, stopName: 1 }, { unique: true });

const TripStopStatus = mongoose.model<ITripStopStatus>("TripStopStatus", tripStopStatusSchema);
export default TripStopStatus;

