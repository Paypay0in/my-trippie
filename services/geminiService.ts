import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Category, PaymentMethod, TaxRule } from '../types';

const cleanJsonString = (str: string) => {
    // Remove markdown code blocks if present
    let cleaned = str.replace(/```json/g, '').replace(/```/g, '');
    return cleaned.trim();
};

const getAiModel = () => {
    if (!process.env.API_KEY) return null;
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Retry helper for API calls
const callWithRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    // Check for rate limit (429) or Service Unavailable (503)
    // The Gemini SDK might return error.status as 'RESOURCE_EXHAUSTED' or numeric 429
    const shouldRetry = 
        error?.status === 429 || 
        error?.code === 429 || 
        error?.status === 'RESOURCE_EXHAUSTED' ||
        error?.message?.includes('429') ||
        error?.message?.includes('Quota') ||
        error?.status === 503;

    if (retries > 0 && shouldRetry) {
      console.warn(`Gemini API busy (Retrying in ${delay}ms):`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const parseExpenseWithGemini = async (text: string): Promise<{
  description?: string;
  amount?: number;
  currency?: string;
  category?: string;
  paymentMethod?: string;
} | null> => {
  const ai = getAiModel();
  if (!ai) {
    console.warn("API Key missing");
    return null;
  }

  try {
    const prompt = `
      Extract expense details from this text: "${text}".
      Identify the description, amount, currency code (ISO 4217), and fit it into one of these categories:
      ${Object.values(Category).join(', ')}.
      
      Important Category Rules:
      - If the text mentions "幫買", "代買", "幫朋友", "代購" (help buy/buying for friend), set category to '${Category.HELP_BUY}'.
      - If the text mentions "回國", "回家", "機場捷運", "高鐵", "統聯" (return transport), set category to '${Category.TRANSPORT_POST}'.

      Also identify the payment method.
      - If it is credit card, map to '${PaymentMethod.CREDIT_CARD}'.
      - If it is TWD cash (台幣現金) or implied domestic cash, map to '${PaymentMethod.CASH_TWD}'.
      - If it is foreign cash (外幣現金), map to '${PaymentMethod.CASH_FOREIGN}'.
      - If it is IC card/Suica/EasyCard, map to '${PaymentMethod.IC_CARD}'.
      
      If unknown cash type, just return '${PaymentMethod.CASH_FOREIGN}' if currency is not TWD, otherwise '${PaymentMethod.CASH_TWD}'.

      If the currency is not specified but implied (e.g. "yen"), use the code (JPY). Default to TWD if unknown.
      If category is unclear, use "其他".
    `;

    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            category: { type: Type.STRING },
            paymentMethod: { type: Type.STRING },
          },
          required: ["amount"],
        },
      },
    }));

    if (response.text) {
        return JSON.parse(cleanJsonString(response.text)) as {
            description?: string;
            amount?: number;
            currency?: string;
            category?: string;
            paymentMethod?: string;
        };
    }
    return null;

  } catch (error) {
    console.error("Gemini parse error:", error);
    return null;
  }
};

export const parseImageExpenseWithGemini = async (base64Data: string, mimeType: string): Promise<{
  description?: string;
  amount?: number;
  currency?: string;
  category?: string;
  date?: string;
  paymentMethod?: string;
  country?: string;
  isUncertain?: boolean;
  travelStartDate?: string;
  travelEndDate?: string;
} | null> => {
  const ai = getAiModel();
  if (!ai) {
    console.warn("API Key missing");
    return null;
  }

  try {
    const prompt = `
      Analyze this image (receipt, flight ticket, hotel booking, or screen capture).
      
      Extract the following details:
      1. Merchant Name or Short Description.
      2. Total Amount (Final total).
      3. Currency Code (ISO 4217).
      4. Category: Choose strictly from: ${Object.values(Category).join(', ')}.
      5. Payment Method: Infer Credit Card, Cash, or IC Card.
      6. Country: Infer the country in Traditional Chinese.

      CRITICAL DATE PARSING:
      - "date": The specific date when the TRANSACTION/PAYMENT happened (or the invoice date). This is for the ledger.
      - "travelStartDate" & "travelEndDate": IF this is a FLIGHT ticket or HOTEL booking, extract the actual TRAVEL dates.
        - For flights: Start = Departure Date, End = Return Date (or Arrival Date if one-way).
        - For hotels: Start = Check-in, End = Check-out.
        - For normal receipts (food, shopping), these fields should be null.
      
      Format all dates as YYYY-MM-DD.

      Flag 'isUncertain' as true if the image is blurry or key info is ambiguous.
      Return JSON.
    `;

    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            category: { type: Type.STRING },
            date: { type: Type.STRING, description: "Transaction/Invoice Date" },
            travelStartDate: { type: Type.STRING, description: "Actual Travel Start Date (Flights/Hotels)" },
            travelEndDate: { type: Type.STRING, description: "Actual Travel End Date (Flights/Hotels)" },
            paymentMethod: { type: Type.STRING },
            country: { type: Type.STRING, description: "Inferred country in Traditional Chinese" },
            isUncertain: { type: Type.BOOLEAN, description: "True if low confidence" },
          },
          required: ["amount", "currency"],
        },
      },
    }));

    if (response.text) {
        return JSON.parse(cleanJsonString(response.text));
    }
    return null;

  } catch (error) {
    console.error("Gemini image parse error:", error);
    return null;
  }
};

export const fetchTaxRefundRules = async (countryName: string): Promise<TaxRule | null> => {
  const ai = getAiModel();
  if (!ai || !countryName) {
    return null;
  }

  try {
    const prompt = `
      What are the current tourist tax refund (VAT refund) rules for "${countryName}"?
      Provide the minimum spend amount required in a single receipt (in the local currency) to be eligible for a refund, and the approximate refund percentage rate.
      Also identify the local currency code (e.g., JPY, EUR, KRW).
      
      Crucial Rule:
      - If the country does NOT have a tourist tax refund system (e.g., Hong Kong, USA, Macau), or if it's a tax-free region, set 'minSpend' to 0 and 'refundRate' to 0.

      Return JSON.
    `;

    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            country: { type: Type.STRING, description: "Name of the country identified" },
            currency: { type: Type.STRING, description: "Currency code (ISO 4217)" },
            minSpend: { type: Type.NUMBER, description: "Minimum spend amount in local currency" },
            refundRate: { type: Type.NUMBER, description: "Refund rate as a decimal (e.g., 0.10 for 10%)" },
            notes: { type: Type.STRING, description: "Short summary of the rule (max 10 words)" },
          },
          required: ["country", "currency", "minSpend", "refundRate"],
        },
      },
    }));

    if (response.text) {
        const rule = JSON.parse(cleanJsonString(response.text)) as TaxRule;
        return {
            ...rule,
            currency: rule.currency.toUpperCase() // Normalize currency to uppercase
        };
    }
    return null;
  } catch (error) {
    console.error("Gemini tax fetch error:", error);
    return null;
  }
};