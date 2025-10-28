// Error types for database operations
export class DatabaseError extends Error {
  constructor(message, operation, originalError = null) {
    super(message);
    this.name = "DatabaseError";
    this.operation = operation;
    this.originalError = originalError;
  }
}

export class WriteError extends DatabaseError {
  constructor(message, operation, originalError = null) {
    super(message, operation, originalError);
    this.name = "WriteError";
  }
}

// Retry mechanism for database operations
export const retryOperation = async (
  operation,
  maxRetries = 3,
  delay = 1000
) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
      }
    }
  }

  throw lastError;
};
