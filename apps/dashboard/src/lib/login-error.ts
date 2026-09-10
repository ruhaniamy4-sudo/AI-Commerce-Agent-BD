export function credentialSignInErrorMessage(code?: string) {
  if (code === 'EMAIL_NOT_VERIFIED') {
    return 'Please verify your email before signing in. Check your inbox or use Resend verification below.';
  }
  if (code === 'BUSINESS_ID_REQUIRED') {
    return 'Enter the Business ID for the workspace you want to access.';
  }
  if (code === 'BUSINESS_INACTIVE') {
    return 'This business workspace is currently inactive.';
  }
  if (code === 'BACKEND_UNAVAILABLE') {
    return 'The authentication service is unavailable. Please try again shortly.';
  }
  return 'Invalid email or password.';
}
