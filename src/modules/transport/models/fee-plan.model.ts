import mongoose, { Document, Schema } from "mongoose";

export enum FeeCycle {
    MONTHLY = "MONTHLY",
    TERM = "TERM",
}

export enum TripWay {
    ONE_WAY = "ONE_WAY",
    TWO_WAY = "TWO_WAY",
}

export interface ITransportFeePlan extends Document {
    name: string;
    cycle: FeeCycle;
    way: TripWay;
    amount: number;
    isActive: boolean;
}

const transportFeePlanSchema = new Schema<ITransportFeePlan>(
    {
        name: { type: String, required: true, trim: true },
        cycle: { type: String, enum: Object.values(FeeCycle), required: true },
        way: { type: String, enum: Object.values(TripWay), required: true },
        amount: { type: Number, required: true, min: 0 },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

const TransportFeePlan = mongoose.model<ITransportFeePlan>("TransportFeePlan", transportFeePlanSchema);
export default TransportFeePlan;

