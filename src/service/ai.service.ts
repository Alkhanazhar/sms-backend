import Class from "../models/class.model.js";
import User from "../models/user.model.js";
import timetableModel from "../models/timetable.model.js";
import examModel from "../models/exam.model.js";
import submissionModel from "../models/submission.model.js";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

interface GenSettings {
  startTime: string;
  endTime: string;
  periods: number;
  recessTime?: string;
  recessDuration?: number;
}

/**
 * Generate weekly timetable using Google Gemini AI
 */
export const generateTimeTable = async (
  classId: string,
  academicYearId: string,
  settings: GenSettings
): Promise<{ success: boolean; message: string }> => {
  // 1. Fetch Class Context
  const classData = await Class.findById(classId).populate("subjects");
  if (!classData) {
    throw new Error("Class not found");
  }
  console.log(classData.subjects);
  // Fetch teachers
  const allTeacher = await User.find({ role: "teacher" });
  console.log(allTeacher);
  // Filter qualified teachers for class subjects
  const classSubjectsIds = classData.subjects.map((sub) => sub._id.toString());

  const qualifiedTeachers = allTeacher
    .filter((teacher) => {
      if (!teacher.teacherSubject) return false;
      return teacher.teacherSubject.some((subId) =>
        classSubjectsIds.includes(subId.toString())
      );
    })
    .map((tea) => ({
      id: tea._id,
      name: tea.name,
      subjects: tea.teacherSubject,
    }));

  const subjectsPayload = classData.subjects.map((sub: any) => ({
    id: sub._id,
    name: sub.name,
    code: sub.code,
  }));

  if (subjectsPayload.length === 0 || qualifiedTeachers.length === 0) {
    throw new Error("No Subjects or Teachers assigned to this class");
  }

  const contextData = {
    className: classData.name,
    subjects: subjectsPayload,
    teachers: qualifiedTeachers,
  };

  // 2. Generate timetable logic via Gemini
  const apiKey = process.env.GENERATIVE_AI_API_KEY;
  console.log(apiKey);
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is missing");
  }

  const allTimetables = await timetableModel.find({
    academicYear: academicYearId,
  });

  const prompt = `
    You are a school scheduler. Generate a weekly timetable (Monday to Friday).

    CONTEXT:
    - Class: ${contextData.className}
    - Hours: ${settings.startTime} to ${settings.endTime} (${settings.periods} periods/day).
    - Recess Schedule: Exactly one daily recess starting exactly at ${settings.recessTime || "12:00"} for a duration of ${settings.recessDuration || 30} minutes.

    RESOURCES:
    - Subjects: ${JSON.stringify(contextData.subjects)}
    - Teachers: ${JSON.stringify(contextData.teachers)}
    - Other Timetables: ${JSON.stringify(allTimetables)}

    STRICT RULES:
    1. Assign a Teacher and Subject to every standard academic period. There must be exactly ${settings.periods} standard academic periods per day in total.
    2. Teacher MUST have the subject ID in their list.
    3. RECESS PLACEMENT RULE: You MUST insert exactly ONE recess period per day. This recess period MUST start exactly at ${settings.recessTime || "12:00"} and end exactly at ${settings.recessTime || "12:00"} plus ${settings.recessDuration || 30} minutes (e.g. if recessTime is 12:00 and duration is 30, it MUST be from 12:00 to 12:30). Set "isRecess": true, "label": "Recess", "subject": null, and "teacher": null for this period. Absolutely NO shifting of this recess period to any other hour (like 08:00 or 10:00 or the beginning/end of the day) is allowed. It must remain strictly at the requested time.
    4. TIMING & ADJUSTMENT RULE:
       - Every single period's starting time and ending time minutes MUST end with 0 (e.g., 08:00, 08:40, 09:20, 09:30, 10:10, 11:00, 12:00, 12:30, etc. - the minutes digit must end in 0: like :00, :10, :20, :30, :40, :50). Absolutely NO minutes ending in 5 (like :45, :15, :35, :05, :25, :55).
       - The daily schedule MUST start exactly at ${settings.startTime} and end exactly at ${settings.endTime}. Adjust standard period durations (e.g. making some periods 50 minutes and others 60 minutes) so they perfectly fill all remaining time in the day before and after the recess period. If there is still leftover time, distribute it among standard academic periods or add a 'Free Period' at the end of the day, so there are absolutely NO gaps or overlaps in the schedule. All times must strictly end in 0 for the minute digit.
    5. Avoid clashes with other classes (teacher can't be in two classes at the same time).
    6. Output strict JSON only. Schema:
       {
         "schedule": [
           {
             "day": "Monday",
             "periods": [
               { 
                 "subject": "SUBJECT_ID_OR_NULL", 
                 "teacher": "TEACHER_ID_OR_NULL", 
                 "startTime": "HH:MM", 
                 "endTime": "HH:MM",
                 "isRecess": boolean,
                 "label": "string"
               }
             ]
           }
         ]
       }
  `;

  const google = createGoogleGenerativeAI({
    apiKey,
  });

  console.log(google);

  const activeModel = google("gemini-3-flash-preview");

  const { text } = await generateText({
    prompt,
    model: activeModel,
  });
  console.log(text);

  const cleanJSON = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const aiSchedule = JSON.parse(cleanJSON);
  console.log(aiSchedule);
  // 3. Save timetable
  // Delete existing to avoid duplicates
  await timetableModel.findOneAndDelete({
    class: classId,
    academicYear: academicYearId,
  });

  await timetableModel.create({
    class: classId,
    academicYear: academicYearId,
    schedule: aiSchedule.schedule,
  });
  console.log("Timetable generated successfully");
  return { success: true, message: "Timetable generated successfully" };
};

interface GenerateExamParams {
  examId: string;
  topic: string;
  subjectName: string;
  difficulty: string;
  count: number;
}

/**
 * Generate exam questions using Google Gemini AI
 */
export const generateExam = async ({
  examId,
  topic,
  subjectName,
  difficulty,
  count,
}: GenerateExamParams): Promise<{ success: boolean; count: number }> => {
  const apiKey = process.env.GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is missing");
  }

  const prompt = `
    You are a strict teacher. Create a JSON array of ${count} multiple-choice questions for a high school exam.

    CONTEXT:
    - Subject: ${subjectName}
    - Topic: ${topic}
    - Difficulty: ${difficulty}

    STRICT JSON SCHEMA (Array of Objects):
    [
      {
        "questionText": "Question string",
        "type": "MCQ",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswer": "The exact string of the correct option",
        "points": 1
      }
    ]

    RULES:
    1. Output ONLY raw JSON. No Markdown.
    2. Ensure correct answer matches one of the options exactly.
  `;

  const google = createGoogleGenerativeAI({
    apiKey,
  });

  const activeModel = google("gemini-3-flash-preview");

  const { text } = await generateText({
    prompt,
    model: activeModel,
  });

  // Sanitize JSON
  const cleanJson = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
  const aiExam = JSON.parse(cleanJson);

  // Save questions to exam
  const exam = await examModel.findById(examId);
  if (!exam) {
    throw new Error(`Exam ${examId} not found`);
  }

  exam.questions = aiExam;
  exam.isActive = false; // Keep it inactive until teacher reviews it
  await exam.save();

  return { success: true, count: aiExam.length };
};

interface SubmitExamParams {
  examId: string;
  studentId: string;
  answers: Array<{ questionId: string; answer: string }>;
}

/**
 * Handle student exam submission and auto-grading
 */
export const handleExamSubmission = async ({
  examId,
  studentId,
  answers,
}: SubmitExamParams): Promise<{ success: boolean; message: string }> => {
  // 1. Check if already submitted
  const existingSubmission = await submissionModel.findOne({
    exam: examId,
    student: studentId,
  });
  if (existingSubmission) {
    throw new Error("Exam already submitted");
  }

  // 2. Fetch full exam with correct answers
  const exam = await examModel.findById(examId).select("+questions.correctAnswer");
  if (!exam) {
    throw new Error(`Exam ${examId} not found`);
  }

  // 3. Calculate score
  let score = 0;
  let totalPoints = 0;

  exam.questions.forEach((question: any) => {
    totalPoints += question.points;
    const studentAns = answers.find(
      (a: any) => a.questionId === question._id.toString()
    );
    if (studentAns && studentAns.answer === question.correctAnswer) {
      score += question.points;
    }
  });

  // 4. Save Submission
  await submissionModel.create({
    exam: examId,
    student: studentId,
    answers,
    score,
  });

  return { success: true, message: "Exam submitted successfully" };
};
