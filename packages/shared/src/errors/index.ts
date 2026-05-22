/**
 * Domain errors used across services.
 */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, cause);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 'NOT_FOUND', 404);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', public readonly retryAfterSeconds: number) {
    super(message, 'RATE_LIMIT', 429);
  }
}

export class PromptInjectionError extends AppError {
  constructor(message = 'Suspicious input detected') {
    super(message, 'PROMPT_INJECTION_DETECTED', 400);
  }
}

export class LLMError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'LLM_ERROR', 502, cause);
  }
}
