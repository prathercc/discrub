import type { Meta, StoryObj } from '@storybook/react';
import WelcomePanel from './WelcomePanel';

const meta = {
  title: 'Welcome/WelcomePanel',
  component: WelcomePanel,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    onStartTour: () => alert('Tour started!'),
  },
} satisfies Meta<typeof WelcomePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
