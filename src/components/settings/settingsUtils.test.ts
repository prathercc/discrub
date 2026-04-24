import { describe, it, expect } from 'vitest';
import {
  validateSettings,
} from './settingsUtils';
import type { AppSettings } from 'discrub-core/types/discrub-types';
import { DiscrubSetting } from 'discrub-core/discrub-enum';

describe('settingsUtils', () => {
  describe('validateSettings', () => {
    const createSettings = (overrides: Partial<AppSettings> = {}): AppSettings => ({
      [DiscrubSetting.EXPORT_MESSAGES_PER_PAGE]: '100',
      [DiscrubSetting.CACHED_ANNOUNCEMENT_REV]: '0',
      ...overrides,
    } as AppSettings);

    describe('valid settings', () => {
      it('should return empty array for valid settings', () => {
        const settings = createSettings();
        const errors = validateSettings(settings);
        expect(errors).toEqual([]);
      });

      it('should accept minimum messages per page (1)', () => {
        const settings = createSettings({
          [DiscrubSetting.EXPORT_MESSAGES_PER_PAGE]: '1',
        });
        const errors = validateSettings(settings);
        expect(errors).toEqual([]);
      });

      it('should accept maximum messages per page (1000)', () => {
        const settings = createSettings({
          [DiscrubSetting.EXPORT_MESSAGES_PER_PAGE]: '1000',
        });
        const errors = validateSettings(settings);
        expect(errors).toEqual([]);
      });

      it('should accept middle range messages per page', () => {
        const settings = createSettings({
          [DiscrubSetting.EXPORT_MESSAGES_PER_PAGE]: '500',
        });
        const errors = validateSettings(settings);
        expect(errors).toEqual([]);
      });

      it('should accept zero cached announcement revision', () => {
        const settings = createSettings({
          [DiscrubSetting.CACHED_ANNOUNCEMENT_REV]: '0',
        });
        const errors = validateSettings(settings);
        expect(errors).toEqual([]);
      });

      it('should accept positive cached announcement revision', () => {
        const settings = createSettings({
          [DiscrubSetting.CACHED_ANNOUNCEMENT_REV]: '42',
        });
        const errors = validateSettings(settings);
        expect(errors).toEqual([]);
      });
    });

    describe('invalid messages per page', () => {
      it('should reject messages per page less than 1', () => {
        const settings = createSettings({
          [DiscrubSetting.EXPORT_MESSAGES_PER_PAGE]: '0',
        });
        const errors = validateSettings(settings);
        expect(errors).toContain('Messages per page must be between 1 and 1000');
      });

      it('should reject negative messages per page', () => {
        const settings = createSettings({
          [DiscrubSetting.EXPORT_MESSAGES_PER_PAGE]: '-5',
        });
        const errors = validateSettings(settings);
        expect(errors).toContain('Messages per page must be between 1 and 1000');
      });

      it('should reject messages per page greater than 1000', () => {
        const settings = createSettings({
          [DiscrubSetting.EXPORT_MESSAGES_PER_PAGE]: '1001',
        });
        const errors = validateSettings(settings);
        expect(errors).toContain('Messages per page must be between 1 and 1000');
      });

      it('should reject non-numeric messages per page', () => {
        const settings = createSettings({
          [DiscrubSetting.EXPORT_MESSAGES_PER_PAGE]: 'invalid',
        });
        const errors = validateSettings(settings);
        expect(errors).toContain('Messages per page must be between 1 and 1000');
      });

      it('should reject decimal messages per page', () => {
        const settings = createSettings({
          [DiscrubSetting.EXPORT_MESSAGES_PER_PAGE]: '50.5',
        });
        // parseInt will parse as 50, which is valid
        const errors = validateSettings(settings);
        expect(errors).toEqual([]);
      });

      it('should reject empty string messages per page', () => {
        const settings = createSettings({
          [DiscrubSetting.EXPORT_MESSAGES_PER_PAGE]: '',
        });
        const errors = validateSettings(settings);
        expect(errors).toContain('Messages per page must be between 1 and 1000');
      });
    });

    describe('invalid cached announcement revision', () => {
      it('should reject negative cached announcement revision', () => {
        const settings = createSettings({
          [DiscrubSetting.CACHED_ANNOUNCEMENT_REV]: '-1',
        });
        const errors = validateSettings(settings);
        expect(errors).toContain('Cached announcement revision must be a non-negative number');
      });

      it('should reject non-numeric cached announcement revision', () => {
        const settings = createSettings({
          [DiscrubSetting.CACHED_ANNOUNCEMENT_REV]: 'abc',
        });
        const errors = validateSettings(settings);
        expect(errors).toContain('Cached announcement revision must be a non-negative number');
      });

      it('should reject empty string cached announcement revision', () => {
        const settings = createSettings({
          [DiscrubSetting.CACHED_ANNOUNCEMENT_REV]: '',
        });
        const errors = validateSettings(settings);
        expect(errors).toContain('Cached announcement revision must be a non-negative number');
      });
    });

    describe('multiple errors', () => {
      it('should return multiple errors when multiple validations fail', () => {
        const settings = createSettings({
          [DiscrubSetting.EXPORT_MESSAGES_PER_PAGE]: 'invalid',
          [DiscrubSetting.CACHED_ANNOUNCEMENT_REV]: '-5',
        });
        const errors = validateSettings(settings);
        expect(errors).toHaveLength(2);
        expect(errors).toContain('Messages per page must be between 1 and 1000');
        expect(errors).toContain('Cached announcement revision must be a non-negative number');
      });
    });
  });

});
