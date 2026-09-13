export type VoiceMode = 'command' | 'live';

const enabled = (value: string | undefined, fallback: boolean) =>
  value === undefined
    ? fallback
    : !['0', 'false', 'off', 'disabled'].includes(value.toLowerCase());

/** Build-time capability flags only. Never place provider secrets here. */
export const voiceDeployment = {
  enabled: enabled(process.env.NEXT_PUBLIC_PULSE_VOICE_ENABLED, true),
  commandEnabled: enabled(
    process.env.NEXT_PUBLIC_PULSE_VOICE_COMMAND_ENABLED,
    false,
  ),
  liveEnabled: enabled(process.env.NEXT_PUBLIC_PULSE_VOICE_LIVE_ENABLED, false),
  cloudEnabled: enabled(
    process.env.NEXT_PUBLIC_PULSE_VOICE_CLOUD_ENABLED,
    false,
  ),
  testMode: enabled(process.env.NEXT_PUBLIC_PULSE_VOICE_TEST_MODE, true),
} as const;

export const defaultVoiceMode: VoiceMode = voiceDeployment.commandEnabled
  ? 'command'
  : 'live';
