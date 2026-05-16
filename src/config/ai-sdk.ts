// services/gemini.service.ts

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import dotenv from "dotenv";
dotenv.config();
const apiKey = process.env.GENERATIVE_AI_API_KEY;

if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is missing");
}

const google = createGoogleGenerativeAI({
    apiKey,
});

const model = google("gemini-3-flash-preview");

export const generateGeminiResponse = async (
    prompt: string
) => {

    const { text } = await generateText({
        model,
        prompt,
    });

    return text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

};