import mongoose, { Document, Schema } from "mongoose";

export interface ITransportStop extends Document {
    stopName: string;
    lat: number;
    lng: number;
    pickupTime?: string | null; // e.g. "07:30 AM"
    dropTime?: string | null; // e.g. "02:30 PM"
    landmark?: string | null;
    isActive: boolean;
}

const transportStopSchema = new Schema<ITransportStop>(
    {
        stopName: { type: String, required: true, trim: true },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        pickupTime: { type: String, default: null },
        dropTime: { type: String, default: null },
        landmark: { type: String, default: null },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

transportStopSchema.index({ stopName: 1 });

const TransportStop = mongoose.model<ITransportStop>("TransportStop", transportStopSchema);
export default TransportStop;

