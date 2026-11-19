import { removedTlsOptionWarning } from './removed-tls-option';

describe('removedTlsOptionWarning', () => {
  it('tells someone who still turns verification off how to trust their CA instead', () => {
    const warning = removedTlsOptionWarning('LDAP_TLS_NO_VERIFY', ' TRUE ');

    expect(warning).toContain('LDAP_TLS_NO_VERIFY is no longer supported');
    expect(warning).toContain('VISION_EXTRA_CA_FILE');
  });

  it.each([undefined, '', 'false', 'no'])('says nothing when the option is %p', (value) => {
    expect(removedTlsOptionWarning('OIDC_TLS_NO_VERIFY', value)).toBeNull();
  });
});
