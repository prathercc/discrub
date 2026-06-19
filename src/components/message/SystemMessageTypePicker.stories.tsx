import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import SystemMessageTypePicker from './SystemMessageTypePicker';

const meta: Meta<typeof SystemMessageTypePicker> = {
  title: 'Message/SystemMessageTypePicker',
  component: SystemMessageTypePicker,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Grouped checkbox picker for Discord system-message types (#196/#201) — pins, member joins, channel notices, boosts, threads, auto-mod, and other. Shared by the bulk-purge "Also delete system messages" accordion and the Refine system-message filter.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof SystemMessageTypePicker>;

function Picker({ initial = [], description }: { initial?: string[]; description?: string }) {
  const [selectedGroups, setSelectedGroups] = useState<string[]>(initial);
  return (
    <div style={{ width: 420 }}>
      <SystemMessageTypePicker
        selectedGroups={selectedGroups}
        onChange={setSelectedGroups}
        description={description}
      />
    </div>
  );
}

export const NoneSelected: Story = {
  render: () => <Picker />,
};

export const SomeSelected: Story = {
  render: () => <Picker initial={['pins', 'boosts']} />,
};

export const WithDescription: Story = {
  render: () => (
    <Picker
      initial={['members']}
      description="By default the purge leaves Discord's automatic notices in place. Check any you also want removed."
    />
  ),
};
