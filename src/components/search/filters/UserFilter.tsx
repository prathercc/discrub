import { Box, Typography, TextField, Chip } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface UserFilterProps {
  userIds: string[];
  onChange: (userIds: string[]) => void;
  label?: string;
  placeholder?: string;
}

/**
 * UserFilter - filter messages by user IDs
 */
const UserFilter = ({ userIds, onChange, label, placeholder }: UserFilterProps) => {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('filters.filterByUsers');
  const resolvedPlaceholder = placeholder ?? t('filters.enterUserId');
  const [inputValue, setInputValue] = useState('');

  const handleAddUser = () => {
    const trimmedId = inputValue.trim();
    if (trimmedId && !userIds.includes(trimmedId)) {
      onChange([...userIds, trimmedId]);
      setInputValue('');
    }
  };

  const handleRemoveUser = (userId: string) => {
    onChange(userIds.filter((id) => id !== userId));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddUser();
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {resolvedLabel}
      </Typography>
      <TextField
        size="small"
        fullWidth
        placeholder={resolvedPlaceholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyPress={handleKeyPress}
        sx={{ mb: 1 }}
      />
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {userIds.map((userId) => (
          <Chip
            key={userId}
            label={userId}
            onDelete={() => handleRemoveUser(userId)}
            size="small"
          />
        ))}
      </Box>
    </Box>
  );
};

export default UserFilter;
