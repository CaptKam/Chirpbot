
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code: string;
  details?: any;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

export function createSuccessResponse<T>(data: T, message?: string): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    ...(message && { message })
  };
}

export function createErrorResponse(message: string, code: string, details?: any): ApiErrorResponse {
  return {
    success: false,
    message,
    code,
    ...(details && { details })
  };
}

export function handleApiError(error: any, defaultMessage: string = "Internal server error"): ApiErrorResponse {
  if (error.code === 'invalid_request' || error.code === 'malformed_json') {
    return error;
  }
  
  return createErrorResponse(
    error.message || defaultMessage,
    error.code || 'internal_error',
    process.env.NODE_ENV === 'development' ? error.stack : undefined
  );
}
