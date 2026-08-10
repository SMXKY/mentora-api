const DEFAULT_COUNTRY_CODE = "+237";

// A bare Cameroon mobile number with no country code at all: 9 digits,
// starting 6-9 (matches the local part of CAMEROON_PHONE_REGEX in
// auth.service.ts, just without the +237 prefix).
const BARE_LOCAL_NUMBER = /^[6-9][0-9]{8}$/;

/**
 * Prepends the default country code to a bare local phone number
 * ("677700900" -> "+237677700900") so a user never has to type the
 * country code at login/OTP/reset time. Anything that is not a bare
 * local number (already has a country code, is an email identifier,
 * or is malformed) passes through untouched — existing validation
 * further down still catches those cases exactly as before.
 */
export function normalizePhoneIfLocal(value: string): string {
  const trimmed = value.trim();
  return BARE_LOCAL_NUMBER.test(trimmed) ? `${DEFAULT_COUNTRY_CODE}${trimmed}` : trimmed;
}
