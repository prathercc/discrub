import { useState, useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Box, ToggleButtonGroup, ToggleButton, Typography } from '@mui/material';
import { getExportService } from '@services/exportService';
import { generateDiscordShellSingle, generateDiscordShellBulk } from '@services/exportDiscordShell';
import {
  EXPORT_MESSAGES,
  THREAD_MESSAGES,
  DM_MESSAGES,
  REPLY_MESSAGES,
  EDITED_MESSAGES,
  CODE_SPOILER_MESSAGES,
  GROUPED_MESSAGES,
  MEDIA_HEAVY_MESSAGES,
  COMPREHENSIVE_MESSAGES,
  DEFAULT_EXPORT_CONFIG,
  AUTHOR_ALICE,
  AUTHOR_BOB,
  AUTHOR_CHARLIE,
  AUTHOR_DAVE,
  AUTHOR_EVE,
  AUTHOR_BOT,
  STORYBOOK_MEDIA_MAPS,
  STORYBOOK_GUILD_ID,
  STORYBOOK_GUILD_ROLES,
  STORYBOOK_USER_MAP,
} from '@/test/export-html-fixtures';
import type { HtmlFormattingContext } from 'discrub-core/types/html-formatting-types';

const FORMATTING_CONTEXT: HtmlFormattingContext = {
  userMap: {
    [AUTHOR_ALICE.id]: { userName: AUTHOR_ALICE.username, displayName: AUTHOR_ALICE.global_name || undefined },
    [AUTHOR_BOB.id]: { userName: AUTHOR_BOB.username, displayName: AUTHOR_BOB.global_name || undefined },
    [AUTHOR_CHARLIE.id]: { userName: AUTHOR_CHARLIE.username, displayName: AUTHOR_CHARLIE.global_name || undefined },
    [AUTHOR_DAVE.id]: { userName: AUTHOR_DAVE.username, displayName: AUTHOR_DAVE.global_name || undefined },
    [AUTHOR_EVE.id]: { userName: AUTHOR_EVE.username, displayName: AUTHOR_EVE.global_name || undefined },
    [AUTHOR_BOT.id]: { userName: AUTHOR_BOT.username, displayName: undefined },
  },
  channelMap: {
    '800000000000000099': { name: 'announcements' },
    'channel-123': { name: 'general' },
  },
  guildRoles: STORYBOOK_GUILD_ROLES as any,
};

function generateContent(
  messages: typeof EXPORT_MESSAGES,
  channelName: string,
  pageNumber = 1,
  totalPages = 1,
): string {
  const service = getExportService();
  const sanitizedName = channelName.replace(/[^a-z0-9-_]/gi, '-');
  return service.generateHTMLPage(
    messages, channelName, pageNumber, totalPages, STORYBOOK_MEDIA_MAPS,
    sanitizedName,
    FORMATTING_CONTEXT,
    DEFAULT_EXPORT_CONFIG,
    undefined,
    undefined,
    STORYBOOK_USER_MAP,
    STORYBOOK_GUILD_ID,
  );
}

type Scenario = {
  name: string;
  generate: () => string;
};

const SCENARIOS: Record<string, Scenario> = {
  singleChannel: {
    name: 'Single Channel',
    generate: () => {
      const content = generateContent(EXPORT_MESSAGES, 'general');
      return generateDiscordShellSingle(content, {
        serverName: 'My Discord Server',
        channels: [
          { id: 'ch1', name: 'general', filename: 'general.html' },
          { id: 'ch2', name: 'dev-chat', filename: 'dev-chat.html' },
          { id: 'ch3', name: 'random', filename: 'random.html' },
          { id: 'ch4', name: 'memes', filename: 'memes.html', category: 'Fun' },
          { id: 'ch5', name: 'music', filename: 'music.html', category: 'Fun' },
          { id: 'ch6', name: 'bugs', filename: 'bugs.html', category: 'Development' },
          { id: 'ch7', name: 'feature-requests', filename: 'features.html', category: 'Development' },
        ],
        activeChannelId: 'ch1',
        isDM: false,
        exportDate: 'March 21, 2026',
        exportedChannelIds: ['ch1'], // Only general was exported
      });
    },
  },
  singleDM: {
    name: 'Single DM',
    generate: () => {
      const content = generateContent(DM_MESSAGES, 'alice');
      return generateDiscordShellSingle(content, {
        serverName: 'Direct Messages',
        channels: [
          { id: 'dm1', name: 'alice', filename: 'alice.html' },
        ],
        activeChannelId: 'dm1',
        isDM: true,
        dmRecipients: [
          { name: 'alice' },
          { name: 'bob' },
          { name: 'charlie' },
        ],
        exportDate: 'March 21, 2026',
        exportedChannelIds: ['dm1'], // Only alice DM was exported
      });
    },
  },
  bulkExport: {
    name: 'Bulk Export (5 channels)',
    generate: () => {
      return generateDiscordShellBulk({
        serverName: 'Gaming Community',
        channels: [
          { id: 'ch1', name: 'general', filename: 'general/general.html' },
          { id: 'ch2', name: 'announcements', filename: 'announcements/announcements.html' },
          { id: 'ch3', name: 'off-topic', filename: 'off-topic/off-topic.html' },
          { id: 'ch4', name: 'game-chat', filename: 'game-chat/game-chat.html', category: 'Gaming' },
          { id: 'ch5', name: 'lfg', filename: 'lfg/lfg.html', category: 'Gaming' },
        ],
        activeChannelId: 'ch1',
        isDM: false,
        exportDate: 'March 21, 2026',
      });
    },
  },
  mediaHeavy: {
    name: 'Media Heavy Channel',
    generate: () => {
      const content = generateContent(MEDIA_HEAVY_MESSAGES, 'media-showcase');
      return generateDiscordShellSingle(content, {
        serverName: 'Art Studio',
        channels: [
          { id: 'ch1', name: 'media-showcase', filename: 'media.html' },
          { id: 'ch2', name: 'commissions', filename: 'commissions.html' },
        ],
        activeChannelId: 'ch1',
        isDM: false,
        exportDate: 'March 21, 2026',
      });
    },
  },
  groupedMessages: {
    name: 'Grouped Messages',
    generate: () => {
      const content = generateContent(GROUPED_MESSAGES, 'chat');
      return generateDiscordShellSingle(content, {
        serverName: 'Dev Team',
        channels: [
          { id: 'ch1', name: 'chat', filename: 'chat.html' },
        ],
        activeChannelId: 'ch1',
        isDM: false,
        exportDate: 'March 21, 2026',
      });
    },
  },
  replyChains: {
    name: 'Reply Chains',
    generate: () => {
      const content = generateContent(REPLY_MESSAGES, 'discussion');
      return generateDiscordShellSingle(content, {
        serverName: 'Community Hub',
        channels: [
          { id: 'ch1', name: 'discussion', filename: 'discussion.html' },
          { id: 'ch2', name: 'help', filename: 'help.html' },
        ],
        activeChannelId: 'ch1',
        isDM: false,
        exportDate: 'March 21, 2026',
      });
    },
  },
  codeSpoilers: {
    name: 'Code & Spoilers',
    generate: () => {
      const content = generateContent(CODE_SPOILER_MESSAGES, 'dev-chat');
      return generateDiscordShellSingle(content, {
        serverName: 'Dev Team',
        channels: [
          { id: 'ch1', name: 'dev-chat', filename: 'dev-chat.html' },
        ],
        activeChannelId: 'ch1',
        isDM: false,
        exportDate: 'March 21, 2026',
      });
    },
  },
  editedMessages: {
    name: 'Edited Messages',
    generate: () => {
      const content = generateContent(EDITED_MESSAGES, 'general');
      return generateDiscordShellSingle(content, {
        serverName: 'Test Server',
        channels: [
          { id: 'ch1', name: 'general', filename: 'general.html' },
        ],
        activeChannelId: 'ch1',
        isDM: false,
        exportDate: 'March 21, 2026',
      });
    },
  },
  comprehensive: {
    name: 'Comprehensive (All Types)',
    generate: () => {
      const content = generateContent(COMPREHENSIVE_MESSAGES, 'general');
      return generateDiscordShellSingle(content, {
        serverName: 'Full Feature Server',
        channels: [
          { id: 'ch1', name: 'general', filename: 'general.html', category: 'Text Channels' },
          { id: 'ch2', name: 'media', filename: 'media.html', category: 'Text Channels' },
          { id: 'ch3', name: 'dev-chat', filename: 'dev.html', category: 'Development' },
          { id: 'ch4', name: 'bugs', filename: 'bugs.html', category: 'Development' },
        ],
        activeChannelId: 'ch1',
        isDM: false,
        exportDate: 'March 21, 2026',
      });
    },
  },
  multiPage1: {
    name: 'Multi-Page (Page 1 of 3)',
    generate: () => {
      const content = generateContent(EXPORT_MESSAGES.slice(0, 3), 'general', 1, 3);
      return generateDiscordShellSingle(content, {
        serverName: 'My Discord Server',
        channels: [
          { id: 'ch1', name: 'general', filename: 'general.html' },
          { id: 'ch2', name: 'dev-chat', filename: 'dev-chat.html' },
        ],
        activeChannelId: 'ch1',
        isDM: false,
        exportDate: 'March 21, 2026',
      });
    },
  },
  multiPage2: {
    name: 'Multi-Page (Page 2 of 3)',
    generate: () => {
      const content = generateContent(EXPORT_MESSAGES.slice(3, 6), 'general', 2, 3);
      return generateDiscordShellSingle(content, {
        serverName: 'My Discord Server',
        channels: [
          { id: 'ch1', name: 'general', filename: 'general.html' },
          { id: 'ch2', name: 'dev-chat', filename: 'dev-chat.html' },
        ],
        activeChannelId: 'ch1',
        isDM: false,
        exportDate: 'March 21, 2026',
      });
    },
  },
  multiPage3: {
    name: 'Multi-Page (Page 3 of 3)',
    generate: () => {
      const content = generateContent(EXPORT_MESSAGES.slice(6), 'general', 3, 3);
      return generateDiscordShellSingle(content, {
        serverName: 'My Discord Server',
        channels: [
          { id: 'ch1', name: 'general', filename: 'general.html' },
          { id: 'ch2', name: 'dev-chat', filename: 'dev-chat.html' },
        ],
        activeChannelId: 'ch1',
        isDM: false,
        exportDate: 'March 21, 2026',
      });
    },
  },
  threadExport: {
    name: 'Thread Export',
    generate: () => {
      const threadMsgs = THREAD_MESSAGES.filter((m) => m.channel_id === 'thread-001');
      const content = generateContent(threadMsgs, 'bug-discussion');
      return generateDiscordShellSingle(content, {
        serverName: 'Dev Team',
        channels: [
          { id: 'ch1', name: 'bug-discussion', filename: 'bug-discussion.html' },
        ],
        activeChannelId: 'ch1',
        isDM: false,
        exportDate: 'March 21, 2026',
      });
    },
  },
};

const DiscordShellPreview = () => {
  const [scenarioKey, setScenarioKey] = useState<string>('singleChannel');
  const scenario = SCENARIOS[scenarioKey];

  const html = useMemo(() => scenario.generate(), [scenarioKey]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider', backgroundColor: '#1e1e1e' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          Discord Shell: {scenario.name}
        </Typography>
        <ToggleButtonGroup
          value={scenarioKey}
          exclusive
          onChange={(_, val) => val && setScenarioKey(val)}
          size="small"
          sx={{
            flexWrap: 'wrap',
            gap: 0.5,
            '& .MuiToggleButton-root': { textTransform: 'none', fontSize: '0.75rem', px: 1, py: 0.25 },
          }}
        >
          {Object.entries(SCENARIOS).map(([key, s]) => (
            <ToggleButton key={key} value={key}>{s.name}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <iframe
          srcDoc={html}
          title={`Discord Shell: ${scenario.name}`}
          style={{ width: '100%', height: '100%', border: 'none' }}
          sandbox="allow-scripts"
        />
      </Box>
    </Box>
  );
};

const meta: Meta<typeof DiscordShellPreview> = {
  title: 'Export/Discord Shell Preview',
  component: DiscordShellPreview,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof DiscordShellPreview>;

export const Default: Story = {};
