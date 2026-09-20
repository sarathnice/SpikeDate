'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Check, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { cameraQualityMessage } from '@/lib/camera-quality';
import { detectCaptureFaces } from '@/lib/face-capture';

export type PhotoVerificationStatus =
  | 'unverified'
  | 'pending'
  | 'needs_review'
  | 'needs_retry'
  | 'capture_ready'
  | 'photo_verified'
  | 'identity_verified';

type FrameMetrics = {
  brightness: number;
  sharpness: number;
  faceCount: number | null;
  frameCount: number;
  captureDigest: string;
};

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
  registration = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: PhotoVerificationStatus;
  serverEnabled: boolean;
  accountKey: string;
  onStatusChange: (status: PhotoVerificationStatus) => void;
  registration?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestId = useRef('');
  const generation = useRef(0);
  const [stage, setStage] = useState<'intro' | 'camera' | 'review' | 'result'>('intro');
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [pendingCapture, setPendingCapture] = useState<FrameMetrics | null>(null);
  const [capturedPreview, setCapturedPreview] = useState('');

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const cancelPending = () => {
    const attempt = generation.current;
    const id = requestId.current;
    requestId.current = '';
    if (serverEnabled && id)
      void fetch('/api/verification', {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', requestId: id }),
      })
        .then((response) => {
          if (response.ok && attempt === generation.current)
            onStatusChange('unverified');
        })
        .catch(() => {});
  };

  useEffect(() => {
    generation.current += 1;
    setBusy(false);
    if (!open) {
      stopCamera();
      setPendingCapture(null);
      setCapturedPreview('');
      return;
    }
    setStage(
      status === 'unverified' || status === 'needs_retry' ? 'intro' : 'result',
    );
    setConsented(false);
    setMessage('');
    setTestMode(false);
    setPendingCapture(null);
    setCapturedPreview('');
    return () => {
      generation.current += 1;
      stopCamera();
    };
  }, [open, status]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return;
      generation.current += 1;
      stopCamera();
      cancelPending();
      setStage('intro');
      setBusy(false);
      setMessage(
        'Camera paused while the app was in the background. Start again when ready.',
      );
    };
    if (open) document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [open]);

  useEffect(() => {
    if (stage === 'camera' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => {});
    }
  }, [stage]);

  const startCamera = async () => {
    if (!consented || busy) return;
    const attempt = ++generation.current;
    setBusy(true);
    setMessage('');
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          'Camera access requires HTTPS (or localhost) and a supported browser. Open the secure app on a camera-equipped device and retry.',
        );
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
      });
      if (attempt !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (serverEnabled && !requestId.current) {
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
        if (attempt !== generation.current) {
          void fetch('/api/verification', {
            method: 'POST',
            keepalive: true,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              action: 'cancel',
              requestId: result.request.id,
            }),
          }).catch(() => {});
          return;
        }
        requestId.current = result.request.id;
        setTestMode(Boolean(result.testMode));
      } else if (!serverEnabled) {
        requestId.current = `local_${Date.now()}`;
        setTestMode(true);
      }
      setStage('camera');
    } catch (error) {
      if (attempt === generation.current) stopCamera();
      if (attempt === generation.current)
        setMessage(
          error instanceof Error
            ? error.name === 'NotAllowedError'
              ? 'Camera permission was denied. Allow camera access in your browser settings and retry, or finish later.'
              : error.name === 'NotFoundError'
                ? 'No camera was found. Use a device with a front camera, or finish later.'
                : error.message
            : 'Camera access was not available. Try again.',
        );
    } finally {
      if (attempt === generation.current) setBusy(false);
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || busy) {
      setMessage('Wait for the camera image to appear, then try again.');
      return;
    }
    setBusy(true);
    const attempt = ++generation.current;
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
      let detection: Awaited<ReturnType<typeof detectCaptureFaces>>;
      try {
        detection = await detectCaptureFaces(canvas);
      } catch {
        throw new Error(
          'Face detection could not load. Check your connection and retry; your profile has not been verified.',
        );
      }
      if (attempt !== generation.current) return;
      const { faceCount, positioned } = detection;
      const metrics = {
        brightness,
        sharpness,
        faceCount,
        frameCount: 1,
      };
      const qualityMessage = cameraQualityMessage(metrics);
      if (qualityMessage) {
        setMessage(qualityMessage);
        return;
      }
      if (!positioned) {
        setMessage('Move closer and center your whole face inside the oval.');
        return;
      }
      const payload: FrameMetrics = {
        ...metrics,
        captureDigest: await digestCanvas(canvas),
      };
      if (attempt !== generation.current) return;
      setPendingCapture(payload);
      setCapturedPreview(canvas.toDataURL('image/jpeg', 0.9));
      stopCamera();
      setStage('review');
      setMessage('');
    } catch (error) {
      if (attempt === generation.current)
        setMessage(
          error instanceof Error
            ? error.message
            : 'The camera check could not finish. Try again.',
        );
    } finally {
      if (attempt === generation.current) setBusy(false);
    }
  };

  const saveCapture = async () => {
    if (!pendingCapture || busy) return;
    const attempt = ++generation.current;
    setBusy(true);
    setMessage('Saving your camera check…');
    try {
      let nextStatus: PhotoVerificationStatus = 'capture_ready';
      if (serverEnabled) {
        const response = await fetch('/api/verification', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'complete',
            requestId: requestId.current,
            metrics: pendingCapture,
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
        requestId.current = '';
        if (attempt !== generation.current) return;
        setTestMode(Boolean(result.testMode));
      } else {
        window.localStorage.setItem(
          `spikedate-photo-verification:${accountKey}`,
          'capture_ready',
        );
      }
      setPendingCapture(null);
      setCapturedPreview('');
      onStatusChange(nextStatus);
      setStage('result');
      setMessage('');
    } catch (error) {
      if (attempt === generation.current)
        setMessage(
          error instanceof Error
            ? error.message
            : 'The camera check could not be saved. Try again.',
        );
    } finally {
      if (attempt === generation.current) setBusy(false);
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
        if (!next) {
          generation.current += 1;
          stopCamera();
          cancelPending();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={`verification-dialog ${stage === 'camera' || stage === 'review' ? 'verification-dialog-capture' : ''}`}
      >
        <button
          type="button"
          className="match-close"
          aria-label="Close photo verification"
          onClick={() => {
            generation.current += 1;
            stopCamera();
            cancelPending();
            onOpenChange(false);
          }}
        >
          <X size={19} />
        </button>

        {stage === 'intro' && (
          <>
            <div className="verification-shield" aria-hidden="true">
              <ShieldCheck size={32} />
            </div>
            <p className="verification-kicker">
              {registration ? 'REGISTRATION · CAMERA CHECK' : 'PROFILE SAFETY'}
            </p>
            <DialogTitle>Capture your face</DialogTitle>
            <DialogDescription>
              One clear face, in even light. This prepares a capture—it does not
              verify identity or test liveness.
            </DialogDescription>
            <div className="verification-points">
              <span>
                <Check size={17} /> Uses the front camera only
              </span>
              <span>
                <Check size={17} /> Checks lighting, image detail, and one
                visible face
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
                I consent to on-device face detection. The selfie is not
                uploaded or saved; only a capture hash and check status are
                stored. This does not verify my identity.
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
              Liveness and profile-photo matching are not connected yet. No
              verified badge is issued by this check. Your new profile stays
              private until verification is completed.
            </p>
            <button
              type="button"
              className="verification-secondary"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Finish later
            </button>
          </>
        )}

        {stage === 'camera' && (
          <>
            <div className="verification-capture-header">
              <p className="verification-kicker">ON-DEVICE FACE DETECTION</p>
              <DialogTitle>Place your face inside the oval</DialogTitle>
              <DialogDescription>
                Face forward in even light. Keep everyone else out of the frame.
              </DialogDescription>
            </div>
            <div className="verification-capture-body">
              <div className="verification-camera">
                <video ref={videoRef} autoPlay muted playsInline />
                <span className="verification-face-guide" aria-hidden="true" />
                <span className="verification-live-dot">LIVE</span>
              </div>
            </div>
            <div className="verification-capture-actions">
              {message && (
                <p className={`verification-message ${message.startsWith('Checking') ? '' : 'error'}`} role="status">
                  {message}
                </p>
              )}
              <button type="button" className="primary-button verification-primary" onClick={capture} disabled={busy}>
                <Camera size={19} /> {busy ? 'Checking…' : 'Capture and check'}
              </button>
              <button
                type="button"
                className="verification-secondary"
                onClick={() => {
                  stopCamera();
                  generation.current += 1;
                  cancelPending();
                  setStage('intro');
                  setMessage('');
                }}
              >
                Back
              </button>
            </div>
          </>
        )}

        {stage === 'review' && (
          <>
            <div className="verification-capture-header">
              <p className="verification-kicker">REVIEW YOUR CAPTURE</p>
              <DialogTitle>Is your face clear and centered?</DialogTitle>
              <DialogDescription>
                Retake if needed, or save this camera check. The selfie is not stored or added to your profile.
              </DialogDescription>
            </div>
            <div className="verification-capture-body">
              <div className="verification-camera verification-captured-preview">
                {/* Ephemeral camera frame; never sent to the server. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={capturedPreview} alt="Captured face for review" />
              </div>
            </div>
            <div className="verification-capture-actions">
              {message && <p className="verification-message error" role="alert">{message}</p>}
              <button type="button" className="primary-button verification-primary" onClick={saveCapture} disabled={busy}>
                <Check size={19} /> {busy ? 'Saving check…' : 'Save camera check'}
              </button>
              <button type="button" className="verification-secondary" onClick={() => {
                setPendingCapture(null);
                setCapturedPreview('');
                void startCamera();
              }} disabled={busy}>
                <RefreshCw size={17} /> Retake
              </button>
            </div>
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
            <DialogTitle aria-live="polite">
              {verified
                ? 'Your photos are verified'
                : status === 'capture_ready'
                  ? 'Camera check complete'
                  : status === 'needs_retry'
                    ? 'Another capture is needed'
                    : 'Photo verification is not complete'}
            </DialogTitle>
            <DialogDescription>
              {verified
                ? 'A Photo Verified badge now appears with your SpikeDate profile.'
                : status === 'capture_ready'
                  ? 'One clear face was detected. Liveness and profile-photo matching still require a verification provider. This check does not issue a verified badge or make a new profile discoverable.'
                  : status === 'needs_retry'
                    ? 'Try again with one face, steady focus, and even lighting.'
                    : 'Photo verification is not complete. Liveness and profile-photo matching require a connected verification provider.'}
            </DialogDescription>
            {testMode && (
              <p className="verification-test-mode">
                Local test mode · no identity decision and no retained selfie
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
