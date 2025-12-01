import { z } from "zod";

export const updateUserProfileSchema = z.object({
  telegramEnabled: z.boolean().optional(),
  telegramBotToken: z.string().optional(),
  telegramChatId: z.string().optional(),
  oddsApiEnabled: z.boolean().optional(),
  oddsApiKey: z.string().optional(),
}).strict();

export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  count: number;
  page?: number;
  limit?: number;
}
