import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  GEMINI_API_KEY_ID: z.string().min(1),
  GEMINI_API_KEY_COR: z.string().min(1),
  GEMINI_API_KEY_COG: z.string().min(1),
  GEMINI_MODEL_ID: z.string().default('gemini-flash-latest'),
  GEMINI_MODEL_COR: z.string().default('gemini-flash-latest'),
  GEMINI_MODEL_COG: z.string().default('gemini-flash-latest'),
  GROQ_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.preprocess((val) => {
    if (typeof val === 'string' && val !== '') return Number(val)
    if (typeof val === 'number') return val
    return undefined
  }, z.number().int().positive()),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().email(),
  POLYGON_AMOY_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
})

let _env: z.infer<typeof envSchema> | null = null

export function getEnv() {
  if (_env) return _env

  try {
    // parse will throw a ZodError if validation fails
    _env = envSchema.parse(process.env as Record<string, unknown>)
    return _env
  } catch (err) {
    // provide a clear runtime error for missing/invalid env variables
    // Log the full Zod error when available to help debugging in server logs
    // and then throw a concise error to halt startup.
    // eslint-disable-next-line no-console
    if (err && typeof err === 'object' && 'issues' in err) {
      // eslint-disable-next-line no-console
      console.error('Environment validation error:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2))
    } else {
      // eslint-disable-next-line no-console
      console.error('Environment validation error:', err)
    }

    throw new Error('Invalid or missing environment variables. Check server logs for details.')
  }
}

export const env = getEnv()

export default env
