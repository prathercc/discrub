import { describe, it, expect } from 'vitest';
import {
  generateDiscordShellSingle,
  generateDiscordShellBulk,
  type DiscordShellOptions,
} from './exportDiscordShell';
import { resolveExportThemeSet } from './exportThemes';

const baseOptions: DiscordShellOptions = {
  serverName: 'Test Server',
  channels: [
    { id: 'ch1', name: 'general', filename: 'general/general.html' },
    { id: 'ch2', name: 'dev-chat', filename: 'dev-chat/dev-chat.html' },
    { id: 'ch3', name: 'random', filename: 'random/random.html' },
  ],
  activeChannelId: 'ch1',
  isDM: false,
  exportDate: 'March 21, 2026',
};

const dmOptions: DiscordShellOptions = {
  serverName: 'Direct Messages',
  channels: [
    { id: 'dm1', name: 'alice', filename: 'alice/alice.html' },
  ],
  activeChannelId: 'dm1',
  isDM: true,
  dmRecipients: [
    { name: 'alice', avatar: '' },
  ],
  exportDate: 'March 21, 2026',
};

describe('generateDiscordShellSingle', () => {
  it('produces valid HTML document', () => {
    const html = generateDiscordShellSingle('<p>Hello</p>', baseOptions);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  it('contains server sidebar with server name', () => {
    const html = generateDiscordShellSingle('<p>Test</p>', baseOptions);
    expect(html).toContain('class="server-sidebar"');
    expect(html).toContain('Test Server');
  });

  it('contains server icon placeholder with first letter', () => {
    const html = generateDiscordShellSingle('<p>Test</p>', baseOptions);
    expect(html).toContain('>T</');
  });

  it('contains channel sidebar with channel list', () => {
    const html = generateDiscordShellSingle('<p>Test</p>', baseOptions);
    expect(html).toContain('class="channel-sidebar"');
    expect(html).toContain('general');
    expect(html).toContain('dev-chat');
    expect(html).toContain('random');
  });

  it('active channel is marked', () => {
    const html = generateDiscordShellSingle('<p>Test</p>', baseOptions);
    expect(html).toContain('class="channel-item active"');
    expect(html).toContain('data-channel-id="ch1"');
  });

  it('contains top bar with active channel name', () => {
    const html = generateDiscordShellSingle('<p>Test</p>', baseOptions);
    expect(html).toContain('class="shell-topbar"');
    expect(html).toContain('general');
  });

  it('contains main content area with content in srcdoc iframe', () => {
    const html = generateDiscordShellSingle('<p>Hello World</p>', baseOptions);
    expect(html).toContain('shell-content');
    expect(html).toContain('Hello World');
  });

  it('uses iframe with srcdoc for single channel content', () => {
    const html = generateDiscordShellSingle('<p>Test</p>', baseOptions);
    expect(html).toContain('<iframe');
    expect(html).toContain('srcdoc=');
  });

  it('contains the theme dropdown', () => {
    const html = generateDiscordShellSingle('<p>Test</p>', baseOptions);
    expect(html).toContain('id="shell-theme-select"');
    expect(html).toContain('<option value="discord-dark" selected>');
    expect(html).toContain('<option value="discord-light">');
  });

  it('contains Discord-themed CSS with grid layout', () => {
    const html = generateDiscordShellSingle('<p>Test</p>', baseOptions);
    expect(html).toContain('grid-template-columns: 72px 240px 1fr');
  });

  it('contains Discord home icon SVG', () => {
    const html = generateDiscordShellSingle('<p>Test</p>', baseOptions);
    expect(html).toContain('class="server-icon-home"');
    expect(html).toContain('<svg');
  });

  it('contains user status bar with export date', () => {
    const html = generateDiscordShellSingle('<p>Test</p>', baseOptions);
    expect(html).toContain('class="user-status-bar"');
    expect(html).toContain('March 21, 2026');
  });

  it('title includes server and channel name', () => {
    const html = generateDiscordShellSingle('<p>Test</p>', baseOptions);
    expect(html).toContain('<title>Test Server — #general</title>');
  });
});

describe('generateDiscordShellBulk', () => {
  it('produces valid HTML document', () => {
    const html = generateDiscordShellBulk(baseOptions);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('uses iframe for content', () => {
    const html = generateDiscordShellBulk(baseOptions);
    expect(html).toContain('<iframe');
    expect(html).toContain('id="channel-frame"');
  });

  it('iframe points to first channel filename', () => {
    const html = generateDiscordShellBulk(baseOptions);
    expect(html).toContain('src="general/general.html"');
  });

  it('lists all channels in sidebar', () => {
    const html = generateDiscordShellBulk(baseOptions);
    expect(html).toContain('general');
    expect(html).toContain('dev-chat');
    expect(html).toContain('random');
  });

  it('contains channel navigation JS', () => {
    const html = generateDiscordShellBulk(baseOptions);
    expect(html).toContain('activateChannel');
    expect(html).toContain('isBulk');
  });

  it('JS contains channel data', () => {
    const html = generateDiscordShellBulk(baseOptions);
    expect(html).toContain('"id":"ch1"');
    expect(html).toContain('"name":"general"');
  });
});

describe('DM mode', () => {
  it('shows DM recipient names instead of channel names', () => {
    const html = generateDiscordShellSingle('<p>DM</p>', dmOptions);
    expect(html).toContain('alice');
    expect(html).toContain('dm-item');
  });

  it('shows @ prefix in top bar instead of #', () => {
    const html = generateDiscordShellSingle('<p>DM</p>', dmOptions);
    expect(html).toContain('>@</span>');
  });

  it('shows "Direct Messages" as header', () => {
    const html = generateDiscordShellSingle('<p>DM</p>', dmOptions);
    expect(html).toContain('Direct Messages');
  });

  it('shows DM avatar placeholder', () => {
    const html = generateDiscordShellSingle('<p>DM</p>', dmOptions);
    expect(html).toContain('dm-avatar-placeholder');
  });

  it('disables non-exported DMs when exportedChannelIds is set', () => {
    const opts: DiscordShellOptions = {
      ...dmOptions,
      channels: [
        { id: 'dm1', name: 'alice', filename: 'alice.html' },
        { id: 'dm2', name: 'bob', filename: 'bob.html' },
      ],
      dmRecipients: [
        { name: 'alice' },
        { name: 'bob' },
      ],
      exportedChannelIds: ['dm1'],
    };
    const html = generateDiscordShellSingle('<p>DM</p>', opts);
    // alice should be active, bob should be disabled
    expect(html).toContain('dm-item active');
    expect(html).toContain('dm-item disabled');
  });
});

describe('Channel categories', () => {
  it('groups channels by category', () => {
    const opts: DiscordShellOptions = {
      ...baseOptions,
      channels: [
        { id: 'ch1', name: 'general', filename: 'general.html', category: 'Text Channels' },
        { id: 'ch2', name: 'voice-chat', filename: 'voice.html', category: 'Voice' },
      ],
    };
    const html = generateDiscordShellSingle('<p>Test</p>', opts);
    expect(html).toContain('TEXT CHANNELS');
    expect(html).toContain('VOICE');
    expect(html).toContain('channel-category');
  });
});

describe('Disabled non-exported channels', () => {
  it('marks non-exported channels as disabled', () => {
    const opts: DiscordShellOptions = {
      ...baseOptions,
      exportedChannelIds: ['ch1'], // only ch1 was exported
    };
    const html = generateDiscordShellSingle('<p>Test</p>', opts);
    // ch1 should be active, not disabled
    expect(html).toContain('class="channel-item active"');
    // ch2 and ch3 should be disabled
    expect(html).toMatch(/class="channel-item disabled"[^>]*data-channel-id="ch2"/);
    expect(html).toMatch(/class="channel-item disabled"[^>]*data-channel-id="ch3"/);
  });

  it('all channels clickable when exportedChannelIds not provided', () => {
    const html = generateDiscordShellSingle('<p>Test</p>', baseOptions);
    expect(html).not.toContain('channel-item disabled');
  });

  it('disabled channels have pointer-events none in CSS', () => {
    const html = generateDiscordShellSingle('<p>Test</p>', baseOptions);
    expect(html).toContain('.channel-item.disabled');
    expect(html).toContain('pointer-events: none');
  });
});

describe('Theme set embedding (slot E)', () => {
  it('defaults to the free set with Discord Dark baked', () => {
    const html = generateDiscordShellBulk(baseOptions);
    expect(html).toContain('<option value="discord-dark" selected>');
    expect(html).not.toContain('shell-theme-synthwave');
  });

  it('embeds a passed supporter set with its default selected', () => {
    const themeSet = resolveExportThemeSet({ themeSetting: 'synthwave', isSupporter: true });
    const html = generateDiscordShellBulk({ ...baseOptions, themeSet });
    expect(html).toContain('<option value="synthwave" selected>');
    expect(html).toContain('.shell-theme-synthwave {');
    // The baked default lands on :root, not just in a class.
    expect(html).toMatch(/:root \{[^}]*--shell-bg: #16102b/);
  });

  it('embeds the free-set default when the active theme is free', () => {
    const themeSet = resolveExportThemeSet({ themeSetting: 'terminal', isSupporter: false });
    const html = generateDiscordShellSingle('<p>Test</p>', { ...baseOptions, themeSet });
    expect(html).toContain('<option value="terminal" selected>');
    expect(html).toContain('.shell-theme-terminal {');
  });

  it('ships the theme id postMessage protocol with legacy value mapping', () => {
    const html = generateDiscordShellBulk(baseOptions);
    expect(html).toContain("type: 'discrub-theme', themeId:");
    expect(html).toContain("if (id === 'light') id = 'discord-light'");
    expect(html).toContain("localStorage.getItem(THEME_KEY)");
  });
});

describe('Theme and responsive', () => {
  it('includes light theme CSS variables', () => {
    const html = generateDiscordShellSingle('<p>Test</p>', baseOptions);
    expect(html).toContain('.shell-theme-discord-light');
    expect(html).toContain('--shell-bg: #e3e5e8');
  });

  it('includes responsive breakpoint', () => {
    const html = generateDiscordShellSingle('<p>Test</p>', baseOptions);
    expect(html).toContain('@media (max-width: 768px)');
  });

  it('includes print styles that hide sidebars', () => {
    const html = generateDiscordShellSingle('<p>Test</p>', baseOptions);
    expect(html).toContain('@media print');
  });

  it('theme toggle persists via localStorage', () => {
    const html = generateDiscordShellSingle('<p>Test</p>', baseOptions);
    expect(html).toContain('localStorage');
    expect(html).toContain('discrub-shell-theme');
  });
});
