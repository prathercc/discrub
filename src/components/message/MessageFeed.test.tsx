import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { createAuthenticatedState } from '@/test/state-factories';
import { createMockMessage, createMockUser } from '@/test/fixtures';
import { virtualizerMock } from '@/test/virtualizer-mock';
import MessageFeed from './MessageFeed';
import { SortDirection } from 'discrub-core/common-enum';

vi.mock('@tanstack/react-virtual', () => virtualizerMock);

const formattingContext = { userMap: {}, channelMap: {}, guildRoles: [] } as any;
const fullUserMap = {};

const baseProps = {
  formattingContext,
  fullUserMap,
  onDeleteReaction: vi.fn(),
  onFetchReactingUsers: vi.fn(),
  onDeleteAttachment: vi.fn(),
  onDeleteAllAttachments: vi.fn(),
  onOpenThread: vi.fn(),
  canManageMessages: true,
  currentUserId: 'user-123',
  onBulkDeleteAllReactions: vi.fn(),
  onBulkDeleteReactionsForEmoji: vi.fn(),
};

const stateWithMessages = (messages: ReturnType<typeof createMockMessage>[]) =>
  createAuthenticatedState({
    message: {
      ...createAuthenticatedState().message,
      messages,
      filteredMessages: messages,
    },
  });

describe('<MessageFeed />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the toolbar with sort control and select-all checkbox', () => {
    const messages = [createMockMessage({ id: 'm1', content: 'hello' })];
    renderWithProviders(<MessageFeed {...baseProps} />, {
      preloadedState: stateWithMessages(messages),
    });

    expect(screen.getByTestId('message-feed-toolbar')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /select all messages/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sort oldest first/i }),
    ).toBeInTheDocument();
  });

  it('groups consecutive same-author messages into a single chunk', () => {
    const alice = createMockUser({ id: 'alice', username: 'alice' });
    const messages = [
      createMockMessage({
        id: 'm1',
        author: alice,
        content: 'first',
        timestamp: '2026-04-19T15:00:00.000Z',
      }),
      createMockMessage({
        id: 'm2',
        author: alice,
        content: 'second',
        timestamp: '2026-04-19T15:03:00.000Z',
      }),
    ];
    renderWithProviders(<MessageFeed {...baseProps} />, {
      preloadedState: stateWithMessages(messages),
    });

    const chunks = screen.getAllByTestId('message-chunk');
    expect(chunks).toHaveLength(1);

    const rows = screen.getAllByTestId('message-feed-row');
    expect(rows).toHaveLength(2);
  });

  it('renders a system-message row (type 6 PIN) instead of a regular chunk', () => {
    const alice = createMockUser({ id: 'alice', username: 'alice', global_name: 'Alice' });
    const messages = [
      createMockMessage({
        id: 'sys-pin',
        author: alice,
        content: '',
        type: 6, // CHANNEL_PINNED_MESSAGE
        timestamp: '2026-04-19T15:00:00.000Z',
      }),
    ];
    renderWithProviders(<MessageFeed {...baseProps} />, {
      preloadedState: stateWithMessages(messages),
    });

    // System rows live outside the standard chunk layout — no chunk, no
    // message-feed-row, just a dedicated system-message-row element.
    expect(screen.queryByTestId('message-chunk')).not.toBeInTheDocument();
    expect(screen.queryByTestId('message-feed-row')).not.toBeInTheDocument();
    const sysRow = screen.getByTestId('system-message-row');
    expect(sysRow).toHaveAttribute('data-system-kind', 'pin');
    expect(sysRow).toHaveTextContent('pinned a message');
  });

  it('mixes regular and system messages in order (type 0 then type 18)', () => {
    const alice = createMockUser({ id: 'alice', username: 'alice', global_name: 'Alice' });
    const messages = [
      createMockMessage({
        id: 'm1',
        author: alice,
        content: 'hello',
        type: 0,
        timestamp: '2026-04-19T15:00:00.000Z',
      }),
      createMockMessage({
        id: 'sys-thread',
        author: alice,
        content: '',
        type: 18, // THREAD_CREATED
        thread: { name: 'Design ideas' } as any,
        timestamp: '2026-04-19T15:02:00.000Z',
      }),
    ];
    renderWithProviders(<MessageFeed {...baseProps} />, {
      preloadedState: stateWithMessages(messages),
    });

    // Regular message keeps a chunk; system message stands alone.
    expect(screen.getAllByTestId('message-chunk')).toHaveLength(1);
    const sysRow = screen.getByTestId('system-message-row');
    expect(sysRow).toHaveAttribute('data-system-kind', 'thread');
    expect(sysRow).toHaveTextContent('Design ideas');
  });

  it('splits on author change into separate chunks', () => {
    const alice = createMockUser({ id: 'alice', username: 'alice' });
    const bob = createMockUser({ id: 'bob', username: 'bob' });
    const messages = [
      createMockMessage({
        id: 'm1',
        author: alice,
        content: 'from alice',
        timestamp: '2026-04-19T15:00:00.000Z',
      }),
      createMockMessage({
        id: 'm2',
        author: bob,
        content: 'from bob',
        timestamp: '2026-04-19T15:01:00.000Z',
      }),
    ];
    renderWithProviders(<MessageFeed {...baseProps} />, {
      preloadedState: stateWithMessages(messages),
    });

    expect(screen.getAllByTestId('message-chunk')).toHaveLength(2);
  });

  it('toggles sort direction when the toolbar button is clicked', () => {
    const messages = [createMockMessage({ id: 'm1', content: 'hello' })];
    const { store } = renderWithProviders(<MessageFeed {...baseProps} />, {
      preloadedState: stateWithMessages(messages),
    });

    const initialDirection = store.getState().message.order.order;
    fireEvent.click(screen.getByRole('button', { name: /sort/i }));
    const nextDirection = store.getState().message.order.order;
    expect(nextDirection).not.toBe(initialDirection);
  });

  it('checking Select All selects every filtered message', () => {
    const messages = [
      createMockMessage({ id: 'm1', content: 'a' }),
      createMockMessage({ id: 'm2', content: 'b' }),
    ];
    const { store } = renderWithProviders(<MessageFeed {...baseProps} />, {
      preloadedState: stateWithMessages(messages),
    });

    expect(store.getState().message.selectedMessages).toHaveLength(0);
    fireEvent.click(
      screen.getByRole('checkbox', { name: /select all messages/i }),
    );
    expect(store.getState().message.selectedMessages).toHaveLength(2);
  });

  it('Select All with all selected unselects everything', () => {
    const messages = [
      createMockMessage({ id: 'm1', content: 'a' }),
      createMockMessage({ id: 'm2', content: 'b' }),
    ];
    const state = stateWithMessages(messages);
    state.message.selectedMessages = messages;
    const { store } = renderWithProviders(<MessageFeed {...baseProps} />, {
      preloadedState: state,
    });

    expect(store.getState().message.selectedMessages).toHaveLength(2);
    fireEvent.click(
      screen.getByRole('checkbox', { name: /select all messages/i }),
    );
    expect(store.getState().message.selectedMessages).toHaveLength(0);
  });

  it('shows chunk header with author name and timestamp', () => {
    const alice = createMockUser({
      id: 'alice',
      username: 'alice',
      global_name: 'Alice',
    });
    const messages = [
      createMockMessage({
        id: 'm1',
        author: alice,
        content: 'hi',
        timestamp: '2026-04-19T15:00:00.000Z',
      }),
    ];
    renderWithProviders(<MessageFeed {...baseProps} />, {
      preloadedState: stateWithMessages(messages),
    });

    // Author name appears in chunk header
    expect(screen.getByText('Alice')).toBeInTheDocument();
    // Timestamp label rendered (Apr 19, 2026 format)
    expect(screen.getByText(/Apr 19, 2026/)).toBeInTheDocument();
  });

  it('renders a reply quote for type-19 messages with referenced_message', () => {
    const alice = createMockUser({ id: 'alice', username: 'alice' });
    const bob = createMockUser({ id: 'bob', username: 'bob', global_name: 'Bob' });
    const messages = [
      createMockMessage({
        id: 'm-reply',
        author: alice,
        type: 19,
        content: 'my reply',
        referenced_message: createMockMessage({
          id: 'm-orig',
          author: bob,
          content: 'original message',
        }),
      } as any),
    ];
    renderWithProviders(<MessageFeed {...baseProps} />, {
      preloadedState: stateWithMessages(messages),
    });

    // The original author's name appears in the reply quote
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders inline attachment thumbnail for image attachments', () => {
    const messages = [
      createMockMessage({
        id: 'm1',
        content: 'pic',
        attachments: [
          {
            id: 'att1',
            url: 'https://example.com/pic.png',
            proxy_url: 'https://example.com/pic.png',
            filename: 'pic.png',
            content_type: 'image/png',
            size: 1024,
          } as any,
        ],
      }),
    ];
    renderWithProviders(<MessageFeed {...baseProps} />, {
      preloadedState: stateWithMessages(messages),
    });

    const img = screen.getByAltText('pic.png') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toContain('pic.png');
  });

  it('renders inline reaction chips', () => {
    const messages = [
      createMockMessage({
        id: 'm1',
        content: 'reacted',
        reactions: [
          { emoji: { id: null, name: '👍', animated: false }, count: 3, me: false } as any,
        ],
      }),
    ];
    renderWithProviders(<MessageFeed {...baseProps} />, {
      preloadedState: stateWithMessages(messages),
    });

    expect(screen.getByText('👍')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows "(no content)" placeholder for empty messages with no attachments or embeds', () => {
    const messages = [createMockMessage({ id: 'm1', content: '' })];
    renderWithProviders(<MessageFeed {...baseProps} />, {
      preloadedState: stateWithMessages(messages),
    });

    expect(screen.getByText(/\(no content\)/)).toBeInTheDocument();
  });

  // #204/#213: a sticker-only message carries real payload — it renders the
  // sticker image (not a text label), and never falls through to "(no content)".
  it('renders a sticker-only message as an image, not "(no content)" (#213)', () => {
    const messages = [
      createMockMessage({
        id: 'm1',
        content: '',
        sticker_items: [{ id: 's1', name: 'wave', format_type: 1 }],
      } as any),
    ];
    renderWithProviders(<MessageFeed {...baseProps} />, {
      preloadedState: stateWithMessages(messages),
    });

    expect(screen.getByAltText('wave')).toBeInTheDocument();
    expect(screen.queryByText(/\(no content\)/)).not.toBeInTheDocument();
  });

  // #204/#213: a poll-only message renders a poll card with the question.
  it('renders a poll-only message as a poll card, not "(no content)" (#213)', () => {
    const messages = [
      createMockMessage({
        id: 'm1',
        content: '',
        poll: { question: { text: 'Favorite color?' }, answers: [] },
      } as any),
    ];
    renderWithProviders(<MessageFeed {...baseProps} />, {
      preloadedState: stateWithMessages(messages),
    });

    expect(screen.getByTestId('inline-poll')).toBeInTheDocument();
    expect(screen.getByText('Favorite color?')).toBeInTheDocument();
    expect(screen.queryByText(/\(no content\)/)).not.toBeInTheDocument();
  });

  // #204: a forwarded-only message (empty outer content/attachments/embeds,
  // payload in message_snapshots) renders its own "Forwarded" box, so it must
  // not also stack a spurious "(no content)" line above it.
  it('does not show "(no content)" for a forwarded-only message (#204)', () => {
    const messages = [
      createMockMessage({
        id: 'm1',
        content: '',
        attachments: [],
        embeds: [],
        message_snapshots: [
          { message: { content: 'forwarded hello', attachments: [], embeds: [] } },
        ],
      } as any),
    ];
    renderWithProviders(<MessageFeed {...baseProps} />, {
      preloadedState: stateWithMessages(messages),
    });

    expect(screen.getByText(/forwarded hello/)).toBeInTheDocument();
    expect(screen.queryByText(/\(no content\)/)).not.toBeInTheDocument();
  });

  it('select-all checkbox is indeterminate when some messages are selected', () => {
    const messages = [
      createMockMessage({ id: 'm1', content: 'a' }),
      createMockMessage({ id: 'm2', content: 'b' }),
    ];
    const state = stateWithMessages(messages);
    state.message.selectedMessages = [messages[0]];
    renderWithProviders(<MessageFeed {...baseProps} />, {
      preloadedState: state,
    });

    // MUI marks indeterminate checkboxes with the MuiCheckbox-indeterminate class
    // on the wrapper span. Using a class selector because the `indeterminate`
    // property on the underlying input is set imperatively and doesn't always
    // reflect synchronously in jsdom.
    const wrapper = document.querySelector(
      '[data-testid="message-feed-toolbar"] .MuiCheckbox-indeterminate',
    );
    expect(wrapper).not.toBeNull();
  });

  it('toolbar label reflects current sort direction', () => {
    const messages = [createMockMessage({ id: 'm1', content: 'hi' })];
    const state = stateWithMessages(messages);
    state.message.order = {
      order: SortDirection.ASCENDING,
      orderBy: 'timestamp',
    };
    renderWithProviders(<MessageFeed {...baseProps} />, {
      preloadedState: state,
    });

    expect(
      screen.getByRole('button', { name: /sort newest first/i }),
    ).toBeInTheDocument();
  });

  // ── #191: every thread starter in a chunk gets its own link ──────
  describe('Open Thread links for adjacent starters (#191)', () => {
    it('renders an Open Thread button for each starter in a multi-thread chunk', () => {
      const alice = createMockUser({ id: 'alice', username: 'alice' });
      const messages = [
        createMockMessage({
          id: 'm1',
          author: alice,
          content: 'test',
          timestamp: '2026-04-19T15:00:00.000Z',
          // @ts-expect-error — `thread` is on the Discord wire shape, not in our trimmed Message type
          thread: { id: 't-1', name: 'first thread', type: 11 },
        }),
        createMockMessage({
          id: 'm2',
          author: alice,
          content: 'test',
          timestamp: '2026-04-19T15:02:00.000Z',
          // @ts-expect-error — same as above
          thread: { id: 't-2', name: 'second thread', type: 11 },
        }),
      ];
      const onOpenThread = vi.fn();
      renderWithProviders(
        <MessageFeed {...baseProps} onOpenThread={onOpenThread} />,
        { preloadedState: stateWithMessages(messages) },
      );

      const links = screen.getAllByTestId('message-chunk-open-thread');
      expect(links).toHaveLength(2);
      // Names disambiguate the two links.
      expect(links[0].textContent).toContain('first thread');
      expect(links[1].textContent).toContain('second thread');

      fireEvent.click(links[1]);
      expect(onOpenThread).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'm2' }),
      );
    });

    it('keeps the generic "Open thread" label when a chunk has exactly one starter', () => {
      const alice = createMockUser({ id: 'alice', username: 'alice' });
      const messages = [
        createMockMessage({
          id: 'm1',
          author: alice,
          content: 'just one',
          timestamp: '2026-04-19T15:00:00.000Z',
          // @ts-expect-error — `thread` is on the Discord wire shape, not in our trimmed Message type
          thread: { id: 't-1', name: 'only thread', type: 11 },
        }),
      ];
      renderWithProviders(<MessageFeed {...baseProps} />, {
        preloadedState: stateWithMessages(messages),
      });

      const links = screen.getAllByTestId('message-chunk-open-thread');
      expect(links).toHaveLength(1);
      // Single-starter case preserves the legacy label, no name suffix.
      expect(links[0].textContent).toBe('Open thread');
    });
  });

  // ── #192: Load More button hidden during Load All ────────────────
  describe('Load More button gating (#192)', () => {
    it('renders the Load More button when more pages are available and nothing else is loading', () => {
      const messages = [createMockMessage({ id: 'm1', content: 'hi' })];
      const state = stateWithMessages(messages);
      state.message.pagination = {
        ...state.message.pagination,
        hasMore: true,
        isLoadingMore: false,
        isLoadingAll: false,
      };
      renderWithProviders(<MessageFeed {...baseProps} />, { preloadedState: state });
      expect(screen.getByTestId('message-feed-load-more')).toBeInTheDocument();
    });

    it('hides the Load More button while a Load All operation is in flight', () => {
      const messages = [createMockMessage({ id: 'm1', content: 'hi' })];
      const state = stateWithMessages(messages);
      state.message.pagination = {
        ...state.message.pagination,
        hasMore: true,
        isLoadingMore: false,
        isLoadingAll: true,
      };
      renderWithProviders(<MessageFeed {...baseProps} />, { preloadedState: state });
      expect(screen.queryByTestId('message-feed-load-more')).not.toBeInTheDocument();
    });
  });

  // Backlog #162 — TIME_FORMAT setting must drive the in-app timestamp
  // strings in both the chunk header and the per-row gutter clock.
  // Two messages from the same author within the 7-min chunking window so
  // we get both surfaces in one render.
  describe('TIME_FORMAT setting (Backlog #162)', () => {
    const buildMessages = () => {
      const alice = createMockUser({ id: 'alice', username: 'alice', global_name: 'Alice' });
      return [
        createMockMessage({
          id: 'm1',
          author: alice,
          content: 'first',
          // 18:42 UTC. Render in any timezone still gives a stable hour
          // suffix per locale; we assert via the AM/PM marker which is
          // present iff the format string includes `aa`.
          timestamp: '2026-04-19T18:42:00.000Z',
        }),
        createMockMessage({
          id: 'm2',
          author: alice,
          content: 'second',
          timestamp: '2026-04-19T18:43:00.000Z',
        }),
      ];
    };

    const stateWithTimeFormat = (timeFormat: string) => {
      const messages = buildMessages();
      const base = createAuthenticatedState({
        message: {
          ...createAuthenticatedState().message,
          messages,
          filteredMessages: messages,
        },
      });
      return {
        ...base,
        app: {
          ...base.app,
          settings: {
            ...base.app.settings,
            timeFormat,
          },
        },
      } as typeof base;
    };

    it('chunk header timestamp uses 12-hour format by default (h:mm aa)', () => {
      renderWithProviders(<MessageFeed {...baseProps} />, {
        preloadedState: stateWithTimeFormat('h:mm aa'),
      });
      const chunk = screen.getByTestId('message-chunk');
      // The header timestamp lives near the top of the chunk; we just
      // need to confirm AM/PM shows up somewhere in the chunk's text.
      expect(chunk.textContent).toMatch(/\b(AM|PM)\b/);
    });

    it('chunk header timestamp drops AM/PM under 24-hour format (HH:mm)', () => {
      renderWithProviders(<MessageFeed {...baseProps} />, {
        preloadedState: stateWithTimeFormat('HH:mm'),
      });
      const chunk = screen.getByTestId('message-chunk');
      expect(chunk.textContent).not.toMatch(/\b(AM|PM)\b/);
    });

    it('per-row gutter timestamp uses AM/PM under 12-hour format', () => {
      renderWithProviders(<MessageFeed {...baseProps} />, {
        preloadedState: stateWithTimeFormat('h:mm aa'),
      });
      const rows = screen.getAllByTestId('message-feed-row');
      expect(rows).toHaveLength(2);
      // Second row carries the gutter timestamp (first row uses the
      // chunk header instead). Querying by class avoids depending on
      // the exact wall-clock value, which would be timezone-fragile.
      const gutter = rows[1].querySelector('.feed-row-gutter-time');
      expect(gutter).not.toBeNull();
      expect(gutter?.textContent).toMatch(/\b(AM|PM)\b/);
    });

    it('per-row gutter timestamp drops AM/PM under 24-hour format', () => {
      renderWithProviders(<MessageFeed {...baseProps} />, {
        preloadedState: stateWithTimeFormat('HH:mm'),
      });
      const rows = screen.getAllByTestId('message-feed-row');
      const gutter = rows[1].querySelector('.feed-row-gutter-time');
      expect(gutter).not.toBeNull();
      expect(gutter?.textContent).not.toMatch(/\b(AM|PM)\b/);
      // 24-hour clock string is HH:mm — two digits, colon, two digits.
      expect(gutter?.textContent).toMatch(/^\d{2}:\d{2}$/);
    });
  });
});
