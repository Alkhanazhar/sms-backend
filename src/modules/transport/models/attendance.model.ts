import mongoose, { Document, Schema } from "mongoose";

export enum BoardingStatus {
    BOARDED = "BOARDED",
    DROPPED = "DROPPED",
}

export interface ITransportAttendance extends Document {
    student: mongoose.Types.ObjectId;
    bus: mongoose.Types.ObjectId;
    route: mongoose.Types.ObjectId;
    status: BoardingStatus;
    date: Date;
}

const transportAttendanceSchema: Schema<ITransportAttendance> = new Schema(
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
        status: {
            type: String,
            enum: Object.values(BoardingStatus),
            required: true,
        },
        date: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

const TransportAttendance = mongoose.model<ITransportAttendance>(
    "TransportAttendance",
    transportAttendanceSchema
);
export default TransportAttendance;
