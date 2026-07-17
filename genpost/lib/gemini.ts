import { GoogleGenAI, Type } from "@google/genai";

// ─── Types ────────────────────────────────────────────────────────────────────
export type PostTopic = string; // user-defined
export type PostType = string;

export interface GeneratedPost {
  topic: string;
  type: PostType;
  content: string;
  character_count: number;
}

// ─── Suggested Topics ─────────────────────────────────────────────────────────
export const SUGGESTED_TOPICS = [
  "Python",
  "JavaScript / TypeScript",
  "AI & Machine Learning",
  "Backend Development",
  "Fullstack Development",
  "Data Science",
  "Databases & SQL",
  "Startups & Entrepreneurship",
  "Product Management",
  "Personal Finance",
  "Crypto & Web3",
  "Fitness & Health",
  "Content Creation",
  "Remote Work",
  "Career Growth",
  "Marketing & Growth",
  "Design & UX",
  "Mental Health",
  "Parenting",
  "Food & Cooking",
];

export const POST_TYPE_LABELS: Record<string, string> = {
  question: "Question",
  engagement_bait: "Hot Take",
  information: "Info / Tips",
  explanation: "Explanation",
  news: "News",
  joke: "Joke / Humor",
};

export const POST_TYPE_DESCRIPTIONS: Record<string, string> = {
  question: "Thought-provoking questions to spark replies",
  engagement_bait: "Hot takes, 'A vs B' choices, controversial opinions",
  information: "Tips, cheat sheets, productivity hacks",
  explanation: "ELI5 analogies, concept breakdowns",
  news: "Updates, announcements, trends",
  joke: "Relatable humor, dev jokes, funny observations",
};

// ─── Generator ────────────────────────────────────────────────────────────────
export async function generatePosts({
  topics,
  postTypes,
  count,
  additionalContext,
}: {
  topics: string[];
  postTypes: PostType[];
  count: number;
  additionalContext?: string;
}): Promise<GeneratedPost[]> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const topicsList = topics.join(", ");
  const typesList = postTypes.map((t) => POST_TYPE_LABELS[t] ?? t).join(", ");

  const prompt = `
Generate exactly ${count} high-quality, engaging social media posts for X (formerly Twitter).
The posts must raise engagement on the user's account (increase likes, retweets, and replies).

Topics to cover (distribute them roughly evenly across the ${count} posts):
${topicsList}

Post types to include (distribute evenly across the ${count} posts):
${postTypes
  .map((t) => `- ${POST_TYPE_LABELS[t] ?? t}: ${POST_TYPE_DESCRIPTIONS[t] ?? "Custom post type style specified by the user"}`)
  .join("\n")}

${additionalContext ? `Additional context about the user's brand/voice:\n${additionalContext}\n` : ""}

Format requirements:
- Each post content MUST be strictly under 200 characters.
- Make them sound like a real, experienced human writing them — no generic buzzword-filled templates.
- Use emojis extremely sparingly (maximum 1 emoji per post, or none at all).
- No hashtag overload — at most 1 hashtag if truly relevant.
- Each post must be standalone and complete.

Return ONLY valid JSON with a "posts" array. Do not include markdown or code fences.
`;

  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          posts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                type: {
                  type: Type.STRING,
                },
                content: { type: Type.STRING },
                character_count: { type: Type.NUMBER },
              },
              required: ["topic", "type", "content", "character_count"],
            },
          },
        },
        required: ["posts"],
      },
      temperature: 0.85,
    },
  });

  const data = JSON.parse(response.text ?? "{}");
  return (data.posts ?? []) as GeneratedPost[];
}
