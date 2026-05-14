import cookieParser from "cookie-parser";
import express, {
    type Application,
    type Request,
    type Response,
} from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import { serve } from "inngest/express";
import "dotenv/config"
import connectDb from "./config/connect-db.ts";
const app: Application = express();
const PORT = process.env.PORT || 5000;
import userRoutes from "./routes/user.routes.ts";
import academicYearRouter from "./routes/academic.routes.ts";
import classRouter from "./routes/class.routes.ts";
import LogsRouter from "./routes/activitylog.routes.ts";
import subjectRouter from "./routes/subject.routes.ts";
import timeRouter from "./routes/timetable.route.ts";
import examRouter from "./routes/exam.route.ts";
import dashboardRouter from "./routes/dashboard.routes.ts";

import { inngest } from "./innegest/index.ts";
import { generateExam, generateTimeTable, handleExamSubmission } from "./innegest/functions.ts";
import rateLimit from "express-rate-limit";
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

// log http requests to console
// NODE_ENV missing in .env
if (process.env.STAGE === "development") {
    app.use(morgan("dev"));
}

//connect to mongodb
connectDb()

// cross-origin resource sharing (CORS) middleware
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




// import user routes
app.use("/api/users", userRoutes);
app.use("/api/activities", LogsRouter);
app.use("/api/academic-years", academicYearRouter);
app.use("/api/classes", classRouter);
app.use("/api/subjects", subjectRouter);
app.use("/api/timetables", timeRouter);
app.use("/api/exams", examRouter);
app.use("/api/dashboard", dashboardRouter);
app.use(
    "/api/inngest",
    serve({
        client: inngest,
        // functions: [],
        functions: [generateTimeTable, generateExam, handleExamSubmission],
    })
);

app.use((err: Error, req: Request, res: Response) => {

    res.status(500).json({ status: "error", message: err.message });
})

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
