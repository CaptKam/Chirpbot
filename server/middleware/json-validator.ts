
import { Request, Response, NextFunction } from 'express';

export interface JsonValidationError {
  success: false;
  message: string;
  code: 'invalid_request' | 'malformed_json' | 'missing_body';
  details?: string;
}

export function jsonValidator(req: Request, res: Response, next: NextFunction) {
  // Skip validation for GET requests
  if (req.method === 'GET') {
    return next();
  }

  // Check if content-type is JSON
  const contentType = req.headers['content-type'];
  if (contentType && contentType.includes('application/json')) {
    // Check if body exists
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: "Request body is required for JSON requests",
        code: "missing_body"
      } as JsonValidationError);
    }

    // Check if body is valid object
    if (typeof req.body === 'string') {
      try {
        req.body = JSON.parse(req.body);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "malformed JSON",
          code: "invalid_request",
          details: error instanceof Error ? error.message : "Unknown JSON parsing error"
        } as JsonValidationError);
      }
    }
  }

  next();
}

export function handleJsonParseError(error: any, req: Request, res: Response, next: NextFunction) {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({
      success: false,
      message: "malformed JSON",
      code: "invalid_request",
      details: "Invalid JSON syntax in request body"
    } as JsonValidationError);
  }
  next(error);
}
