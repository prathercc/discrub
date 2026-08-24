import { Box, Chip, Link, Typography } from '@mui/material';
import { GitHub as GitHubIcon, OpenInNew as OpenIcon } from '@mui/icons-material';
import { DEVELOPER } from './developer';

/**
 * A message from the developer, pinned to the corkboard and laid out like a
 * Discord message: round avatar, author line with a small DEV tag and the
 * handle where Discord puts the timestamp, then the message and a follow
 * link. Introduces the person before asking for the follow, which is why the
 * Follow button lives here instead of in the WelcomePanel action row.
 */

interface DeveloperCardProps {
  pin: React.ReactNode;
  tilt: number;
}

const DeveloperCard = ({ pin, tilt }: DeveloperCardProps) => (
  <Box
    data-testid="corkboard-developer"
    sx={{
      position: 'relative',
      width: { xs: '100%', sm: 250 },
      p: 2,
      pt: 2.25,
      borderRadius: 1,
      bgcolor: 'background.paper',
      color: 'text.primary',
      transform: `rotate(${tilt}deg)`,
      transition: 'transform 160ms ease, box-shadow 160ms ease',
      boxShadow: '0 6px 14px rgba(0,0,0,0.35)',
      '&:hover': {
        transform: `rotate(${tilt}deg) translateY(-3px)`,
        boxShadow: '0 10px 20px rgba(0,0,0,0.4)',
      },
    }}
  >
    {pin}
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <Box
        component="img"
        src={DEVELOPER.avatar}
        alt={`${DEVELOPER.name}'s avatar`}
        width={40}
        height={40}
        sx={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, mt: 0.25 }}
      />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', lineHeight: 1.2 }}>
          <Typography component="span" sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
            {DEVELOPER.name}
          </Typography>
          <Chip
            label="DEV"
            size="small"
            color="primary"
            sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, '& .MuiChip-label': { px: 0.6 } }}
          />
          <Typography component="span" variant="caption" color="text.secondary">
            @{DEVELOPER.handle}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ lineHeight: 1.5, mt: 0.5, color: 'text.primary' }}>
          {DEVELOPER.message}
        </Typography>
        <Link
          href={DEVELOPER.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1, fontSize: '0.8rem', fontWeight: 600 }}
        >
          <GitHubIcon sx={{ fontSize: 16 }} /> Follow @{DEVELOPER.handle} <OpenIcon sx={{ fontSize: 14 }} />
        </Link>
      </Box>
    </Box>
  </Box>
);

export default DeveloperCard;
