import { missingCreds, buildJin10SubscribeParams } from '../../modules/newswire/adapters.js';

describe('newswire creds & jin10 params (BASE-016 N2)', () => {
  describe('missingCreds', () => {
    it('tree never needs creds', () => {
      expect(missingCreds('tree', {})).toBe(false);
      expect(missingCreds('tree', undefined)).toBe(false);
    });
    it('fj needs apiKey', () => {
      expect(missingCreds('fj', {})).toBe(true);
      expect(missingCreds('fj', { fj: { apiKey: 'k' } })).toBe(false);
    });
    it('alpaca needs BOTH keyId and secret', () => {
      expect(missingCreds('alpaca', { alpaca: { keyId: 'a' } })).toBe(true);
      expect(missingCreds('alpaca', { alpaca: { secret: 's' } })).toBe(true);
      expect(missingCreds('alpaca', { alpaca: { keyId: 'a', secret: 's' } })).toBe(false);
    });
    it('jin10 needs secretKey; unknown source always missing', () => {
      expect(missingCreds('jin10', {})).toBe(true);
      expect(missingCreds('jin10', { jin10: { secretKey: 'k' } })).toBe(false);
      expect(missingCreds('benzinga', { benzinga: { token: 'x' } })).toBe(true);
    });
  });

  describe('buildJin10SubscribeParams', () => {
    it('uses configured categories and traditional language', () => {
      expect(buildJin10SubscribeParams({ categories: ['1', '3'], language: 'traditional' }))
        .toEqual({ category: ['1', '3'], language: 'traditional' });
    });
    it('falls back to category ["1"] when empty/missing; omits language otherwise', () => {
      expect(buildJin10SubscribeParams({})).toEqual({ category: ['1'] });
      expect(buildJin10SubscribeParams({ categories: [], language: undefined })).toEqual({ category: ['1'] });
      expect(buildJin10SubscribeParams({ categories: [' ', ''] })).toEqual({ category: ['1'] });
    });
    it('stringifies numeric categories', () => {
      expect(buildJin10SubscribeParams({ categories: [2, 5] })).toEqual({ category: ['2', '5'] });
    });
  });
});
