/**
 * OIDC_TLS_NO_VERIFY and LDAP_TLS_NO_VERIFY are gone (082): the sign-in server's certificate is
 * always checked. Someone who still sets one learns why sign-in now fails on a certificate and
 * how to trust their CA instead, rather than seeing the option silently do nothing.
 */
export function removedTlsOptionWarning(name: string, value: string | undefined): string | null {
  if (value?.trim().toLowerCase() !== 'true') return null;
  return (
    `${name} is no longer supported: the certificate of the sign-in server is always verified. ` +
    'If it is signed by an internal CA, give that CA to the API in VISION_EXTRA_CA_FILE (PEM).'
  );
}
