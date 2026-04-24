import { TableRow, TableCell, Box } from '@mui/material';

interface ShimmerRowProps {
  columns?: number;
  height?: number;
}

/**
 * ShimmerRow - Loading placeholder with shimmer animation for table rows
 */
const ShimmerRow = ({ columns = 4, height = 53 }: ShimmerRowProps) => {
  return (
    <TableRow>
      <TableCell colSpan={columns} sx={{ p: 0, border: 0 }}>
        <Box
          sx={{
            height,
            background: (theme) => `linear-gradient(90deg, ${theme.palette.background.paper} 0%, ${theme.palette.backgroundElevated} 50%, ${theme.palette.background.paper} 100%)`,
            backgroundSize: '1000px 100%',
            animation: 'shimmer 2s infinite linear',
          }}
        />
      </TableCell>
    </TableRow>
  );
};

export default ShimmerRow;
