import mongoose from "mongoose";

const attendance=new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Class",
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ["Present", "Absent", "Late"],
        required: true
    }
})

export default mongoose.model("Attendance", attendance);