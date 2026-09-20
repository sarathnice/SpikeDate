import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[A-Z]/, 'Include an uppercase letter.')
  .regex(/[a-z]/, 'Include a lowercase letter.')
  .regex(/[0-9]/, 'Include a number.');

export function isAdult(birthDate: string, now = new Date()) {
  if (!z.iso.date().safeParse(birthDate).success) return false;
  const birthday = new Date(`${birthDate}T00:00:00Z`);
  const threshold = new Date(
    Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()),
  );
  return birthday <= threshold;
}

export type SignupDetails = {
  birthDate: string;
  gender: string;
  termsAccepted: boolean;
};

export function heightToCentimeters(value: string) {
  const metric = value.trim().match(/^(\d{3})\s*cm$/i);
  const imperial = value.trim().match(/^(\d)['′]\s*(\d{1,2})(?:["″])?$/);
  const inches = imperial ? Number(imperial[2]) : 0;
  const height = metric
    ? Number(metric[1])
    : imperial && inches < 12
      ? Math.round((Number(imperial[1]) * 12 + inches) * 2.54)
      : 0;
  return height >= 120 && height <= 230 ? height : null;
}
