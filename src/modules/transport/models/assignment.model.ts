import mongoose, { Document, Schema } from "mongoose";

export interface ITransportAssignment extends Document {
    student: mongoose.Types.ObjectId;
    bus: mongoose.Types.ObjectId;
    route: mongoose.Types.ObjectId;
    stopName: string;
}

const transportAssignmentSchema: Schema<ITransportAssignment> = new Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        bus: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bus",
            required: true,
        },
        route: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "TransportRoute",
            required: true,
        },
        stopName: { type: String, required: true },
    },
    { timestamps: true }
);

// A student can only be assigned to one bus
transportAssignmentSchema.index({ student: 1 }, { unique: true });

const TransportAssignment = mongoose.model<ITransportAssignment>(
    "TransportAssignment",
    transportAssignmentSchema
);
export default TransportAssignment;
