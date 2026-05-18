import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";

let io: Server;

/**
 * Initialize Socket.IO server for transport real-time events.
 * GPS location data is NEVER stored — it exists only as live Socket.IO events.
 */
export const initTransportSocket = (server: HttpServer): Server => {
    io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || "*",
            credentials: true,
        },
    });

    io.on("connection", (socket: Socket) => {
        console.log(`[Transport Socket] Connected: ${socket.id}`);

        // Parents/admins join a specific bus room to receive live GPS updates
        socket.on("join-bus-room", (busId: string) => {
            socket.join(`bus:${busId}`);
            console.log(`[Transport Socket] ${socket.id} joined bus:${busId}`);
        });

        // Leave a bus room
        socket.on("leave-bus-room", (busId: string) => {
            socket.leave(`bus:${busId}`);
            console.log(`[Transport Socket] ${socket.id} left bus:${busId}`);
        });

        // Parents join their own room for direct notifications (boarding/drop alerts)
        socket.on("join-user-room", (userId: string) => {
            socket.join(`user:${userId}`);
            console.log(`[Transport Socket] ${socket.id} joined user:${userId}`);
        });

        // Admin joins global alert room for SOS notifications
        socket.on("join-admin-room", () => {
            socket.join("admin-alerts");
            console.log(`[Transport Socket] ${socket.id} joined admin-alerts`);
        });

        socket.on("disconnect", () => {
            console.log(`[Transport Socket] Disconnected: ${socket.id}`);
        });
    });

    return io;
};

/**
 * Get the Socket.IO server instance.
 * Throws if called before initTransportSocket.
 */
export const getIO = (): Server => {
    if (!io) {
        throw new Error("Socket.IO has not been initialized. Call initTransportSocket first.");
    }
    return io;
};
