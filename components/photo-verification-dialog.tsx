'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Check, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

export type PhotoVerificationStatus =
  | 'unverified'
  | 'pending'
  | 'needs_review'
  | 'needs_retry'
  | 'photo_verified'
  | 'identity_verified';

type FrameMetrics = {
  brightness: number;
  sharpness: number;
  faceCount: number | null;
  frameCount: number;
  captureDigest: string;
};

type FaceDetectorLike = {
  detect: (source: HTMLCanvasElement) => Promise<unknown[]>;
};

type FaceDetectorConstructor = new (options?: {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}) => FaceDetectorLike;

export function assessCameraFrame(data: Uint8ClampedArray) {
  let luminance = 0;
  let contrast = 0;
  let samples = 0;
  let previous = -1;
  for (let index = 0; index < data.length; index += 16) {
    const value =
      data[index] * 0.2126 +
      data[index + 1] * 0.7152 +
      data[index + 2] * 0.0722;
    luminance += value;
    if (previous >= 0) contrast += Math.abs(value - previous);
    previous = value;
    samples += 1;
  }
  return {
    brightness: samples ? luminance / samples : 0,
    sharpness: samples > 1 ? contrast / (samples - 1) : 0,
  };
}

function frameMessage(metrics: Omit<FrameMetrics, 'captureDigest'>) {
  if (metrics.brightness < 42) return 'Move somewhere brighter and try again.';
  if (metrics.brightness > 225)
    return 'Reduce the light directly behind or in front of you.';
  if (metrics.sharpness < 4.5)
    return 'Hold the phone steady and let the camera focus.';
  if (metrics.faceCount === 0)
    return 'Keep one face completely inside the oval.';
  if (metrics.faceCount !== null && metrics.faceCount > 1)
    return 'Only one person can complete this safety check.';
  return '';
}

async function digestCanvas(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) =>
        result
          ? resolve(result)
          : reject(new Error('The camera frame could not be prepared.')),
      'image/jpeg',
      0.82,
    ),
  );
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(hash)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export function PhotoVerificationDialog({
  open,
  onOpenChange,
  status,
  serverEnabled,
  accountKey,
  onStatusChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: PhotoVerificationStatus;
  serverEnabled: boolean;
  accountKey: string;
  onStatusChange: (status: PhotoVerificationStatus) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestId = useRef('');
  const [stage, setStage] = useState<'intro' | 'camera' | 'result'>('intro');
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [testMode, setTestMode] = useState(false);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    setStage(status === 'unverified' ? 'intro' : 'result');
    setConsented(false);
    setMessage('');
    setTestMode(false);
    return stopCamera;
  }, [open, status]);

  const startCamera = async () => {
    if (!consented || busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error('This device does not provide camera access here.');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (serverEnabled) {
        const response = await fetch('/api/verification', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'start', consent: true }),
        });
        const result = (await response.json()) as {
          request?: { id: string };
          error?: string;
          testMode?: boolean;
        };
        if (!response.ok || !result.request)
          throw new Error(result.error || 'The safety check could not start.');
        requestId.current = result.request.id;
        setTestMode(Boolean(result.testMode));
      } else {
        requestId.current = `local_${Date.now()}`;
        setTestMode(true);
      }
      setStage('camera');
      window.setTimeout(() => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => {});
      }, 0);
    } catch (error) {
      stopCamera();
      setMessage(
        error instanceof Error
          ? error.message
          : 'Camera access was not available. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || busy) {
      setMessage('Wait for the camera image to appear, then try again.');
      return;
    }
    setBusy(true);
    setMessage('Checking lighting, focus, and face position…');
    try {
      const canvas = document.createElement('canvas');
      const sourceSize = Math.min(video.videoWidth, video.videoHeight);
      canvas.width = 480;
      canvas.height = 480;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Camera analysis is unavailable.');
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(
        video,
        (video.videoWidth - sourceSize) / 2,
        (video.videoHeight - sourceSize) / 2,
        sourceSize,
        sourceSize,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const { brightness, sharpness } = assessCameraFrame(
        context.getImageData(0, 0, canvas.width, canvas.height).data,
      );
      const Detector = (
        window as typeof window & { FaceDetector?: FaceDetectorConstructor }
      ).FaceDetector;
      const faceCount = Detector
        ? (
            await new Detector({ fastMode: true, maxDetectedFaces: 2 }).detect(
              canvas,
            )
          ).length
        : null;
      const metrics = {
        brightness,
        sharpness,
        faceCount,
        frameCount: 1,
      };
      const qualityMessage = frameMessage(metrics);
      if (qualityMessage) {
        setMessage(qualityMessage);
        return;
      }
      const payload: FrameMetrics = {
        ...metrics,
        captureDigest: await digestCanvas(canvas),
      };
      let nextStatus: PhotoVerificationStatus = 'photo_verified';
      if (serverEnabled) {
        const response = await fetch('/api/verification', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'complete',
            requestId: requestId.current,
            metrics: payload,
          }),
        });
        const result = (await response.json()) as {
          status?: PhotoVerificationStatus;
          error?: string;
          testMode?: boolean;
        };
        if (!response.ok)
          throw new Error(result.error || 'The safety check could not finish.');
        nextStatus = result.status || 'needs_review';
        setTestMode(Boolean(result.testMode));
      } else {
        window.localStorage.setItem(
          `spikedate-photo-verification:${accountKey}`,
          'photo_verified',
        );
      }
      stopCamera();
      onStatusChange(nextStatus);
      setStage('result');
      setMessage('');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'The camera check could not finish. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const removeVerification = async () => {
    setBusy(true);
    setMessage('');
    try {
      if (serverEnabled) {
        const response = await fetch('/api/verification', { method: 'DELETE' });
        const result = (await response.json()) as { error?: string };
        if (!response.ok)
          throw new Error(result.error || 'Verification could not be removed.');
      } else {
        window.localStorage.setItem(
          `spikedate-photo-verification:${accountKey}`,
          'unverified',
        );
      }
      onStatusChange('unverified');
      setStage('intro');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Verification could not be removed.',
      );
    } finally {
      setBusy(false);
    }
  };

  const verified =
    status === 'photo_verified' || status === 'identity_verified';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) stopCamera();
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={false} className="verification-dialog">
        <button
          type="button"
          className="match-close"
          aria-label="Close photo verification"
          onClick={() => onOpenChange(false)}
        >
          <X size={19} />
        </button>

        {stage === 'intro' && (
          <>
            <div className="verification-shield" aria-hidden="true">
              <ShieldCheck size={32} />
            </div>
            <p className="verification-kicker">PROFILE SAFETY</p>
            <DialogTitle>Confirm you match your photos</DialogTitle>
            <DialogDescription>
              A private camera check helps people know that a live person
              resembles the main profile photo.
            </DialogDescription>
            <div className="verification-points">
              <span>
                <Check size={17} /> Uses the front camera only
              </span>
              <span>
                <Check size={17} /> Checks lighting, focus, and one visible face
              </span>
              <span>
                <Check size={17} /> Never adds this selfie to your profile
              </span>
            </div>
            <label className="verification-consent">
              <input
                type="checkbox"
                checked={consented}
                onChange={(event) => setConsented(event.target.checked)}
              />
              <span>
                I consent to this one-time camera safety check. I understand
                that Photo Verified does not verify someone’s background or
                intentions.
              </span>
            </label>
            {message && (
              <p className="verification-message error" role="alert">
                {message}
              </p>
            )}
            <button
              type="button"
              className="primary-button verification-primary"
              onClick={startCamera}
              disabled={!consented || busy}
            >
              <Camera size={19} />{' '}
              {busy ? 'Starting camera…' : 'Start camera check'}
            </button>
            <p className="verification-privacy">
              The test build evaluates the camera frame without uploading the
              selfie. Production biometric matching requires the configured
              verification provider.
            </p>
          </>
        )}

        {stage === 'camera' && (
          <>
            <p className="verification-kicker">LIVE CAMERA CHECK</p>
            <DialogTitle>Place your face inside the oval</DialogTitle>
            <DialogDescription>
              Face forward in even light. Remove sunglasses and keep everyone
              else out of the frame.
            </DialogDescription>
            <div className="verification-camera">
              <video ref={videoRef} autoPlay muted playsInline />
              <span className="verification-face-guide" aria-hidden="true" />
              <span className="verification-live-dot">LIVE</span>
            </div>
            {message && (
              <p
                className={`verification-message ${message.startsWith('Checking') ? '' : 'error'}`}
                role="status"
              >
                {message}
              </p>
            )}
            <button
              type="button"
              className="primary-button verification-primary"
              onClick={capture}
              disabled={busy}
            >
              <Camera size={19} /> {busy ? 'Checking…' : 'Capture and check'}
            </button>
            <button
              type="button"
              className="verification-secondary"
              onClick={() => {
                stopCamera();
                setStage('intro');
                setMessage('');
              }}
            >
              Back
            </button>
          </>
        )}

        {stage === 'result' && (
          <>
            <div
              className={`verification-shield ${verified ? 'verified' : ''}`}
            >
              {verified ? <Check size={34} /> : <ShieldCheck size={32} />}
            </div>
            <p className="verification-kicker">PROFILE SAFETY</p>
            <DialogTitle>
              {verified
                ? 'Your photos are verified'
                : status === 'needs_retry'
                  ? 'Another capture is needed'
                  : 'Your check is under review'}
            </DialogTitle>
            <DialogDescription>
              {verified
                ? 'A Photo Verified badge now appears with your SpikeDate profile.'
                : status === 'needs_retry'
                  ? 'Try again with one face, steady focus, and even lighting.'
                  : 'We will update the badge after the configured provider completes the check.'}
            </DialogDescription>
            {testMode && (
              <p className="verification-test-mode">
                Test mode · camera quality flow verified without retaining a
                selfie
              </p>
            )}
            {message && (
              <p className="verification-message error" role="alert">
                {message}
              </p>
            )}
            <button
              type="button"
              className="primary-button verification-primary"
              onClick={() => onOpenChange(false)}
            >
              Done
            </button>
            <button
              type="button"
              className="verification-secondary"
              onClick={() => {
                setStage('intro');
                setConsented(false);
              }}
            >
              <RefreshCw size={17} /> Run camera check again
            </button>
            {status !== 'unverified' && (
              <button
                type="button"
                className="verification-remove"
                onClick={removeVerification}
                disabled={busy}
              >
                <Trash2 size={16} /> Remove verification data
              </button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
