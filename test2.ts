import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: "test",
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    console.log("Success:", !!response.text);
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
