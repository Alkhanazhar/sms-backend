import cookieParser from "cookie-parser";
import express, {
    NextFunction,
    type Application,
    type Request,
    type Response,
} from "express";
import helmet from "helmet";
import cron from "node-cron";
import morgan from "morgan";
import cors from "cors";
import { serve } from "inngest/express";
import "dotenv/config"
import connectDb from "./config/connect-db.js";
const app: Application = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;
import userRoutes from "./routes/user.routes.js";
import academicYearRouter from "./routes/academic.routes.js";
import classRouter from "./routes/class.routes.js";
import LogsRouter from "./routes/activitylog.routes.js";
import subjectRouter from "./routes/subject.routes.js";
import timeRouter from "./routes/timetable.route.js";
import examRouter from "./routes/exam.route.js";
import dashboardRouter from "./routes/dashboard.routes.js";
import noticeRouter from "./routes/notice.routes.js";
import disciplineRouter from "./routes/discipline.routes.js";

import { inngest } from "./innegest/index.js";
import { generateExam, generateTimeTable, handleExamSubmission } from "./innegest/functions.js";
import rateLimit from "express-rate-limit";
import axios from "axios";
import redisClient from "./config/redis.js";
import mongoose from "mongoose";


redisClient.on('error', err => console.log('Redis Client Error', err));

const limiter = rateLimit({

    windowMs: 15 * 60 * 1000,

    max: 100,

    message: "You have sent too many requests. Please try again later."

});


app.use(limiter);
app.use(helmet()); // Security middleware to set various HTTP headers for app security
app.use(express.json()); // Middleware to parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Middleware to parse URL-encoded bodies
app.use(cookieParser()); // Middleware to parse cookies

// Serve static uploads folder (For Notices/Attachments)
app.use("/uploads", express.static("public/uploads"));

// log http requests to console
// NODE_ENV missing in .env
app.use(morgan("dev"));
// connect to mongodb
redisClient.connect().then(() => {
    console.log("Redis Connected");
});
connectDb()

// credentials: true allows cookies to be sent with requests
app.use(
    cors({
        origin: process.env.CLIENT_URL,
        credentials: true,
    })
);

// health check route
app.get("/", (req: Request, res: Response) => {
    res.status(200).json({ status: "OK", message: "Server is healthy" });
});


app.get("/awake", (req: Request, res: Response) => {

    res.status(200).json({
        success: true,
        message: "Server Awake",
        timestamp: new Date(),
    });

});

cron.schedule("*/4 * * * *", async () => {

    try {

        const url = process.env.SERVER_URL;

        if (!url) {
            console.log("SERVER_URL missing");
            return;
        }

        const response = await axios.get(
            `${url}/awake`
        );

        console.log(
            "Keep Alive Success:here",
            response.data
        );

    } catch (error) {

        console.log(
            "Keep Alive Failed"
        );

    }

});

// import user routes
app.use("/api/users", userRoutes);
app.use("/api/activities", LogsRouter);
app.use("/api/academic-years", academicYearRouter);
app.use("/api/classes", classRouter);
app.use("/api/subjects", subjectRouter);
app.use("/api/timetables", timeRouter);
app.use("/api/exams", examRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/notices", noticeRouter);
app.use("/api/discipline", disciplineRouter);
app.use(
    "/api/inngest",
    serve({
        client: inngest,
        // functions: [],
        functions: [generateTimeTable, generateExam, handleExamSubmission],
    })
);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {

    res.status(500).json({ status: "error", message: err.message });
})

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await redisClient.quit();
    await mongoose.connection.close();
    process.exit(0);
});