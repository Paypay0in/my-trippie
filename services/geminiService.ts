import { GoogleGenerativeAI } from "@google/generative-ai";

// 讀取你在 Vercel 設定的環境變數
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export async function processExpense(prompt: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  // 這裡可以根據你的 App 邏輯自定義 System Instruction
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}
