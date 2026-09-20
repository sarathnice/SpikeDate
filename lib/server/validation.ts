import { z } from 'zod';
export { passwordSchema, isAdult } from '@/lib/account-validation';
import { passwordSchema } from '@/lib/account-validation';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

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

export function validationError(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
