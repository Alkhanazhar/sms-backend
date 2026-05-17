import mongoose, { Schema, Document } from "mongoose";

export interface IDiscipline extends Document {
  student: mongoose.Types.ObjectId;
  teacher: mongoose.Types.ObjectId;
  title: string;
  description: string;
  incidentDate: Date;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  demerits: number;
  aiActionPlan: {
    teacherAdvice: string;
    parentAdvice: string;
    studentAdvice: string;
  };
  status: "PENDING" | "UNDER_REVIEW" | "RESOLVED" | "ESCALATED";
  attachment?: string; // file path for evidence (image/pdf/doc)
  adminComment?: string;
  parentFeedback?: string;
  escalatedToAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DisciplineSchema = new Schema<IDiscipline>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    teacher: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    incidentDate: { type: Date, default: Date.now },
    category: {
      type: String,
      required: true,
      enum: ["Academic Dishonesty", "Bullying", "Disruption", "Insubordination", "Property Damage", "Other"],
    },
    severity: {
      type: String,
      required: true,
      enum: ["LOW", "MEDIUM", "HIGH"],
    },
    demerits: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    aiActionPlan: {
      teacherAdvice: { type: String, required: true },
      parentAdvice: { type: String, required: true },
      studentAdvice: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ["PENDING", "UNDER_REVIEW", "RESOLVED", "ESCALATED"],
      default: "PENDING",
    },
    attachment: { type: String, default: "" },
    adminComment: { type: String, default: "" },
    parentFeedback: { type: String, default: "" },
    escalatedToAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes for faster lookups
DisciplineSchema.index({ student: 1 });
DisciplineSchema.index({ teacher: 1 });
DisciplineSchema.index({ severity: 1 });
DisciplineSchema.index({ status: 1 });

export default mongoose.model<IDiscipline>("Discipline", DisciplineSchema);
