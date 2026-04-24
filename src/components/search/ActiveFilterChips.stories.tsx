import type { Meta, StoryObj } from '@storybook/react';
import ActiveFilterChips from './ActiveFilterChips';
import { IsPinnedType, AuthorType, HasType } from 'discrub-core/discord-enum';
import { defaultCriteria } from './searchConstants';

const meta: Meta<typeof ActiveFilterChips> = {
  title: 'Search/ActiveFilterChips',
  component: ActiveFilterChips,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ActiveFilterChips>;

const baseArgs = {
  onClearSearchFilter: () => {},
  onClearRefineFilter: () => {},
  onClearAll: () => {},
};

export const NoFilters: Story = {
  args: { ...baseArgs, searchCriteria: defaultCriteria, refineCriteria: defaultCriteria },
};

export const SearchOnly: Story = {
  args: { ...baseArgs, searchCriteria: { ...defaultCriteria, searchMessageContent: 'hello', userIds: ['123'] }, refineCriteria: defaultCriteria },
};

export const RefineOnly: Story = {
  args: { ...baseArgs, searchCriteria: defaultCriteria, refineCriteria: { ...defaultCriteria, searchMessageContent: 'local', selectedHasTypes: [HasType.IMAGE] } },
};

export const BothLayers: Story = {
  args: {
    ...baseArgs,
    searchCriteria: { ...defaultCriteria, searchMessageContent: 'server query', isPinned: IsPinnedType.YES, authorType: AuthorType.BOT },
    refineCriteria: { ...defaultCriteria, searchMessageContent: 'refine text', userIds: ['456'] },
  },
};
