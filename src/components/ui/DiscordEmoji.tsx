interface DiscordEmojiProps {
  emoji: { id?: string | null; name?: string | null; animated?: boolean | null };
  size?: number;
}

const DiscordEmoji = ({ emoji, size = 20 }: DiscordEmojiProps) => {
  if (emoji.id) {
    const ext = emoji.animated ? 'gif' : 'webp';
    return (
      <img
        src={`https://cdn.discordapp.com/emojis/${emoji.id}.${ext}`}
        alt={emoji.name || 'emoji'}
        style={{ width: size, height: size, verticalAlign: 'middle', objectFit: 'contain' }}
      />
    );
  }
  return <span style={{ fontSize: size, lineHeight: 1 }}>{emoji.name || '?'}</span>;
};

export default DiscordEmoji;
