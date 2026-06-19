import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import ReactionEmojiPicker from './ReactionEmojiPicker';
import type { SelectableEmoji } from '../../utils/emojiDataset';
import type { Emoji } from 'discrub-core/types/discord-types';

const meta: Meta<typeof ReactionEmojiPicker> = {
  title: 'UI/ReactionEmojiPicker',
  component: ReactionEmojiPicker,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'In-house emoji picker for bulk-adding reactions (#202). Renders the active guild’s custom emojis plus a searchable unicode grid (lazy-loaded from emojibase/iamcal), with a paste escape-hatch for raw emoji or `:shortcode:`.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof ReactionEmojiPicker>;

const guildEmojis = [
  { id: '900000000000000001', name: 'pepe', animated: false },
  { id: '900000000000000002', name: 'kekw', animated: false },
  { id: '900000000000000003', name: 'catjam', animated: true },
] as unknown as Emoji[];

// Interactive wrapper so toggling reflects in the grid (the picker is controlled).
function Picker({ guildEmojis: ge, initial = [] }: { guildEmojis?: Emoji[]; initial?: SelectableEmoji[] }) {
  const [selected, setSelected] = useState<SelectableEmoji[]>(initial);
  return (
    <div style={{ width: 360 }}>
      <ReactionEmojiPicker
        selected={selected}
        guildEmojis={ge}
        onToggle={(e) =>
          setSelected((prev) =>
            prev.some((p) => (p.id ?? p.name) === (e.id ?? e.name))
              ? prev.filter((p) => (p.id ?? p.name) !== (e.id ?? e.name))
              : [...prev, e],
          )
        }
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <Picker />,
};

export const WithGuildEmojis: Story = {
  render: () => <Picker guildEmojis={guildEmojis} />,
};

export const WithSelection: Story = {
  render: () => <Picker guildEmojis={guildEmojis} initial={[{ name: '🔥' }, { id: '900000000000000001', name: 'pepe' }]} />,
};
