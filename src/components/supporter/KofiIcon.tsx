import { Box, type SxProps, type Theme } from '@mui/material';

/**
 * The Ko-fi cup mark, shared with the Support Feed button. Served from
 * `public/kofi.svg` so it is same-origin in every build (the hosted build's
 * CSP blocks third-party assets).
 */
const KofiIcon = ({ size = 16, sx }: { size?: number; sx?: SxProps<Theme> }) => (
  <Box
    component="img"
    src="/kofi.svg"
    alt=""
    aria-hidden
    sx={{ width: size, height: size, display: 'inline-block', flexShrink: 0, ...sx }}
  />
);

export default KofiIcon;
