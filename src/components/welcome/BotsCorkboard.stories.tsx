import type { Meta, StoryObj } from '@storybook/react';
import BotsCorkboard from './BotsCorkboard';

const meta = {
  title: 'Welcome/BotsCorkboard',
  component: BotsCorkboard,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof BotsCorkboard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
