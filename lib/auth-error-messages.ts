/** Map of machine-readable SSO error codes to user-friendly messages. */
const SSO_ERROR_MESSAGES: Record<string, string> = {
  invalid_request: 'The request was missing required parameters or was malformed.',
  unauthorized_client: "This application isn't set up for SSO sign-in. Contact your administrator.",
  invalid_redirect_uri: 'The redirect URL provided is not allowed for this application.',
  temporarily_unavailable: 'The SSO service is temporarily unavailable. Please try again later.',
  app_disabled: 'This application has been disabled by an administrator.',
  unknown_app: 'The application ID provided was not recognized.',
  access_denied: 'You do not have permission to access this application.',
  server_error: 'An unexpected error occurred. Please try again.',
};

/** Map machine-readable login error codes to user-friendly messages. */
const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  session_failed: 'We were unable to create your session. Please try signing in again.',
  code_exchange_failed: 'The authentication code could not be verified. It may have expired — please try signing in again.',
  auth_failed: 'Authentication failed. Please try signing in again.',
  access_denied: "Sign-in was cancelled or this account doesn't have access. Try again or contact your administrator.",
  invalid_token: 'The sign-in link is invalid or has expired. Please request a new one.',
  otp_expired: 'Your verification code has expired. Please request a new one.',
  server_error: 'The authentication provider returned an error. Please try signing in again.',
};

export function getErrorMessage(error: string | null): string {
  if (error && SSO_ERROR_MESSAGES[error]) {
    return SSO_ERROR_MESSAGES[error];
  }
  return 'An error occurred during the SSO process.';
}

export function getLoginErrorMessage(error: string | null): string | null {
  if (!error) return null;
  if (LOGIN_ERROR_MESSAGES[error]) return LOGIN_ERROR_MESSAGES[error];
  return 'An unexpected error occurred. Please try signing in again.';
}

export function resolveLoginUrlError(search: string, hash: string): {
  errorCode: string;
  errorDescription: string | null;
} | null {
  const params = new URLSearchParams(search);
  const errorParam = params.get('error');
  const errorCodeParam = params.get('error_code');
  const errorDescriptionParam = params.get('error_description');

  let hashError: string | null = null;
  let hashErrorCode: string | null = null;
  let hashErrorDescription: string | null = null;
  if (hash && hash.includes('error')) {
    const hashParams = new URLSearchParams(hash.substring(1));
    hashError = hashParams.get('error');
    hashErrorCode = hashParams.get('error_code');
    hashErrorDescription = hashParams.get('error_description');
  }

  const errorCode = errorCodeParam || hashErrorCode || errorParam || hashError;
  const errorDescription = errorDescriptionParam || hashErrorDescription;
  if (!errorCode && !errorDescription) return null;

  return {
    errorCode: errorCode || 'server_error',
    errorDescription,
  };
}
