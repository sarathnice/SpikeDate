'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Move, RotateCcw, X, ZoomIn } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

export type CroppedPhoto = {
  blob: Blob;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  lowResolution: boolean;
};

const OUTPUT_WIDTH = 1440;
const OUTPUT_HEIGHT = 1800;
const MIN_RECOMMENDED_WIDTH = 900;
const MIN_RECOMMENDED_HEIGHT = 1125;

async function cropPhoto(
  file: File,
  focusX: number,
  focusY: number,
  zoom: number,
): Promise<CroppedPhoto> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  const targetRatio = OUTPUT_WIDTH / OUTPUT_HEIGHT;
  let cropWidth = bitmap.width;
  let cropHeight = bitmap.height;
  if (bitmap.width / bitmap.height > targetRatio)
    cropWidth = bitmap.height * targetRatio;
  else cropHeight = bitmap.width / targetRatio;
  cropWidth /= zoom;
  cropHeight /= zoom;
  const sourceX = (bitmap.width - cropWidth) * (focusX / 100);
  const sourceY = (bitmap.height - cropHeight) * (focusY / 100);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;
  const context = canvas.getContext('2d', {
    alpha: false,
    colorSpace: 'srgb',
  });
  if (!context) {
    bitmap.close();
    throw new Error('Photo editing is unavailable on this device.');
  }
  context.fillStyle = '#0b0c12';
  context.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    bitmap,
    sourceX,
    sourceY,
    cropWidth,
    cropHeight,
    0,
    0,
    OUTPUT_WIDTH,
    OUTPUT_HEIGHT,
  );
  const originalWidth = bitmap.width;
  const originalHeight = bitmap.height;
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result
          ? resolve(result)
          : reject(new Error('This browser could not export the photo.')),
      'image/webp',
      0.93,
    );
  });
  return {
    blob,
    width: OUTPUT_WIDTH,
    height: OUTPUT_HEIGHT,
    originalWidth,
    originalHeight,
    lowResolution:
      originalWidth < MIN_RECOMMENDED_WIDTH ||
      originalHeight < MIN_RECOMMENDED_HEIGHT,
  };
}

export function PhotoCropper({
  file,
  open,
  onOpenChange,
  onConfirm,
}: {
  file: File | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (photo: CroppedPhoto) => Promise<void> | void;
}) {
  const [source, setSource] = useState('');
  const [focusX, setFocusX] = useState(50);
  const [focusY, setFocusY] = useState(36);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const drag = useRef<{
    x: number;
    y: number;
    focusX: number;
    focusY: number;
  } | null>(null);

  useEffect(() => {
    if (!file || !open) return;
    const url = URL.createObjectURL(file);
    setSource(url);
    setFocusX(50);
    setFocusY(36);
    setZoom(1);
    setError('');
    return () => URL.revokeObjectURL(url);
  }, [file, open]);

  const reset = () => {
    setFocusX(50);
    setFocusY(36);
    setZoom(1);
  };

  const confirm = async () => {
    if (!file || saving) return;
    setSaving(true);
    setError('');
    try {
      await onConfirm(await cropPhoto(file, focusX, focusY, zoom));
      onOpenChange(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The photo could not be prepared. Try another image.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent showCloseButton={false} className="photo-crop-dialog">
        <button
          type="button"
          className="photo-crop-close"
          aria-label="Close photo editor"
          onClick={() => onOpenChange(false)}
          disabled={saving}
        >
          <X size={20} />
        </button>
        <p className="photo-crop-kicker">PROFILE PHOTO · 4:5</p>
        <DialogTitle>Frame your best shot</DialogTitle>
        <DialogDescription>
          Drag to position your face. SpikeDate uses this focal framing to fill
          mobile screens edge to edge without stretching your photo.
        </DialogDescription>
        <div
          className="photo-crop-stage"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = {
              x: event.clientX,
              y: event.clientY,
              focusX,
              focusY,
            };
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            setFocusX(
              Math.max(
                0,
                Math.min(
                  100,
                  drag.current.focusX -
                    ((event.clientX - drag.current.x) / bounds.width) * 58,
                ),
              ),
            );
            setFocusY(
              Math.max(
                0,
                Math.min(
                  100,
                  drag.current.focusY -
                    ((event.clientY - drag.current.y) / bounds.height) * 58,
                ),
              ),
            );
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          {source && (
            // The temporary object URL is local-only and never leaves the device.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={source}
              alt="Crop preview"
              draggable={false}
              style={{
                objectPosition: `${focusX}% ${focusY}%`,
                transform: `scale(${zoom})`,
              }}
            />
          )}
          <div className="photo-crop-safe-zone" aria-hidden="true" />
          <span className="photo-crop-move-hint">
            <Move size={14} /> Drag to reposition
          </span>
        </div>
        <label className="photo-crop-zoom">
          <ZoomIn size={18} />
          <span>Zoom</span>
          <input
            type="range"
            min="1"
            max="2.2"
            step="0.02"
            value={zoom}
            aria-label="Photo zoom"
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        <div className="photo-crop-quality">
          <Check size={16} />
          <span>
            <strong>High-quality export</strong>
            <small>
              1440 × 1800 · high-detail WebP · camera orientation corrected
            </small>
          </span>
        </div>
        {error && (
          <p className="photo-crop-error" role="alert">
            {error}
          </p>
        )}
        <div className="photo-crop-actions">
          <button type="button" onClick={reset} disabled={saving}>
            <RotateCcw size={17} /> Reset
          </button>
          <button
            type="button"
            className="primary"
            onClick={confirm}
            disabled={saving}
          >
            {saving ? 'Preparing…' : 'Use photo'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
