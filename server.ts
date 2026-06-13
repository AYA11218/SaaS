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

// In-memory ledger to cache sent custom email notifications for admin simulation oversight
const sentEmails: any[] = [];

app.get("/api/emails", (req, res) => {
  res.json({ emails: sentEmails });
});

// Helper to replace dynamic placeholders in Thank You email templates
function replacePlaceholders(template: string, testimonial: any, campaign: any): string {
  if (!template) return "";
  const ratingStars = "★".repeat(Number(testimonial.rating) || 5) + "☆".repeat(5 - (Number(testimonial.rating) || 5));
  return template
    .replace(/\{name\}/g, testimonial.name || "Customer")
    .replace(/\{rating\}/g, `${testimonial.rating || 5}/5 stars (${ratingStars})`)
    .replace(/\{campaign_title\}/g, campaign.title || "Collection Campaign")
    .replace(/\{company\}/g, testimonial.company || "N/A")
    .replace(/\{content\}/g, testimonial.content || "")
    .replace(/\{sender\}/g, campaign.thankYouEmailSender || "The Corporate Team");
}

app.post("/api/notify-client", (req, res) => {
  try {
    const { testimonial, campaign } = req.body;
    if (!testimonial || !campaign) {
      return res.status(400).json({ error: "Missing testimonial or campaign config in body." });
    }

    // Check if the thank you email is enabled
    const isEnabled = campaign.thankYouEmailEnabled !== false; // Enable by default if not set
    if (!isEnabled) {
      return res.json({
        success: false,
        message: "Automated Thank You email is currently deactivated for this campaign."
      });
    }

    const defaultSubject = `Thank you for sharing your experience with us, {name}!`;
    const defaultBody = `
Dear {name},

Thank you so much for leaving a rating of {rating} on {campaign_title}! We really appreciate you taking your time to share your feedback with us:

"{content}"

Your review has been successfully submitted and helps us build a better experience for everyone.

Best regards,
{sender}
    `.trim();

    const rawSubject = campaign.thankYouEmailSubject || defaultSubject;
    const rawBody = campaign.thankYouEmailBody || defaultBody;

    const formattedSubject = replacePlaceholders(rawSubject, testimonial, campaign);
    const formattedBody = replacePlaceholders(rawBody, testimonial, campaign);
    const senderName = campaign.thankYouEmailSender || "The Corporate Team";

    const emailPayload = {
      id: "client-thank-email-" + Math.random().toString(36).slice(2, 9),
      to: testimonial.email || "recipient@sandbox.io",
      from: `"${senderName}" <reviews@trustbuilder-automated.io>`,
      subject: formattedSubject,
      body: formattedBody,
      sentAt: new Date().toISOString(),
      testimonialName: testimonial.name,
      testimonialEmail: testimonial.email,
      rating: testimonial.rating,
      isClientReply: true
    };

    sentEmails.push(emailPayload);

    console.log("\n=======================================================");
    console.log(`📠 [OUTGOING CLIENT AUTO-REPLY] dispatching Thank-You template...`);
    console.log(`📬 To:      ${emailPayload.to}`);
    console.log(`✉️  From:    ${emailPayload.from}`);
    console.log(`📌 Subject: ${emailPayload.subject}`);
    console.log(`✉️  Body:\n\n${emailPayload.body}`);
    console.log("=======================================================\n");

    res.json({
      success: true,
      message: "Client automated thank-you email registered and simulated.",
      email: emailPayload
    });
  } catch (error: any) {
    console.error("Client email dispatch mock failed:", error);
    res.status(500).json({ error: error.message || "Failed to process auto email." });
  }
});

app.post("/api/notify-owner", async (req, res) => {
  try {
    const { testimonial, spaceName, ownerEmail } = req.body;
    if (!testimonial) {
      return res.status(400).json({ error: "Missing testimonial data in body." });
    }

    const emailSubject = `🎉 New Customer Testimonial Submitted for ${spaceName || "your workspace"}!`;
    const ratingStars = "★".repeat(Number(testimonial.rating) || 5) + "☆".repeat(5 - (Number(testimonial.rating) || 5));
    
    const emailBody = `
Dear Business Owner,

A new customer review has been successfully submitted via your campaign form!

Review details:
--------------------------------------------------
Customer Name: ${testimonial.name}
Email Address: ${testimonial.email}
Rating:        ${ratingStars} (${testimonial.rating}/5 stars)
Company/Title: ${testimonial.title || ""}${testimonial.title && testimonial.company ? " @ " : ""}${testimonial.company || "N/A"}
Date Created:  ${testimonial.createdAt || new Date().toISOString()}

Content:
"${testimonial.content}"
--------------------------------------------------

To review, approve, tag, or display this feedback on your live Wall of Love widgets, log in to your SaaS dashboard:
http://localhost:3000

Best Regards,
ACME Review Platform Notifications Service
    `.trim();

    const emailPayload = {
      id: "email-" + Math.random().toString(36).slice(2, 9),
      to: ownerEmail || "ayanatamene80@gmail.com",
      subject: emailSubject,
      body: emailBody,
      sentAt: new Date().toISOString(),
      testimonialName: testimonial.name,
      testimonialEmail: testimonial.email,
      rating: testimonial.rating
    };

    sentEmails.push(emailPayload);

    console.log("\n=======================================================");
    console.log(`📠 [OUTGOING SMTP ROUTER] Dispatching automated notification...`);
    console.log(`📬 To:      ${emailPayload.to}`);
    console.log(`📌 Subject: ${emailPayload.subject}`);
    console.log(`✉️  Body:\n\n${emailPayload.body}`);
    console.log("=======================================================\n");

    res.json({
      success: true,
      message: "Notification logged and simulated email dispatched successfully via custom carrier.",
      email: emailPayload
    });
  } catch (error: any) {
    console.error("Email notification proxy failed:", error);
    res.status(500).json({ error: error.message || "Failed to dispatch email helper." });
  }
});

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

// Single review B2B Copywriting: Generate professional social media marketing copy based on review content
app.post("/api/gemini/generate-social-copy", async (req, res) => {
  try {
    const { testimonial, companyName, tone } = req.body;
    if (!testimonial || !testimonial.content) {
      return res.status(400).json({ error: "Missing testimonial content to generate copy from." });
    }

    const aiClient = getGeminiClient();
    const activeTone = tone || "Professional";
    const brand = companyName || "our business";
    
    const reviewerName = testimonial.name || "A Customer";
    const reviewerDesignation = (testimonial.title || testimonial.company)
      ? `(${testimonial.title || ""}${testimonial.title && testimonial.company ? " @ " : ""}${testimonial.company || ""})`
      : "";
    const ratingValue = testimonial.rating ? `${testimonial.rating}/5 stars` : "5/5 stars";

    const promptText = `
You are an elite B2B and consumer copywriting strategist. Generate three distinct, high-performance social media marketing pieces (LinkedIn, Twitter/X, Instagram) promoting "${brand}" based on a real customer review.

Review Details:
- Customer Name: ${reviewerName} ${reviewerDesignation}
- Rating scoring: ${ratingValue}
- Feedback text: "${testimonial.content}"

The overall copy style and tone must be: "${activeTone}" (e.g. if professional, keep it polished and data-focused; if enthusiastic, make it high-energy with emojis; if punchy/bold, make it short, direct, and outcome-focused).

Output a complete JSON object matching this exact schema:
{
  "valueHook": "A compelling, high-impact introductory statement summarizing the customer's transformation or main benefit (1 sentence).",
  "linkedin": "A high-performance professional LinkedIn post. Structure: attention-grabbing hook, the concrete quote/story from the review, takeaways of what makes ${brand} special, call-to-action (CTA), and 3-4 professional hashtags. Make it feel authentic, not overly robotic.",
  "twitter": "A highly viral, punchy Twitter/X post under 280 characters. Inline emojis, a crisp value-proposition statement, a short review snippet, and 2-3 minimal hashtags.",
  "instagram": "An elegant, visually evocative post suited for Instagram or Facebook. Include an eye-catching header, bold callouts, the core highlight quote from ${reviewerName}, a friendly call-to-action, and optimized hashtags."
}
    `.trim();

    const generateResponse = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            valueHook: { type: Type.STRING },
            linkedin: { type: Type.STRING },
            twitter: { type: Type.STRING },
            instagram: { type: Type.STRING }
          },
          required: ["valueHook", "linkedin", "twitter", "instagram"]
        }
      }
    });

    const outputText = generateResponse.text;
    if (!outputText) {
      throw new Error("No output received from the Gemini AI model.");
    }

    const socialPayload = JSON.parse(outputText);
    res.json({
      success: true,
      tone: activeTone,
      payload: socialPayload
    });
  } catch (error: any) {
    console.error("Gemini social media copy generation proxy failed:", error);
    res.status(500).json({ error: error.message || "Failed to generate social copy from review." });
  }
});

// Multi-review copywriting: Generate persuasive social media posts and website marketing copy based on multiple customer reviews and their sentiment
app.post("/api/gemini/generate-multi-campaign", async (req, res) => {
  try {
    const { testimonials, companyName, tone } = req.body;
    if (!testimonials || !Array.isArray(testimonials) || testimonials.length === 0) {
      return res.status(400).json({ error: "Missing or invalid testimonials array." });
    }

    const aiClient = getGeminiClient();
    const activeTone = tone || "Persuasive";
    const brand = companyName || "our business";

    // Format testimonials neatly for the prompt to keep it structured
    const formattedTestimonials = testimonials.map((t, idx) => {
      const designation = (t.title || t.company)
        ? `(${t.title || ""}${t.title && t.company ? " @ " : ""}${t.company || ""})`
        : "";
      return `Testimonial #${idx + 1}:
- Reviewer: ${t.name || "Anonymous user"} ${designation}
- Rating: ${t.rating ? `${t.rating}/5 stars` : "5/5 stars"}
- Review: "${t.content}"`;
    }).join("\n\n");

    const promptText = `
You are a world-class copywriter and SaaS growth advisor.
Analyze the sentiment, key selling points, and emotional hooks of the following customer reviews for "${brand}", and generate a conversion-focused, persuasive marketing copy deck.

Here are the selected customer reviews:
${formattedTestimonials}

Tone of voice requirements: "${activeTone}"

Please analyze the combined customer sentiment and synthesize their feedback into:
1. High-impact social media posts for multiple platforms (LinkedIn, X/Twitter, and Instagram/Facebook).
2. Professional website and landing-page copy that leverages the specific value-hooks of these reviews (such as specific problems solved, visual high-converting headlines, feature spotlights).

Output a complete JSON object matching this exact schema:
{
  "campaignTitle": "A short, catchy, action-oriented campaign title summarizing the theme of these testimonials.",
  "overallSentimentSummary": "A concise paragraph summarizing the shared customer sentiment and what users love most about ${brand}.",
  "socialCopy": {
    "linkedinPost": "A polished, structured LinkedIn post utilizing bullet points, quotes from these reviews, key value takeaways, and professional hashtags.",
    "twitterPost": "A punchy, viral Twitter/X post under 280 characters with inline emojis, summarizing the main benefit.",
    "facebookInstagramPost": "A warm, high-engagement Facebook/Instagram post with a friendly tone, incorporating customer quotes, and call-to-action."
  },
  "websiteMarketingCopy": {
    "heroHeader": "A punchy, ultra-persuasive hero headline (e.g. bold claim or benefit) inspired by these reviews.",
    "heroSubheader": "A supporting subheading (1-2 sentences) reinforcing the value proposition.",
    "socialProofTagline": "A compelling, 1-sentence teaser/tagline to place right above the customer reviews section.",
    "featureSpotlightTitle": "A title for a feature spotlight card summarizing the main solution/feature praised in these reviews.",
    "featureSpotlightDescription": "A 2-3 sentence persuasive paragraph explaining this key feature's real-world benefit.",
    "benefitBullets": [
      {
        "title": "Benefit 1 short title",
        "description": "Short explanation of this benefit based on a specific customer win mentioned."
      },
      {
        "title": "Benefit 2 short title",
        "description": "Short explanation of this benefit based on a specific customer win mentioned."
      },
      {
        "title": "Benefit 3 short title",
        "description": "Short explanation of this benefit based on a specific customer win mentioned."
      }
    ]
  }
}
    `.trim();

    const generateResponse = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            campaignTitle: { type: Type.STRING },
            overallSentimentSummary: { type: Type.STRING },
            socialCopy: {
              type: Type.OBJECT,
              properties: {
                linkedinPost: { type: Type.STRING },
                twitterPost: { type: Type.STRING },
                facebookInstagramPost: { type: Type.STRING }
              },
              required: ["linkedinPost", "twitterPost", "facebookInstagramPost"]
            },
            websiteMarketingCopy: {
              type: Type.OBJECT,
              properties: {
                heroHeader: { type: Type.STRING },
                heroSubheader: { type: Type.STRING },
                socialProofTagline: { type: Type.STRING },
                featureSpotlightTitle: { type: Type.STRING },
                featureSpotlightDescription: { type: Type.STRING },
                benefitBullets: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING }
                    },
                    required: ["title", "description"]
                  }
                }
              },
              required: ["heroHeader", "heroSubheader", "socialProofTagline", "featureSpotlightTitle", "featureSpotlightDescription", "benefitBullets"]
            }
          },
          required: ["campaignTitle", "overallSentimentSummary", "socialCopy", "websiteMarketingCopy"]
        }
      }
    });

    const outputText = generateResponse.text;
    if (!outputText) {
      throw new Error("No output received from the Gemini AI model.");
    }

    const campaignPayload = JSON.parse(outputText);
    res.json({
      success: true,
      tone: activeTone,
      payload: campaignPayload
    });
  } catch (error: any) {
    console.error("Gemini multi-review campaign copy generation failed:", error);
    res.status(500).json({ error: error.message || "Failed to generate multi-review campaign copy." });
  }
});

// Custom raw review rewriter API endpoint
app.post("/api/gemini/rewrite-review", async (req, res) => {
  try {
    const { rawReview, companyName, tone, format } = req.body;
    if (!rawReview || typeof rawReview !== "string" || !rawReview.trim()) {
      return res.status(400).json({ error: "Missing or invalid rawReview content to rewrite." });
    }

    const aiClient = getGeminiClient();
    const activeTone = tone || "Professional";
    const brand = companyName || "our business";
    const reqFormat = format || "both";

    const promptText = `
You are an expert copywriter and marketing strategist specializing in social proof.
Your task is to take a raw, messy, or informal customer review for "${brand}" and rewrite it into professional-grade marketing copy and social captions.

Raw review content:
"${rawReview}"

Desired Tone: "${activeTone}"
Format requested: "${reqFormat}"

Please generate:
1. "polishedReview": A clean, grammatically pristine, and highly readable version of the testimonial itself. Keep the core customer voice and main feedback message, but elevate the sentence structure and expression.
2. "marketingHeadline": A crisp, benefit-driven headliner (less than 10 words) that captures the core value mentioned in the review.
3. "linkedinCaption": An engaging, professional, thought-leadership style LinkedIn post detailing client success using ${brand}.
4. "twitterCaption": A punchy, high-engagement Twitter/X post under 250 characters with emojis.
5. "instagramCaption": A gorgeous Instagram/Facebook caption with spaces, bulleted benefits if applicable, and relevant hashtags.

Output a complete JSON object adhering to this exact schema:
{
  "polishedReview": "The cleanly rewritten customer testimonial",
  "marketingHeadline": "A benefit-driven landing page headline",
  "linkedinCaption": "The formatted LinkedIn post (or empty string if format is 'social_caption' only)",
  "twitterCaption": "The formatted Twitter/X post (or empty string if format is 'marketing_copy' only)",
  "instagramCaption": "The formatted Instagram/Facebook post"
}
    `.trim();

    const generateResponse = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            polishedReview: { type: Type.STRING },
            marketingHeadline: { type: Type.STRING },
            linkedinCaption: { type: Type.STRING },
            twitterCaption: { type: Type.STRING },
            instagramCaption: { type: Type.STRING }
          },
          required: ["polishedReview", "marketingHeadline", "linkedinCaption", "twitterCaption", "instagramCaption"]
        }
      }
    });

    const outputText = generateResponse.text;
    if (!outputText) {
      throw new Error("No output received from the Gemini AI model.");
    }

    const parsed = JSON.parse(outputText);
    res.json({
      success: true,
      payload: parsed
    });
  } catch (error: any) {
    console.error("Gemini rewrite review error:", error);
    res.status(500).json({ error: error.message || "Failed to rewrite raw review." });
  }
});

// Testimonial Sentiment trend analysis over time
app.post("/api/gemini/sentiment-trend", async (req, res) => {
  try {
    const { testimonials } = req.body;
    if (!testimonials || !Array.isArray(testimonials)) {
      return res.status(400).json({ error: "Testimonials must be provided in an array." });
    }

    if (testimonials.length === 0) {
      return res.json({ success: true, trendData: [] });
    }

    const aiClient = getGeminiClient();

    // Simplify records to avoid token bloat while transferring essential text context
    const reviewsToAnalyze = testimonials.map((t) => ({
      id: t.id,
      content: t.content || "",
      rating: t.rating || 5,
      createdAt: t.createdAt || new Date().toISOString()
    }));

    const promptText = `
Analyze the underlying customer sentiment polarity/force for each testimonial item.
For each testimonial detail:
1. Provide a sentiment label: "Positive", "Neutral", or "Negative"
2. Output a numerical sentiment score ranging from -1.00 (extremely critical/detrimental) to +1.00 (extremely satisfied/delighted). For example:
   - A bright 5-star appraisal or glowing compliment usually scores between 0.70 and 1.00.
   - Constructive, mixed, or passive 3-to-4 star feedback usually scores between 0.10 and 0.50.
   - Plain matter-of-fact or average statements score around 0.00.
   - Poor/dissatisfied 1-to-2 star complaints score below -0.30.
3. Keep the original 'id' mapping intact so they correspond 1:1 on the dashboard layout.
4. Provide a very short reason for your mathematical score.

Testimonials context:
${JSON.stringify(reviewsToAnalyze, null, 2)}

Produce a valid, parsable JSON response matching this schema:
{
  "analyzedTestimonials": [
    {
      "id": "string (the original feedback ID)",
      "sentiment": "Positive" | "Neutral" | "Negative",
      "score": number, // float between -1.00 and 1.00
      "reason": "String (brief 1-sentence analytical reason)"
    }
  ]
}
`.trim();

    const generateResponse = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analyzedTestimonials: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  sentiment: { type: Type.STRING },
                  score: { type: Type.NUMBER },
                  reason: { type: Type.STRING }
                },
                required: ["id", "sentiment", "score", "reason"]
              }
            }
          },
          required: ["analyzedTestimonials"]
        }
      }
    });

    const outputText = generateResponse.text;
    if (!outputText) {
      throw new Error("No output received from the Gemini AI model.");
    }

    const payload = JSON.parse(outputText);
    res.json({
      success: true,
      trendData: payload.analyzedTestimonials
    });
  } catch (error: any) {
    console.error("Gemini sentiment trend analyzer failed:", error);
    res.status(500).json({ error: error.message || "Failed to process testimonials sentiment trend." });
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
