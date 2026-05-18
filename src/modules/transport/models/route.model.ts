import mongoose, { Document, Schema } from "mongoose";

export interface IStop {
    stopName: string;
    lat: number;
    lng: number;
    order: number;
    arrivalTime: string; // e.g. "07:30 AM"
}

export interface ITransportRoute extends Document {
    routeName: string;
    estimatedTime: number; // minutes
    stops: IStop[];
}

const stopSchema = new Schema<IStop>(
    {
        stopName: { type: String, required: true },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        order: { type: Number, required: true },
        arrivalTime: { type: String, required: true },
    },
    { _id: false }
);

const transportRouteSchema: Schema<ITransportRoute> = new Schema(
    {
        routeName: { type: String, required: true },
        estimatedTime: { type: Number, required: true },
        stops: { type: [stopSchema], default: [] },
    },
    { timestamps: true }
);

const TransportRoute = mongoose.model<ITransportRoute>("TransportRoute", transportRouteSchema);
export default TransportRoute;
