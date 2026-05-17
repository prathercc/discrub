import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_PRESETS,
  defaultTextFormatOptions,
  initialExportState,
} from './exportTypes';

describe('exportTypes — Plain Text (#184)', () => {
  it('exposes the four defaults that match the signed-off format', () => {
    expect(defaultTextFormatOptions).toEqual({
      attachmentStyle: 'inline',
      reactions: 'include',
      replies: 'quote',
      botIndicator: 'include',
    });
  });

  it('seeds initialExportState.textOptions with the same defaults', () => {
    expect(initialExportState.textOptions).toEqual(defaultTextFormatOptions);
  });

  it('does NOT default the format to text (HTML stays the boot default)', () => {
    expect(initialExportState.exportFormat).toBe('html');
  });

  it('includes a builtin Plain Text preset with the agreed shape', () => {
    const plain = BUILT_IN_PRESETS.find((p) => p.id === 'builtin-plain-text');
    expect(plain).toBeDefined();
    expect(plain!).toMatchObject({
      id: 'builtin-plain-text',
      name: 'Plain text',
      isBuiltIn: true,
      category: 'Backup',
      format: 'text',
      includeMedia: false,
      separateThreads: false,
    });
    expect(plain!.textOptions).toEqual(defaultTextFormatOptions);
  });
});
