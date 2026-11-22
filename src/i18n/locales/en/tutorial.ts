// en catalog fragment: tutorial
export const tutorial: Record<string, string> = {
  // ── hub tab ──
  'tutorial.tabDesc': 'From setup to generation, step by step',

  // ── overview flow ──
  'tutorial.overviewTitle': 'The 30-second tour',
  'tutorial.overviewHint': 'Click any node to jump there',
  'tutorial.flow.keys.label': 'Set up key & model',
  'tutorial.flow.keys.caption': 'API Key + text model',
  'tutorial.flow.voice.label': 'Prepare voices',
  'tutorial.flow.voice.caption': 'Clone / upload / design',
  'tutorial.flow.tts.caption': 'Pick a voice, write, generate',
  'tutorial.flow.asr.caption': 'Record or upload to text',
  'tutorial.flow.history.label': 'History & export',
  'tutorial.flow.history.caption': 'Play / restore / download',

  // ── step actions ──
  'tutorial.goSettings': 'Go to settings',
  'tutorial.goClone': 'Go to voice clone',
  'tutorial.goTts': 'Go to text to speech',
  'tutorial.goAsr': 'Go to speech to text',

  // ── expand / collapse ──
  'tutorial.collapse': 'Collapse',
  'tutorial.expandMore': 'Show more',

  // ── step 1: api key ──
  'tutorial.step1.title': 'Set up your API Key',
  'tutorial.step1.goal': 'First, let the app call the MiMo API',
  'tutorial.step1.b1': 'Open Settings (gear at the top-right of the title bar, or Ctrl+,)',
  'tutorial.step1.b2': 'No account yet? {link} first — invite code {code} gets you a 10-yuan trial credit',
  'tutorial.step1.b2Link': 'sign up for a MiMo account',
  'tutorial.step1.b3': 'Paste the key, hit Verify to check it, then Save inside the input box',
  'tutorial.step1.m1': 'The key is stored encrypted in the system keychain and never shown again',
  'tutorial.step1.m2': 'To replace it, type a new key; to remove it, click Clear and confirm in the dialog',
  'tutorial.step1.m3': 'Verify calls the /models probe and consumes no tokens',

  // ── step 2: ai text model ──
  'tutorial.step2.title': 'Set up the AI text model',
  'tutorial.step2.goal': 'Decide which text model AI generate uses',
  'tutorial.step2.b1': 'On the same settings page, AI text model sits under the API Key',
  'tutorial.step2.b2': 'Default is mimo-v2.6-flash; click Fetch models to list text models available to your key',
  'tutorial.step2.b3': 'Picking one from the dropdown fills and saves it; you can also type a model ID manually',
  'tutorial.step2.m1': 'Powers AI style description and AI description & preview text',
  'tutorial.step2.m2': 'TTS is free; ASR and the 2.6-series text models are paid and need account balance',
  'tutorial.step2.m3': 'We recommend mimo-v2.6-flash — each voice description costs only a few cents',

  // ── step 3: voice clone ──
  'tutorial.step3.title': 'Voice cloning & design',
  'tutorial.step3.goal': 'Prepare a voice first, then use it in text to speech',
  'tutorial.step3.b1': 'Three entry points: Start recording, Upload file, Design voice',
  'tutorial.step3.b2': 'After recording/uploading, click Confirm and save role, preview, then fill in name and category',
  'tutorial.step3.b3': 'For designed voices, AI description & preview text at the top-right fills both sections at once',
  'tutorial.step3.m1': 'Preview text you wrote by hand is never overwritten by AI',
  'tutorial.step3.m2': 'Designed voices land in the Designed voices category by default',
  'tutorial.step3.m3': 'The designed audio is kept as a sample; text to speech still reuses it via voiceclone',

  // ── step 4: tts ──
  'tutorial.step4.goal': 'Turn your script into speech with the chosen voice',
  'tutorial.step4.b1': 'Type your script and pick a preset or cloned voice on the right (preview available)',
  'tutorial.step4.b2': 'Choose a style mode: Tags, Free description, or Director',
  'tutorial.step4.b3': 'Click Generate; play or download the WAV when it is done',
  'tutorial.step4.m1': 'Tags: pick style chips and insert leading style tags or inline audio tags as needed',
  'tutorial.step4.m2': 'Free description / Director: click AI style description to fill it in',
  'tutorial.step4.m3': 'TTS-series speech generation models are free to call',

  // ── step 5: asr ──
  'tutorial.step5.goal': 'Turn a recording or audio file into text',
  'tutorial.step5.b1': 'Open Speech to Text, click Start recording or upload an audio file',
  'tutorial.step5.b2': 'Review and copy the text when recognition finishes',
  'tutorial.step5.b3': 'Recorded audio can be played back from history',
  'tutorial.step5.m1': 'Uploads are not copied into the data directory; the original file stays where it is',
  'tutorial.step5.m2': 'ASR is a paid model and needs account balance',

  // ── step 6: history ──
  'tutorial.step6.goal': 'Review, restore, or export earlier results',
  'tutorial.step6.b1': 'The left pane auto-saves every generation/recognition, with search and All / TTS / ASR filters',
  'tutorial.step6.b2': 'Hovering an entry reveals: play, copy text, restore task, download audio, delete',
  'tutorial.step6.b3': 'Restore task is TTS-only and reloads mode, voice, style, text, and the result audio together',
  'tutorial.step6.m1': 'While playing, the whole action group on that row stays visible',
  'tutorial.step6.m2': 'The … menu at the top-right cleans up orphan audio',
  'tutorial.step6.m3': 'Deleting a record also deletes its audio',

  // ── storage section ──
  'tutorial.storageTitle': 'Files & data storage',
  'tutorial.storage1': 'History lives in Documents / YiziVoice / History /: index.json is the index, and tts/ and asr/ hold the matching audio',
  'tutorial.storage2': 'Voices, styles, and audio tags are stored in Documents / YiziVoice / config /',
  'tutorial.storage3': 'Check the current folder under Settings → Data storage, and migrate everything to a new location',
  'tutorial.storage4': 'The API Key is never written to a file — it stays in the system keychain (Windows Credential Manager / macOS Keychain)',

  // ── mock sketches (tutorialMocks) ──
  'tutorial.mock.frame': 'UI sketch · {label}',
  'tutorial.mock.settingsKey': 'Settings · API key',
  'tutorial.mock.settingsModel': 'Settings · AI text model',
  'tutorial.mock.voiceSample': 'Voice clone · Submit a voice sample',
  'tutorial.mock.keyHint': 'Never shown again after saving; type a new key to replace',
  'tutorial.mock.startRecording': 'Start recording',
  'tutorial.mock.uploadFile': 'Upload file',
  'tutorial.mock.designVoice': 'Design voice',
  'tutorial.mock.voiceDesc': 'Voice description',
  'tutorial.mock.aiGenBoth': 'AI description & preview text',
  'tutorial.mock.voiceDescSample': 'A woman in her thirties, warm and clear voice…',
  'tutorial.mock.previewText': 'Preview text',
  'tutorial.mock.previewPlaceholder': 'Leave empty to auto-generate',
  'tutorial.mock.modeTags': 'Tags',
  'tutorial.mock.modeFree': 'Free description',
  'tutorial.mock.modeDirector': 'Director',
  'tutorial.mock.currentVoice': 'Current voice: MiMo-default',
  'tutorial.mock.textPlaceholder': 'Type the script to read…',
  'tutorial.mock.generate': 'Generate',
  'tutorial.mock.asrPlaceholder': 'Recognition results will appear here…',
  'tutorial.mock.copyHint': 'Copy text in one click',
  'tutorial.mock.historyItem': 'TTS · Lao Du',
  'tutorial.mock.historyText': '(Angry) You think cutting my endorsement will make me beg on my knees?',
  'tutorial.mock.historyOpsHint': 'Hover reveals actions: play / copy / restore / download / delete',
  'tutorial.mock.storageTree': 'Data directory',
  'tutorial.mock.storageTreeText': 'Documents / YiziVoice\n├─ History/\n│  ├─ index.json\n│  ├─ tts/\n│  └─ asr/\n└─ config/\n   ├─ voices/\n   ├─ styles/\n   └─ audio-tags/',
}
