import { Box, Chip, TextField, Typography } from '@mui/material';

interface ContentFilterProps {
  terms: string[];
  onChange: (terms: string[]) => void;
  /**
   * The text typed but not yet added as a term. Owned by the parent so the
   * section's apply button can treat a pending draft as a change and fold
   * it in on apply (a user who types one term and clicks Search never
   * presses Enter or comma).
   */
  draft: string;
  onDraftChange: (draft: string) => void;
  /**
   * 'search' runs one Discord search per term (any-of) and merges the
   * results; 'refine' matches loaded messages locally, any term.
   * Only the helper copy differs; the criteria shape is the same.
   */
  mode: 'search' | 'refine';
  /** Section heading; the Refine section uses the shorter "Content". */
  label?: string;
  /** Constant per section so the box stays findable; defaults per mode. */
  placeholder?: string;
  /** Root test id; defaults to `content-filter-<mode>`. */
  testId?: string;
  /**
   * Called on Enter with the terms as they will be after the draft is added,
   * so the section can apply with them (state updates are async; applying
   * from the stale `terms` prop would drop the term just typed).
   */
  onSubmit?: (terms: string[]) => void;
}

/** Terms plus the draft (trimmed, if new). Shared with FilterModal's apply. */
export const withDraft = (terms: string[], draft: string): string[] => {
  const term = draft.trim();
  return term.length > 0 && !terms.includes(term) ? [...terms, term] : terms;
};

/**
 * ContentFilter (#244): message-content terms as chips, matched any-of.
 * Enter adds whatever is typed as a term and applies the section, so the
 * one-term habit ("type, Enter, search") is unchanged; a comma adds a term
 * without applying, for building up several. A term keeps its inner spaces
 * (Discord ANDs the words inside one term, the same as typing them into
 * Discord's own search).
 */
const ContentFilter = ({
  terms,
  onChange,
  draft,
  onDraftChange,
  mode,
  label = 'Message Content',
  placeholder = mode === 'search' ? 'Search message content...' : 'Filter by content...',
  testId = `content-filter-${mode}`,
  onSubmit,
}: ContentFilterProps) => {
  /** Adds the draft as a term (if new) and returns the resulting list. */
  const commitDraft = (): string[] => {
    const next = withDraft(terms, draft);
    if (next !== terms) onChange(next);
    onDraftChange('');
    return next;
  };

  return (
    <Box data-testid={testId}>
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      {terms.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          {terms.map((term) => (
            <Chip
              key={term}
              label={term}
              size="small"
              color="primary"
              onDelete={() => onChange(terms.filter((t) => t !== term))}
              sx={{ fontWeight: 500 }}
            />
          ))}
        </Box>
      )}
      <TextField
        size="small"
        fullWidth
        placeholder={placeholder}
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit?.(commitDraft());
          } else if (e.key === ',') {
            e.preventDefault();
            commitDraft();
          }
        }}
        onBlur={commitDraft}
        inputProps={{ 'data-testid': `${testId}-input`, 'aria-label': 'Message content term' }}
        helperText={
          terms.length > 1
            ? mode === 'search'
              ? `Any of ${terms.length} terms. Discord searches one term at a time, so this runs ${terms.length} searches and merges them.`
              : `Messages containing any of the ${terms.length} terms.`
            : 'Comma adds another term; matches any of them.'
        }
      />
    </Box>
  );
};

export default ContentFilter;
