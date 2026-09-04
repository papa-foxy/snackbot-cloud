import type { HashError } from '../types';

export const LINK_ERROR_MESSAGES: Record<string, string> = {
  otp_expired: 'Your password-reset link has expired. Please request a new one.',
  access_denied: 'This link is no longer valid. Please request a new reset link.',
};

/**
 * Parse Supabase error params that land in the URL hash
 * (e.g. #error=access_denied&error_code=otp_expired)
 */
export function parseHashError(): HashError | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const errorCode = params.get('error_code') ?? params.get('error') ?? '';
  const description = params.get('error_description')?.replace(/\+/g, ' ') ?? '';
  if (!errorCode) return null;
  return { errorCode, description };
}
