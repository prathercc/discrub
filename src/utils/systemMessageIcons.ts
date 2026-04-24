import type { ComponentType } from 'react';
import {
  PushPin,
  PersonAdd,
  PersonRemove,
  Phone,
  Edit,
  AutoAwesome,
  Forum as ForumIcon,
  RssFeed,
  Shield,
  Poll,
  ShoppingCart,
  Mic,
  Star,
  WorkspacePremium,
  Celebration,
  MailOutline,
  Search as SearchIcon,
  InfoOutlined,
} from '@mui/icons-material';
import { SystemMessageKind } from 'discrub-core/system-messages';

/**
 * Maps a `SystemMessageKind` from discrub-core to a MUI icon component.
 *
 * Parallel to the emoji map used by the HTML export (`SYSTEM_MESSAGE_ICONS`
 * in exportService.ts). The two maps are independent on purpose — exports
 * are self-contained HTML and can't depend on MUI, and the in-app feed
 * benefits from sharp vector icons that match the rest of the UI.
 */
const ICONS: Record<SystemMessageKind, ComponentType> = {
  [SystemMessageKind.RECIPIENT_ADD]: PersonAdd,
  [SystemMessageKind.RECIPIENT_REMOVE]: PersonRemove,
  [SystemMessageKind.CALL]: Phone,
  [SystemMessageKind.CHANNEL_EDIT]: Edit,
  [SystemMessageKind.PIN]: PushPin,
  [SystemMessageKind.JOIN]: Celebration,
  [SystemMessageKind.BOOST]: AutoAwesome,
  [SystemMessageKind.CHANNEL_FOLLOW]: RssFeed,
  [SystemMessageKind.DISCOVERY]: SearchIcon,
  [SystemMessageKind.THREAD]: ForumIcon,
  [SystemMessageKind.INVITE_REMINDER]: MailOutline,
  [SystemMessageKind.AUTO_MOD]: Shield,
  [SystemMessageKind.ROLE_SUBSCRIPTION]: Star,
  [SystemMessageKind.PREMIUM_UPSELL]: WorkspacePremium,
  [SystemMessageKind.STAGE]: Mic,
  [SystemMessageKind.APP_PREMIUM]: WorkspacePremium,
  [SystemMessageKind.INCIDENT]: Shield,
  [SystemMessageKind.PURCHASE]: ShoppingCart,
  [SystemMessageKind.POLL_RESULT]: Poll,
  [SystemMessageKind.OTHER]: InfoOutlined,
};

export const getSystemMessageIcon = (kind: SystemMessageKind): ComponentType =>
  ICONS[kind] ?? InfoOutlined;
