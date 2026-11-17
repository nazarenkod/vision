import { featureToKeep } from './variation-feature';

describe('featureToKeep (067)', () => {
  it('takes the feature the test sent', () => {
    expect(featureToKeep('Deposits', '  Savings ')).toBe('Savings');
    expect(featureToKeep(null, 'Envelopes')).toBe('Envelopes');
  });

  it('keeps the stored feature when the test sent none', () => {
    expect(featureToKeep('Envelopes', undefined)).toBe('Envelopes');
    expect(featureToKeep('Envelopes', '   ')).toBe('Envelopes');
    expect(featureToKeep(null, '')).toBeNull();
  });

  it('keeps names that differ only in case apart', () => {
    expect(featureToKeep('Envelopes', 'envelopes')).toBe('envelopes');
  });
});
