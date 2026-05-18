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

  // Fetch teachers
  const allTeacher = await User.find({ role: "teacher" });

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
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
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

    RESOURCES:
    - Subjects: ${JSON.stringify(contextData.subjects)}
    - Teachers: ${JSON.stringify(contextData.teachers)}
    - Other Timetables: ${JSON.stringify(allTimetables)}

    STRICT RULES:
    1. Assign a Teacher to every Subject period.
    2. Teacher MUST have the subject ID in their list.
    3. Break Time/Free Period after every 2 periods(10 minutes), Lunch Time after 5 periods(at 12:00)(30 minutes).
    4. Avoid clashes with other classes(teacher can't be in two classes at the same time).
    5. Output strict JSON only. Schema:
       {
         "schedule": [
           {
             "day": "Monday",
             "periods": [
               { "subject": "SUBJECT_ID", "teacher": "TEACHER_ID", "startTime": "HH:MM", "endTime": "HH:MM" }
             ]
           }
         ]
       }
  `;

  const google = createGoogleGenerativeAI({
    apiKey,
  });

  const activeModel = google("gemini-3-flash-preview");

  const { text } = await generateText({
    prompt,
    model: activeModel,
  });

  const cleanJSON = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const aiSchedule = JSON.parse(cleanJSON);

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
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
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
