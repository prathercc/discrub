import type { Meta, StoryObj } from '@storybook/react';
import ServerView from './ServerView';

const meta: Meta<typeof ServerView> = {
  title: 'Containers/ServerView',
  component: ServerView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};
export default meta;

type Story = StoryObj<typeof ServerView>;

export const Welcome: Story = {};

export const Loading: Story = {};

export const WithMessages: Story = {};

export const Error: Story = {};
