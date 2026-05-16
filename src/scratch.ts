import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

mongoose.connect(process.env.MONGODB_URI as string).then(async () => {
    const db = mongoose.connection.db;
    if (!db) {
        console.log("No DB connection");
        process.exit(1);
    }
    const collection = db.collection("users");
    const count = await collection.countDocuments({ role: "student" });
    console.log("Student count:", count);
    const sample = await collection.findOne({ role: "student" });
    console.log("Sample:", sample);
    process.exit(0);
}).catch(console.error);
