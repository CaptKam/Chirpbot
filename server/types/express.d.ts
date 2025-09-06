declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email?: string;
        role?: string;
        telegramEnabled?: boolean;
        telegramBotToken?: string;
        telegramChatId?: string;
      };
    }
  }
}

export {};