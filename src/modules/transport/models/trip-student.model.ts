import mongoose, { Document, Schema } from "mongoose";

export enum RideStatus {
    BOARDED = "BOARDED",
    DROPPED = "DROPPED",
    ABSENT = "ABSENT",
    NO_SHOW = "NO_SHOW",
}

export interface ITripStudentStatus extends Document {
    trip: mongoose.Types.ObjectId;
    student: mongoose.Types.ObjectId;
    status: RideStatus;
    stopName?: string | null;
    at: Date;
}

const tripStudentStatusSchema = new Schema<ITripStudentStatus>(
    {
        trip: { type: mongoose.Schema.Types.ObjectId, ref: "TransportTrip", required: true, index: true },
        student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        status: { type: String, enum: Object.values(RideStatus), required: true },
        stopName: { type: String, default: null },
        at: { type: Date, required: true },
    },
    { timestamps: true }
);

tripStudentStatusSchema.index({ trip: 1, student: 1 }, { unique: true });

const TripStudentStatus = mongoose.model<ITripStudentStatus>("TripStudentStatus", tripStudentStatusSchema);
export default TripStudentStatus;

