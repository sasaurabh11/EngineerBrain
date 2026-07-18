export type AiProvider = "GEMINI" | "GROQ";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  profileImage: string | null;
  createdAt: string;
  updatedAt: string;
  aiProvider: AiProvider;
  hasGeminiKey: boolean;
  hasGroqKey: boolean;
}

export interface UpdateAiSettingsInput {
  provider?: AiProvider;
  /** undefined = leave unchanged, null = remove the stored key, string = set a new key. */
  geminiApiKey?: string | null;
  groqApiKey?: string | null;
}
