// en catalog fragment: settings
export const settings: Record<string, string> = {
  'settings.language': 'Interface language',
  'settings.languageHint': 'Takes effect immediately and is saved to local settings',

  // ── hub tab ──
  'settings.tabDesc': 'API key, AI text model, and data storage location',

  // ── api key ──
  'settings.apiKey': 'API Key',
  'settings.keyStorageHint': 'Stored encrypted in the system keychain (Windows Credential Manager / macOS Keychain); cannot be viewed after saving',
  'settings.keyStorageAria': 'Key storage info',
  'settings.clear': 'Clear',
  'settings.verify': 'Verify',
  'settings.verifying': 'Verifying',
  'settings.verifyOk': 'Verified',
  'settings.verifyFailed': 'Verification failed',
  'settings.keyConfigured': 'Configured',
  'settings.keyNotConfigured': 'Not configured',
  'settings.keyPlaceholderSaved': 'Saved encrypted; enter a new key to replace',
  'settings.noApiKeyYet': 'No API Key yet?',
  'settings.openRegisterTitle': 'Open the MiMo platform signup page in your browser',
  'settings.inviteCode': 'Invite code',
  'settings.keySaved': 'API Key saved with encryption',
  'settings.keySaveFailed': 'API Key could not be written to the system keychain',
  'settings.keyCleared': 'API Key cleared',
  'settings.keyClearFailed': 'Failed to clear API Key',
  'settings.clearKeyTitle': 'Clear API Key',
  'settings.clearKeySubtitle': 'You will need to enter a key again to keep using voice features.',
  'settings.clearKeyConfirm': 'Confirm clear',

  // ── ai text model ──
  'settings.textModel': 'AI text model',
  'settings.textModelHint': 'Used for in-app AI style description generation',
  'settings.textModelAria': 'What the text model is for',
  'settings.fetchModels': 'Fetch models',
  'settings.fetchModelsFailed': 'Failed to fetch models',
  'settings.noModels': 'No text models available',
  'settings.modelSaved': 'AI text model updated',
  'settings.modelSavedKeyringFailed': 'Model saved, but the keychain operation failed',
  'settings.pricingHint': 'Note: MiMo-TTS speech generation models are free to call, while MiMo-ASR speech-to-text models and MiMo-2.6 text generation models are paid and require account balance. Register and use the invite code on the right for an extra 10-yuan trial credit.',
  'settings.modelSuggestion': 'We recommend mimo-v2.6-flash — plenty capable, and each voice description costs only a few cents.',

  // ── data storage ──
  'settings.dataStorage': 'Data storage',
  'settings.currentDataDir': 'Current data directory',
  'settings.customDir': 'Custom',
  'settings.dirLoading': 'Loading…',
  'settings.selectDir': 'Choose folder',
  'settings.migrateToDir': 'Migrate to chosen folder',
  'settings.resetDir': 'Restore default',
  'settings.willMigrateTo': 'Will migrate to: {dir}',
  'settings.defaultDirHint': 'Default location is Documents / YiziVoice /, and full migration is supported',
  'settings.migrateDone': 'Migration complete; the new directory is now active',
  'settings.migrateFailed': 'Migration failed',
  'settings.migrateFailedWith': 'Migration failed: {message}',
  'settings.unknownError': 'Unknown error',
  'settings.dirResetDone': 'Default directory restored',
}
