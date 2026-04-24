import type { Meta, StoryObj } from '@storybook/react';
import FilterModal from './FilterModal';
import { IsPinnedType, HasType } from 'discrub-core/discord-enum';
import { defaultCriteria } from './searchConstants';
import { withStoreDecorator } from '../../../.storybook/storybook-utils';

const meta: Meta<typeof FilterModal> = {
  title: 'Search/FilterModal',
  component: FilterModal,
  tags: ['autodocs'],
  parameters: { docs: { story: { inline: false, height: '700px' } } },
  decorators: [withStoreDecorator({})],
};
export default meta;

type Story = StoryObj<typeof FilterModal>;

const baseArgs = {
  open: true,
  onClose: () => {},
  onServerSearch: () => {},
  onRefine: () => {},
  onClearSearch: () => {},
  onClearRefine: () => {},
  cachedUserMap: {
    '111222333444555666': { userName: 'discrub_tester', displayName: 'Discrub Tester', avatar: null, guilds: {}, timestamp: Date.now() },
    '222333444555666777': { userName: 'alice_dev', displayName: 'Alice', avatar: null, guilds: {}, timestamp: Date.now() },
  },
  currentUserId: '111222333444555666',
};

export const Empty: Story = { args: { ...baseArgs } };

export const WithSearchFilters: Story = {
  args: {
    ...baseArgs,
    savedSearchCriteria: { ...defaultCriteria, searchMessageContent: 'hello world', userIds: ['222333444555666777'] },
  },
};

export const WithRefineFilters: Story = {
  args: {
    ...baseArgs,
    savedRefineCriteria: { ...defaultCriteria, searchMessageContent: 'local filter', selectedHasTypes: [HasType.IMAGE] },
  },
};

export const BothLayersActive: Story = {
  args: {
    ...baseArgs,
    savedSearchCriteria: { ...defaultCriteria, searchMessageContent: 'project', isPinned: IsPinnedType.YES },
    savedRefineCriteria: { ...defaultCriteria, searchMessageContent: 'docs' },
  },
};

export const Closed: Story = { args: { ...baseArgs, open: false } };
