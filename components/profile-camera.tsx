'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import Image from 'next/image';
import { detectCaptureFaces } from '@/lib/face-capture';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

/** Profile photography is separate from the private safety-camera check. */
export function ProfileCamera({
  open,
  onOpenChange,
  onPhoto,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPhoto: (file: File) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shot, setShot] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [guidance, setGuidance] = useState('Center your face in the guide.');
  const stop = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };
  useEffect(() => {
    if (!open) return;
    setRunning(false);
    setBusy(false);
    setError('');
    setShot(null);
    setGuidance('Center your face in the guide.');
    const hide = () => {
      if (document.hidden) {
        generation.current++;
        stop();
        setRunning(false);
        setBusy(false);
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      generation.current++;
      stop();
      document.removeEventListener('visibilitychange', hide);
    };
  }, [open]);
  useEffect(() => {
    if (running && video.current && stream.current) {
      video.current.srcObject = stream.current;
      void video.current.play().catch(() => {
        stop();
        setRunning(false);
        setError('Tap Start camera again to retry playback.');
      });
    }
  }, [running]);
  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    let timer: number;
    const inspect = async () => {
      const source = video.current;
      if (source && source.readyState >= 2 && source.videoWidth) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = Math.max(1, Math.round(320 * source.videoHeight / source.videoWidth));
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (context) {
            context.drawImage(source, 0, 0, canvas.width, canvas.height);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            let light = 0;
            for (let i = 0; i < pixels.length; i += 16)
              light += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
            light /= pixels.length / 16;
            const result = await detectCaptureFaces(canvas);
            if (!cancelled)
              setGuidance(
                light < 48
                  ? 'Find brighter, even light.'
                  : result.faceCount > 1
                    ? 'Keep only yourself in the frame.'
                    : result.faceCount === 0
                      ? 'Move your face into the guide.'
                      : result.positioned
                        ? 'Looking good · ready to capture.'
                        : 'Move closer and center your face.',
              );
          }
        } catch {
          if (!cancelled) setGuidance('Center your face in the guide. You can still capture.');
        }
      }
      if (!cancelled) timer = window.setTimeout(inspect, 1500);
    };
    timer = window.setTimeout(inspect, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [running]);
  useEffect(() => {
    if (!shot) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(shot);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [shot]);
  const start = async () => {
    if (busy) return;
    const attempt = ++generation.current;
    setBusy(true);
    setError('');
    stop();
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error('Use HTTPS or localhost on a camera-equipped device.');
      const next = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
      });
      if (generation.current !== attempt) {
        next.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = next;
      setShot(null);
      setRunning(true);
    } catch (cause) {
      if (generation.current === attempt)
        setError(
          cause instanceof Error && cause.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow it in browser settings, or upload from your library.'
            : cause instanceof Error
              ? cause.message
              : 'Camera unavailable. Try your photo library.',
        );
    } finally {
      if (generation.current === attempt) setBusy(false);
    }
  };
  const capture = async () => {
    const source = video.current;
    if (
      !source ||
      source.readyState < 2 ||
      !source.videoWidth ||
      !source.videoHeight ||
      busy
    ) {
      setError('Wait for the camera image, then capture again.');
      return;
    }
    const attempt = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = source.videoWidth;
      canvas.height = source.videoHeight;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Photo capture is unavailable.');
      // Only the live preview is mirrored. Save real camera pixels (including text).
      context.drawImage(source, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error('Could not prepare the photo. Try again.')),
          'image/jpeg',
          0.95,
        ),
      );
      if (attempt !== generation.current) return;
      setShot(
        new File([blob], `profile-camera-${Date.now()}.jpg`, {
          type: blob.type,
        }),
      );
      stop();
      setRunning(false);
    } catch (cause) {
      if (attempt === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not capture the photo.',
        );
    } finally {
      if (attempt === generation.current) setBusy(false);
    }
  };
  const close = () => {
    generation.current++;
    stop();
    setShot(null);
    onOpenChange(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="profile-camera-dialog"
        overlayClassName="profile-camera-overlay"
      >
        <div className="profile-camera-header">
          <button
            type="button"
            className="photo-crop-close"
            aria-label="Close profile camera"
            onClick={close}
          >
            <X size={20} />
          </button>
          <p className="photo-crop-kicker">PROFILE PHOTO · NOT VERIFICATION</p>
          <DialogTitle>
            {shot ? 'Keep this moment?' : 'Take your profile photo'}
          </DialogTitle>
          <DialogDescription>
            {shot
              ? 'Retake or use this photo. Auto frame and crop review come next.'
              : 'Use even light and leave a little room above your head.'}
          </DialogDescription>
        </div>
        <div className="profile-camera-body">
          <div className="profile-camera-stage">
            {shot && preview ? (
              <Image src={preview} alt="Captured portrait" fill unoptimized />
            ) : running ? (
              <>
                <video ref={video} autoPlay muted playsInline />
                <span className="profile-camera-guide" aria-hidden="true" />
              </>
            ) : (
              <Camera size={40} aria-hidden="true" />
            )}
          </div>
          {running && <p className="profile-camera-guidance" role="status">{guidance}</p>}
          <p className="profile-camera-note">
            No microphone. Nothing uploads until you choose Save photo in the
            framing editor. This does not verify your identity.
          </p>
          {error && (
            <p role="alert" className="photo-crop-error">
              {error}
            </p>
          )}
        </div>
        <div className="photo-crop-footer">
          <div className="photo-crop-actions">
            {shot ? (
              <>
                <button type="button" disabled={busy} onClick={start}>
                  Retake
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    if (shot) {
                      close();
                      onPhoto(shot);
                    }
                  }}
                >
                  Use photo
                </button>
              </>
            ) : (
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={running ? capture : start}
              >
                {busy
                  ? 'Preparing…'
                  : running
                    ? 'Capture photo'
                    : 'Start camera'}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
