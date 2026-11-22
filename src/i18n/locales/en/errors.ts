// en catalog fragment: errors
export const errors: Record<string, string> = {
  // ── generic ──
  'errors.fileTooLarge': 'File size cannot exceed {max}MB',
  'errors.generateFailed': 'Generation failed, please try again',
  'errors.apiKeyMissing': 'Please configure the API Key first',
  'errors.rateLimited': 'Too many requests, please slow down',
  'errors.contentSensitive': 'The content you asked me to read is a bit sensitive',
  'errors.serverOverloaded': 'The model server is overloaded, please try again later',
  'errors.modelNoContent': 'The model returned no content',
  'errors.modelParseFailed': 'Failed to parse the AI response, please try again',

  // ── recording ──
  'errors.recordStartFailed': 'Unable to start recording',
  'errors.recordUnsupported': 'Recording is not supported in this environment; please upload a file instead',
  'errors.micPermissionDenied': 'Microphone permission not granted: please allow YiziVoice to use the microphone in system settings',
  'errors.micNotFound': 'No microphone device detected',
  'errors.micInUse': 'The microphone is in use by another program; close it and try again',
  'errors.micUnsupportedParams': 'The microphone does not support the required recording parameters',
  'errors.mediaComponentsMissing': 'This system is missing the media components required for recording',

  // ── storage / history ──
  'errors.audioReadFailed': 'Failed to read audio',
  'errors.downloadFailed': 'Download failed',
  'errors.cleanupFailed': 'Cleanup failed',
  'errors.invalidVoiceFile': 'Invalid voice file format',
}
