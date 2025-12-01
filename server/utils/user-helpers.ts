export const sanitizeUserForClient = (user: any) => {
  const { telegramBotToken, oddsApiKey, password, ...safe } = user;

  return {
    ...safe,
    hasTelegramToken: !!telegramBotToken,
    hasOddsApiKey: !!oddsApiKey
  };
};

export const redactSensitiveFields = (data: any) => {
  if (!data || typeof data !== 'object') return data;

  const redacted = { ...data };
  if (redacted.telegramBotToken) redacted.telegramBotToken = '[REDACTED]';
  if (redacted.oddsApiKey) redacted.oddsApiKey = '[REDACTED]';
  if (redacted.password) redacted.password = '[REDACTED]';

  return redacted;
};
