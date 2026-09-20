export type CameraQuality = {
  brightness: number;
  sharpness: number;
  faceCount: number | null;
};

// These are capture-quality hints, NOT liveness or identity decisions.
export function cameraQualityMessage(metrics: CameraQuality) {
  if (metrics.faceCount === null)
    return 'Face detection is unavailable. Retry the camera check on a supported browser.';
  if (metrics.faceCount === 0)
    return 'Keep one face completely inside the oval.';
  if (metrics.faceCount !== 1)
    return 'Only one person can complete this camera check.';
  if (metrics.brightness < 42) return 'Move somewhere brighter and try again.';
  if (metrics.brightness > 225)
    return 'Reduce the light directly behind or in front of you.';
  if (metrics.sharpness < 4.5)
    return 'Hold the phone steady and let the camera focus.';
  return '';
}
