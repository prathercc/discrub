import type { Meta, StoryObj } from '@storybook/react';
import BulkFilterButton from './BulkFilterButton';

const meta: Meta<typeof BulkFilterButton> = {
  title: 'Search/BulkFilterButton',
  component: BulkFilterButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Compact "Add / Edit filters" entry point used by the bulk dialogs (purge, export, edit). Shows an active-filter count badge once filters are applied and flips its label from Add to Edit.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof BulkFilterButton>;

const baseArgs = { onOpen: () => {} };

export const NoFilters: Story = {
  args: { ...baseArgs, filterCount: 0 },
};

export const WithFilters: Story = {
  args: { ...baseArgs, filterCount: 3 },
};

export const WithHelperText: Story = {
  args: {
    ...baseArgs,
    filterCount: 0,
    helperText: 'Optional — narrow which of your messages to edit by date range or content.',
  },
};

export const CustomLabels: Story = {
  args: {
    ...baseArgs,
    filterCount: 1,
    addLabel: 'Add target',
    editLabel: 'Edit target',
  },
};
