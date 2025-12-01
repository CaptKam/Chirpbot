export const successResponse = <T>(data: T, message?: string) => ({
  success: true,
  data,
  message,
  timestamp: new Date().toISOString()
});

export const errorResponse = (error: string, message?: string, details?: any) => ({
  success: false,
  error,
  message,
  details,
  timestamp: new Date().toISOString()
});

export const paginatedResponse = <T>(data: T[], count: number, page?: number, limit?: number) => ({
  success: true,
  data,
  count,
  page,
  limit,
  timestamp: new Date().toISOString()
});
