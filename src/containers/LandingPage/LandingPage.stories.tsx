import type { Meta, StoryObj } from '@storybook/react';
import LandingPage from './LandingPage';

const meta: Meta<typeof LandingPage> = {
  title: 'Containers/LandingPage',
  component: LandingPage,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof LandingPage>;

export const Default: Story = {};
