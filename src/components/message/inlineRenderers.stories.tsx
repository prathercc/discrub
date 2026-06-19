import type { Meta, StoryObj } from '@storybook/react';
import { InlineSticker, InlinePoll } from './inlineRenderers';

/**
 * Rich inline renderers for the message feed (#213): stickers as images
 * (Lottie degrades to a labeled placeholder) and polls as cards with vote
 * bars when results are present.
 */
const meta: Meta<typeof InlineSticker> = {
  title: 'Message/InlineRenderers',
  component: InlineSticker,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof InlineSticker>;

// ── Stickers ──────────────────────────────────────────────────────────────
export const StickerPng: Story = {
  render: () => <InlineSticker stickers={[{ id: '888000000000000001', name: 'happy wave', format_type: 1 }]} />,
};

export const StickerLottie: Story = {
  name: 'Sticker (Lottie → placeholder)',
  render: () => <InlineSticker stickers={[{ id: '888000000000000002', name: 'sparkle', format_type: 3 }]} />,
};

export const MultipleStickers: Story = {
  render: () => (
    <InlineSticker
      stickers={[
        { id: '888000000000000001', name: 'happy wave', format_type: 1 },
        { id: '888000000000000003', name: 'dance', format_type: 4 },
        { id: '888000000000000002', name: 'sparkle', format_type: 3 },
      ]}
    />
  ),
};

// ── Polls ─────────────────────────────────────────────────────────────────
const pollWithResults = {
  question: { text: 'Favorite language?' },
  answers: [
    { answer_id: 1, poll_media: { text: 'TypeScript' } },
    { answer_id: 2, poll_media: { text: 'Rust' } },
  ],
  results: {
    answer_counts: [
      { id: 1, count: 3, me_voted: true },
      { id: 2, count: 1, me_voted: false },
    ],
  },
};

const pollNoResults = {
  question: { text: 'Lunch spot?' },
  answers: [
    { answer_id: 1, poll_media: { text: 'Tacos' } },
    { answer_id: 2, poll_media: { text: 'Sushi' } },
    { answer_id: 3, poll_media: { text: 'Pizza' } },
  ],
};

export const PollWithResults: Story = {
  render: () => (
    <div style={{ width: 420 }}>
      <InlinePoll poll={pollWithResults} />
    </div>
  ),
};

export const PollNoResults: Story = {
  name: 'Poll (live, no counts)',
  render: () => (
    <div style={{ width: 420 }}>
      <InlinePoll poll={pollNoResults} />
    </div>
  ),
};
