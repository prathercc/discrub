import { Box, Typography, TextField, Chip } from '@mui/material';
import { useState } from 'react';

interface UserFilterProps {
  userIds: string[];
  onChange: (userIds: string[]) => void;
  label?: string;
  placeholder?: string;
}

/**
 * UserFilter - filter messages by user IDs
 */
const UserFilter = ({ userIds, onChange, label = 'Filter by Users', placeholder = 'Enter user ID and press Enter' }: UserFilterProps) => {
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
        {label}
      </Typography>
      <TextField
        size="small"
        fullWidth
        placeholder={placeholder}
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
