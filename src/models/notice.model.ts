import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    attachmentUrl: { type: String }, // Path to the uploaded file
    
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    
    // Targeting Logic
    targetType: { 
        type: String, 
        enum: ["ALL", "ALL_TEACHERS", "ALL_STUDENTS", "SPECIFIC_USERS"], 
        required: true 
    },
    targetUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Used if targetType is SPECIFIC_USERS
    
    // Read Receipts
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("Notice", noticeSchema);
