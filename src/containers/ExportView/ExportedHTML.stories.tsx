import { useState, useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Box, ToggleButtonGroup, ToggleButton, Typography } from '@mui/material';
import { getExportService } from '@services/exportService';
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
  LARGE_REACTION_MESSAGES,
  MOCK_LARGE_REACTION_DATA,
  DEFAULT_EXPORT_CONFIG,
  EXTENDED_USER_MAP as _EXTENDED_USER_MAP,
  EXPORT_GUILD_ID as _EXPORT_GUILD_ID,
  AUTHOR_ALICE,
  AUTHOR_BOB,
  AUTHOR_CHARLIE,
  MOCK_REACTION_DATA,
} from '@/test/export-html-fixtures';
import type { Message } from 'discrub-core/types/discord-types';
import type { ExportConfig } from '@features/export/exportTypes';
import type { HtmlFormattingContext } from 'discrub-core/types/html-formatting-types';
import type { ExportPageData } from '@/services/exportHtmlJs';

const FORMATTING_CONTEXT: HtmlFormattingContext = {
  userMap: {
    [AUTHOR_ALICE.id]: { userName: AUTHOR_ALICE.username, displayName: AUTHOR_ALICE.global_name || undefined },
    [AUTHOR_BOB.id]: { userName: AUTHOR_BOB.username, displayName: AUTHOR_BOB.global_name || undefined },
    [AUTHOR_CHARLIE.id]: { userName: AUTHOR_CHARLIE.username, displayName: AUTHOR_CHARLIE.global_name || undefined },
  },
  channelMap: {
    '800000000000000099': { name: 'some-channel' },
  },
};

type Scenario = {
  name: string;
  messages: Message[];
  channelName: string;
  pageNumber: number;
  totalPages: number;
  config?: Partial<ExportConfig>;
  mediaPathPrefix?: string;
};

const SCENARIOS: Record<string, Scenario> = {
  channel: {
    name: 'Channel Export',
    messages: EXPORT_MESSAGES,
    channelName: 'general',
    pageNumber: 1,
    totalPages: 1,
  },
  dm: {
    name: 'DM Export',
    messages: DM_MESSAGES,
    channelName: 'alice, bob',
    pageNumber: 1,
    totalPages: 1,
  },
  thread: {
    name: 'Thread Export',
    messages: THREAD_MESSAGES.filter((m) => m.channel_id === 'thread-001'),
    channelName: 'bug-discussion',
    pageNumber: 1,
    totalPages: 1,
    mediaPathPrefix: '../',
  },
  multiPage1: {
    name: 'Multi-Page (Page 1 of 3)',
    messages: EXPORT_MESSAGES.slice(0, 3),
    channelName: 'general',
    pageNumber: 1,
    totalPages: 3,
  },
  multiPage2: {
    name: 'Multi-Page (Page 2 of 3)',
    messages: EXPORT_MESSAGES.slice(3, 6),
    channelName: 'general',
    pageNumber: 2,
    totalPages: 3,
  },
  multiPage3: {
    name: 'Multi-Page (Page 3 of 3)',
    messages: EXPORT_MESSAGES.slice(6),
    channelName: 'general',
    pageNumber: 3,
    totalPages: 3,
  },
  mediaHeavy: {
    name: 'Media Heavy',
    messages: MEDIA_HEAVY_MESSAGES,
    channelName: 'media-showcase',
    pageNumber: 1,
    totalPages: 1,
  },
  codeSpoilers: {
    name: 'Code & Spoilers',
    messages: CODE_SPOILER_MESSAGES,
    channelName: 'dev-chat',
    pageNumber: 1,
    totalPages: 1,
  },
  replies: {
    name: 'Reply Chains',
    messages: REPLY_MESSAGES,
    channelName: 'discussion',
    pageNumber: 1,
    totalPages: 1,
  },
  edited: {
    name: 'Edited Messages',
    messages: EDITED_MESSAGES,
    channelName: 'general',
    pageNumber: 1,
    totalPages: 1,
  },
  grouped: {
    name: 'Message Grouping',
    messages: GROUPED_MESSAGES,
    channelName: 'general',
    pageNumber: 1,
    totalPages: 1,
  },
  comprehensive: {
    name: 'Comprehensive (All Types)',
    messages: COMPREHENSIVE_MESSAGES,
    channelName: 'general',
    pageNumber: 1,
    totalPages: 1,
  },
  largeReactions: {
    name: 'Large Reactions (50+ users)',
    messages: LARGE_REACTION_MESSAGES,
    channelName: 'popular-channel',
    pageNumber: 1,
    totalPages: 1,
  },
};

/**
 * HTML Export Preview — renders generated HTML in a sandboxed iframe.
 * Switch between scenarios to preview different export outputs.
 */
const HtmlExportPreview = () => {
  const [scenarioKey, setScenarioKey] = useState<string>('channel');

  const scenario = SCENARIOS[scenarioKey];

  const html = useMemo(() => {
    const service = getExportService();
    const config: ExportConfig = {
      ...DEFAULT_EXPORT_CONFIG,
      ...scenario.config,
    };

    let generatedHtml = service.generateHTMLPage(
      scenario.messages,
      scenario.channelName,
      scenario.pageNumber,
      scenario.totalPages,
      null,            // mediaMaps — no local media in stories
      scenario.channelName.replace(/[^a-z0-9-_]/gi, '-'),
      FORMATTING_CONTEXT,
      config,
      scenario.mediaPathPrefix,
    );

    // Inject mock reaction user data into the embedded JSON for Storybook preview
    generatedHtml = generatedHtml.replace(
      /<script type="application\/json" id="export-data">([\s\S]*?)<\/script>/,
      (match, jsonStr) => {
        try {
          const data: ExportPageData = JSON.parse(jsonStr);
          // Merge mock reaction user data into any matching message reactions
          const allMockData = { ...MOCK_REACTION_DATA, ...MOCK_LARGE_REACTION_DATA };
          for (const [msgId, emojiMap] of Object.entries(allMockData)) {
            if (data.reactions[msgId]) {
              for (const [emojiKey, reactionData] of Object.entries(emojiMap)) {
                if (data.reactions[msgId][emojiKey]) {
                  data.reactions[msgId][emojiKey].users = reactionData.users;
                }
              }
            }
          }
          return `<script type="application/json" id="export-data">${JSON.stringify(data)}</script>`;
        } catch {
          return match;
        }
      }
    );

    return generatedHtml;
  }, [scenario]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Scenario Selector */}
      <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider', backgroundColor: '#1e1e1e' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          Scenario: {scenario.name}
        </Typography>
        <ToggleButtonGroup
          value={scenarioKey}
          exclusive
          onChange={(_, val) => val && setScenarioKey(val)}
          size="small"
          sx={{
            flexWrap: 'wrap',
            gap: 0.5,
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontSize: '0.75rem',
              px: 1,
              py: 0.25,
            },
          }}
        >
          {Object.entries(SCENARIOS).map(([key, s]) => (
            <ToggleButton key={key} value={key}>
              {s.name}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* HTML Preview */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <iframe
          srcDoc={html}
          title={`Export Preview: ${scenario.name}`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          sandbox="allow-scripts"
        />
      </Box>
    </Box>
  );
};

const meta: Meta<typeof HtmlExportPreview> = {
  title: 'Export/HTML Export Preview',
  component: HtmlExportPreview,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof HtmlExportPreview>;

export const Default: Story = {};
