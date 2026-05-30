import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialize GoogleGenAI client for security and startup resilience
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is missing on the server secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// B2B SaaS AI Service: Sentiment summary & multi-platform copywriting assets from real customer feed.
app.post("/api/gemini/analyze", async (req, res) => {
  try {
    const { testimonials, companyName } = req.body;
    if (!testimonials || !Array.isArray(testimonials) || testimonials.length === 0) {
      return res.status(400).json({ error: "Testimonials must be a non-empty array." });
    }

    const aiClient = getGeminiClient();

    // Serialize review items for structured contextual prompt
    const serializedFeedback = testimonials.map((t, idx) => {
      const designationLine = (t.title || t.company) ? `(${t.title || ""}${t.title && t.company ? " @ " : ""}${t.company || ""})` : "";
      return `Review #${idx + 1}:
- Critic name: ${t.name} ${designationLine}
- Rating scoring: ${t.rating} out of 5 stars
- Feedback text: "${t.content}"`;
    }).join("\n\n");

    const promptText = `Determine user sentiment patterns and create dynamic marketing copy points from customer feedbacks for "${companyName || "our business"}". You MUST output a clean JSON syntax.

Feedbacks to analyze:
${serializedFeedback}

Produce a complete JSON object adhering to this schema:
{
  "sentimentSummary": "A highly readable, single-sentence summary of customer satisfaction patterns.",
  "averageRatingString": "The textual summary representation, e.g. '4.9 out of 5 stars based on 8 reviews'",
  "strengths": [
    "Primary strength bullet point detailing specific client praises",
    "Secondary strength bullet point",
    "Tertiary strength bullet point"
  ],
  "heroHook": "A powerful, catchy, outcome-oriented landing page headline inspired by the reviews",
  "heroSubheading": "A high-converting secondary subtitle reinforcing value based on user proofs",
  "marketingCopies": {
    "twitter": "A high-conversion Twitter/X snippet or thread opener including review summaries",
    "linkedin": "A high-professional narrative LinkedIn post showing the business results and value proof",
    "facebookAd": "A persuasive Facebook Ad copy focusing on social validation and Call to Action"
  }
}`;

    const generateResponse = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentimentSummary: { type: Type.STRING },
            averageRatingString: { type: Type.STRING },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            heroHook: { type: Type.STRING },
            heroSubheading: { type: Type.STRING },
            marketingCopies: {
              type: Type.OBJECT,
              properties: {
                twitter: { type: Type.STRING },
                linkedin: { type: Type.STRING },
                facebookAd: { type: Type.STRING }
              },
              required: ["twitter", "linkedin", "facebookAd"]
            }
          },
          required: [
            "sentimentSummary", 
            "averageRatingString", 
            "strengths", 
            "heroHook", 
            "heroSubheading", 
            "marketingCopies"
          ]
        }
      }
    });

    const outputText = generateResponse.text;
    if (!outputText) {
      throw new Error("No output received from the Gemini AI model.");
    }

    const payload = JSON.parse(outputText);
    res.json(payload);
  } catch (error: any) {
    console.error("Gemini API server proxy failed:", error);
    res.status(500).json({ error: error.message || "Internal server error performing AI synthesis." });
  }
});

// Configure Vite middleware and static handlers
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware loaded.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static files router loaded on dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
