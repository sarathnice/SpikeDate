import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[A-Z]/, 'Include an uppercase letter.')
  .regex(/[a-z]/, 'Include a lowercase letter.')
  .regex(/[0-9]/, 'Include a number.');

export const registrationSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  birthDate: z.iso.date(),
  termsAccepted: z.literal(true),
  displayName: z.string().trim().min(2).max(50),
  gender: z.string().trim().min(1).max(50),
  relationshipGoal: z.string().trim().min(1).max(80),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export function isAdult(birthDate: string, now = new Date()) {
  const birthday = new Date(birthDate + 'T00:00:00Z');
  if (Number.isNaN(birthday.getTime())) return false;
  const threshold = new Date(
    Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()),
  );
  return birthday <= threshold;
}

export function validationError(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
