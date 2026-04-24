import { Box, Slider, Typography, Alert } from '@mui/material';
import type { AppSettings } from 'discrub-core/types/discrub-types';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import TourSpot from '@components/welcome/TourSpot';

interface OperationDelaysTabProps {
  formValues: AppSettings;
  onChange: (key: DiscrubSetting, value: string) => void;
}

interface DelaySliderConfig {
  key: DiscrubSetting;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  recommendedMin: number;
  recommendedMax: number;
}

const SEARCH_CONFIG: DelaySliderConfig = {
  key: DiscrubSetting.SEARCH_DELAY,
  label: 'Search Delay',
  description: 'Base delay between search/fetch operations',
  min: 0, max: 10, step: 0.1,
  recommendedMin: 1, recommendedMax: 3,
};

const DELETE_CONFIG: DelaySliderConfig = {
  key: DiscrubSetting.DELETE_DELAY,
  label: 'Delete / Edit Delay',
  description: 'Base delay between delete and edit operations',
  min: 0, max: 10, step: 0.1,
  recommendedMin: 2, recommendedMax: 4,
};

const MODIFIER_CONFIG: DelaySliderConfig = {
  key: DiscrubSetting.DELAY_MODIFIER,
  label: 'Delay Modifier',
  description: 'Random variation added to base delays for more natural timing',
  min: 0, max: 5, step: 0.1,
  recommendedMin: 0.5, recommendedMax: 2,
};

/**
 * Zone colors and labels:
 * - Red (0s): Risky — no delay, high chance of rate limiting
 * - Amber (below recommended): Low — faster but less safe
 * - Green (recommended range): Recommended — balanced speed and safety
 * - Blue (above recommended): Safe — very safe but slower operations
 */
const getZoneColor = (value: number, config: DelaySliderConfig): string => {
  if (value === 0) return '#f44336';
  if (value < config.recommendedMin) return '#ff9800';
  if (value <= config.recommendedMax) return '#4caf50';
  return '#5865f2'; // blurple — safe but slow
};

const getZoneLabel = (value: number, config: DelaySliderConfig): string => {
  if (value === 0) return 'Risky';
  if (value < config.recommendedMin) return 'Low';
  if (value <= config.recommendedMax) return 'Recommended';
  return 'Safe';
};

/**
 * Build a CSS linear-gradient for the slider rail with blended transitions.
 * Red → amber → green → blue, with smooth color transitions between zones.
 */
const buildRailGradient = (config: DelaySliderConfig): string => {
  const { min, max, recommendedMin, recommendedMax } = config;
  const range = max - min;
  const toPct = (v: number) => ((v - min) / range) * 100;

  // Blend midpoints between zones for smooth transitions
  const redMid = toPct(recommendedMin * 0.25);
  const amberToGreen = toPct(recommendedMin);
  // greenCore reserved for future gradient refinement
  void toPct((recommendedMin + recommendedMax) / 2);
  const greenToBlue = toPct(recommendedMax);
  const blueMid = toPct(recommendedMax + (max - recommendedMax) * 0.5);

  return `linear-gradient(to right, `
    + `#f44336 0%, `
    + `#ff9800 ${redMid}%, `
    + `#4caf50 ${amberToGreen}%, `
    + `#4caf50 ${greenToBlue}%, `
    + `#5865f2 ${blueMid}%, `
    + `#5865f2 100%)`;
};

const DelaySlider = ({
  config,
  value,
  onChange,
}: {
  config: DelaySliderConfig;
  value: number;
  onChange: (key: DiscrubSetting, value: string) => void;
}) => {
  const thumbColor = getZoneColor(value, config);
  const zoneLabel = getZoneLabel(value, config);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {config.label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="caption"
            sx={{ color: thumbColor, fontWeight: 600, fontSize: '0.7rem' }}
          >
            {zoneLabel}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, minWidth: '36px', textAlign: 'right' }}>
            {parseFloat(value.toFixed(1))}s
          </Typography>
        </Box>
      </Box>
      <Slider
        value={value}
        onChange={(_, newValue) => onChange(config.key, (newValue as number).toFixed(1))}
        min={config.min}
        max={config.max}
        step={config.step}
        valueLabelDisplay="auto"
        valueLabelFormat={(v) => `${parseFloat(v.toFixed(1))}s`}
        marks={[
          { value: config.min, label: `${config.min}s` },
          { value: config.max, label: `${config.max}s` },
        ]}
        sx={{
          '& .MuiSlider-track': { display: 'none' },
          '& .MuiSlider-thumb': {
            backgroundColor: thumbColor,
            border: '2px solid',
            borderColor: thumbColor,
            zIndex: 1,
          },
          '& .MuiSlider-rail': {
            opacity: 1,
            background: buildRailGradient(config),
            height: 6,
          },
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ mt: -0.5, display: 'block' }}>
        {config.description}
      </Typography>
    </Box>
  );
};

export const OperationDelaysTab = ({ formValues, onChange }: OperationDelaysTabProps) => {
  const searchDelay = parseFloat(formValues[DiscrubSetting.SEARCH_DELAY]) || 0;
  const deleteDelay = parseFloat(formValues[DiscrubSetting.DELETE_DELAY]) || 0;
  const modifier = parseFloat(formValues[DiscrubSetting.DELAY_MODIFIER]) || 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Alert severity="info" action={<TourSpot stepKey="operation-delays" size="compact" placement="left" />}>
        Delays help prevent rate limiting from Discord. Higher delays are safer but slower.
        The modifier adds randomization to make requests appear more natural.
      </Alert>

      <DelaySlider config={SEARCH_CONFIG} value={searchDelay} onChange={onChange} />
      <Typography variant="caption" color="text.secondary" sx={{ mt: -2 }}>
        Effective delay: {parseFloat(Math.max(searchDelay - modifier, 0).toFixed(1))}s – {parseFloat((searchDelay + modifier).toFixed(1))}s
      </Typography>

      <DelaySlider config={DELETE_CONFIG} value={deleteDelay} onChange={onChange} />
      <Typography variant="caption" color="text.secondary" sx={{ mt: -2 }}>
        Effective delay: {parseFloat(Math.max(deleteDelay - modifier, 0).toFixed(1))}s – {parseFloat((deleteDelay + modifier).toFixed(1))}s
      </Typography>

      <DelaySlider config={MODIFIER_CONFIG} value={modifier} onChange={onChange} />
    </Box>
  );
};
