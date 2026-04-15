import { validateJwtSecret } from "./jwt-validation";

export interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateEnvironmentVariables(): EnvValidationResult {
  const errors: string[] = [];

  const jwtSecret = process.env.JWT_SECRET;
  const jwtValidation = validateJwtSecret(jwtSecret);
  if (!jwtValidation.isValid) {
    errors.push(`JWT_SECRET: ${jwtValidation.error}`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }

  if (!supabaseAnonKey) {
    errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured");
  }

  if (!process.env.GEMINI_API_KEY) {
    console.warn(
      "GEMINI_API_KEY is not configured - document extraction will not work"
    );
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(
      "SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are not fully configured - email sending will not work"
    );
  }

  const polygonAmoyPrivateKey = process.env.POLYGON_AMOY_PRIVATE_KEY;
  if (polygonAmoyPrivateKey) {
    if (!polygonAmoyPrivateKey.startsWith("0x")) {
      errors.push("POLYGON_AMOY_PRIVATE_KEY must start with '0x'");
    } else if (polygonAmoyPrivateKey.length !== 66) {
      errors.push(
        "POLYGON_AMOY_PRIVATE_KEY must be 66 characters (0x + 64 hex characters)"
      );
    } else {
      const hexPattern = /^0x[0-9a-fA-F]{64}$/;
      if (!hexPattern.test(polygonAmoyPrivateKey)) {
        errors.push("POLYGON_AMOY_PRIVATE_KEY contains invalid hex characters");
      }
    }
  } else {
    console.warn(
      "POLYGON_AMOY_PRIVATE_KEY is not configured - blockchain logging will not work"
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function requireValidEnvironment(): void {
  const validation = validateEnvironmentVariables();
  if (!validation.isValid) {
    const errorMessage = `Environment validation failed:\n${validation.errors.join(
      "\n"
    )}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}
