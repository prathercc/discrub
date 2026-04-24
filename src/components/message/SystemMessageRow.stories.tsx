import type { Meta, StoryObj } from '@storybook/react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import theme from '@theme/theme';
import SystemMessageRow from './SystemMessageRow';
import type { Message } from 'discrub-core/types/discord-types';

const formattingContext = {
  userMap: {},
  channelMap: {},
  guildRoles: [],
  sanitizedName: 'general',
  guildName: 'Discrub Sandbox',
} as any;

const baseMessage = (type: number, overrides: Partial<Message> = {}): Message =>
  ({
    id: `sys-${type}`,
    channel_id: 'ch-1',
    author: {
      id: 'u1',
      username: 'testnickname',
      global_name: 'Test Nickname',
      discriminator: '0',
      avatar: null,
    },
    content: '',
    timestamp: '2026-06-15T14:30:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    pinned: false,
    type,
    ...overrides,
  }) as Message;

const meta: Meta<typeof SystemMessageRow> = {
  title: 'Message/SystemMessageRow',
  component: SystemMessageRow,
  decorators: [
    (Story) => (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ bgcolor: 'background.default', p: 2, minWidth: 600 }}>
          <Story />
        </Box>
      </ThemeProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SystemMessageRow>;

/** Type 6 — the user's primary gap-report from dogfood. */
export const Pinned: Story = {
  args: { message: baseMessage(6), formattingContext },
};

/** Type 7 — 1 of 13 variants, chosen deterministically by timestamp. */
export const UserJoined: Story = {
  args: { message: baseMessage(7), formattingContext },
};

/** Type 18 — with thread name. */
export const ThreadCreated: Story = {
  args: {
    message: baseMessage(18, { thread: { name: 'Project planning' } as Message['thread'] }),
    formattingContext,
  },
};

/** Type 3 — in-progress call (no duration). */
export const CallInProgress: Story = {
  args: { message: baseMessage(3), formattingContext },
};

/** Type 3 — ended call with duration. */
export const CallEnded: Story = {
  args: {
    message: baseMessage(3, {
      timestamp: '2026-06-15T14:30:00.000Z',
      call: {
        ended_timestamp: '2026-06-15T14:32:30.000Z',
        participants: ['u1'],
      } as Message['call'],
    }),
    formattingContext,
  },
};

/** Type 8 — plain boost (no streak). */
export const Boost: Story = {
  args: { message: baseMessage(8), formattingContext },
};

/** Type 8 with content = streak count. */
export const BoostWithStreak: Story = {
  args: { message: baseMessage(8, { content: '3' }), formattingContext },
};

/** Type 10 — Tier 2 milestone. Needs guildName from context. */
export const BoostTier2: Story = {
  args: { message: baseMessage(10), formattingContext },
};

/** Type 12 — channel follow. */
export const ChannelFollow: Story = {
  args: { message: baseMessage(12, { content: '#announcements' }), formattingContext },
};

/** Type 22 — periodic invite reminder (no author). */
export const InviteReminder: Story = {
  args: { message: baseMessage(22), formattingContext },
};

/** Type 24 — AutoMod action with embed. */
export const AutoMod: Story = {
  args: {
    message: baseMessage(24, {
      author: { id: 'automod', username: 'AutoMod', global_name: 'AutoMod', discriminator: '0', avatar: null } as Message['author'],
      embeds: [
        {
          type: 'rich',
          title: 'AutoMod has blocked a message in #general',
          description: 'spam content here',
          color: 0xed4245,
        } as Message['embeds'][number],
      ],
    }),
    formattingContext,
  },
};

/** Type 27 — stage event start. */
export const StageStart: Story = {
  args: { message: baseMessage(27, { content: 'Weekly Q&A' }), formattingContext },
};

/** Type 4 — channel rename. */
export const ChannelRename: Story = {
  args: { message: baseMessage(4, { content: 'project-alpha' }), formattingContext },
};

/** Type 25 — role subscription purchase. */
export const RoleSubscription: Story = {
  args: {
    message: baseMessage(25, {
      role_subscription_data: {
        tier_name: 'Gold',
        is_renewal: false,
        total_months_subscribed: 1,
      } as Message['role_subscription_data'],
    }),
    formattingContext,
  },
};

/** Type 99 — unknown / future type renders a safe placeholder. */
export const UnknownType: Story = {
  args: { message: baseMessage(99), formattingContext },
};

/** Stack all variants for a quick visual comparison. */
export const AllVariants: Story = {
  render: () => {
    const types = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 22, 24, 25, 27, 28, 29, 32, 38];
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {types.map((t) => (
          <SystemMessageRow
            key={t}
            message={baseMessage(t, {
              thread: t === 18 ? ({ name: 'Project planning' } as Message['thread']) : undefined,
              content: t === 4 ? 'new-channel-name' : t === 12 ? '#news' : '',
              embeds: t === 24
                ? [{ type: 'rich', title: 'AutoMod blocked a message' } as Message['embeds'][number]]
                : [],
            })}
            formattingContext={formattingContext}
          />
        ))}
      </Box>
    );
  },
};
