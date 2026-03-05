import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// Initialize the Google Generative AI client
const apiKey = process.env.GOOGLE_GENAI_API_KEY;
if (!apiKey) {
  throw new Error("GOOGLE_GENAI_API_KEY environment variable is not set");
}

export const genAI = new GoogleGenerativeAI(apiKey);

// Get the model with safety settings
export function getModel(modelName: string = "gemini-2.5-flash") {
  return genAI.getGenerativeModel({
    model: modelName,
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
  });
}
