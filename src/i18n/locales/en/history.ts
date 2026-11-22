// en catalog fragment: history
export const history: Record<string, string> = {
  // ── history list ──
  'history.searchPlaceholder': 'Search history…',
  'history.tabAll': 'All',
  'history.emptyTitle': 'No records yet',
  'history.emptyHint': 'Generated content will be saved here automatically',
  'history.moreActions': 'More actions',
  'history.openFolder': 'Open folder',
  'history.pruneOrphans': 'Clean up orphan audio',
  'history.clearAll': 'Clear all records',
  'history.copyText': 'Copy text',
  'history.restoreTask': 'Restore task',

  // ── toasts ──
  'history.audioMissing': 'Audio file not found',
  'history.audioLoadFailed': 'Failed to load audio',
  'history.noOrphanAudio': 'No orphan audio found',
  'history.pruneDone': 'Cleaned up {count} orphan audio file(s)',
  'history.deleted': 'Deleted',
  'history.clearedAll': 'History cleared',

  // ── dialogs ──
  'history.deleteConfirm': 'Confirm delete',
  'history.deleteBody': 'Delete this record? The generated audio will also be deleted. This cannot be undone.',
  'history.pruneBody': 'Found {count} audio file(s) no longer linked to any record. Delete them? This cannot be undone.',
  'history.pruneAction': 'Confirm cleanup',
}
