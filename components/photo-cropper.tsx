'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, LoaderCircle, Move, RotateCcw, X, ZoomIn } from 'lucide-react';
import { detectFramingFaces } from '@/lib/face-capture';
import { faceFramingFocus, type FramingFace } from '@/lib/face-framing';
import {
  applyGentleLight,
  photoCropGeometry,
  photoVariants,
} from '@/lib/photo-framing';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

export type CroppedPhoto = {
  blob: Blob;
  cardBlob: Blob;
  avatarBlob: Blob;
  originalBlob: Blob;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  focusX: number;
  focusY: number;
  zoom: number;
  lowResolution: boolean;
  qualityWarnings: string[];
};

const OUTPUT_WIDTH = 1440;
const OUTPUT_HEIGHT = 1800;

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result
          ? resolve(result)
          : reject(new Error('This browser could not export the photo.')),
      'image/webp',
      quality,
    );
  });
}

function drawFocusedCrop(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  focusX: number,
  focusY: number,
  zoom: number,
  brightness = 1,
) {
  const geometry = photoCropGeometry(
    bitmap.width,
    bitmap.height,
    width,
    height,
    focusX,
    focusY,
    zoom,
  );
  const { sourceX, sourceY, cropWidth, cropHeight } = geometry;
  const canvas = document.createElement('canvas');
  canvas.width = geometry.width;
  canvas.height = geometry.height;
  const context = canvas.getContext('2d', {
    alpha: false,
    colorSpace: 'srgb',
  });
  if (!context) throw new Error('Photo editing is unavailable on this device.');
  context.fillStyle = '#0b0c12';
  context.fillRect(0, 0, width, height);
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
    geometry.width,
    geometry.height,
  );
  if (brightness !== 1) {
    // Canvas filter is not consistently supported on mobile browsers.
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    applyGentleLight(image.data, brightness);
    context.putImageData(image, 0, 0);
  }
  return { canvas, context, geometry };
}

function assessPhoto(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const sampleWidth = 72;
  const sampleHeight = 90;
  const sample = document.createElement('canvas');
  sample.width = sampleWidth;
  sample.height = sampleHeight;
  const sampleContext = sample.getContext('2d', { willReadFrequently: true });
  if (!sampleContext) return [];
  sampleContext.drawImage(
    context.canvas,
    0,
    0,
    width,
    height,
    0,
    0,
    sampleWidth,
    sampleHeight,
  );
  const pixels = sampleContext.getImageData(
    0,
    0,
    sampleWidth,
    sampleHeight,
  ).data;
  let luminance = 0;
  let dark = 0;
  let bright = 0;
  const count = pixels.length / 4;
  for (let index = 0; index < pixels.length; index += 4) {
    const value =
      pixels[index] * 0.2126 +
      pixels[index + 1] * 0.7152 +
      pixels[index + 2] * 0.0722;
    luminance += value;
    if (value < 24) dark += 1;
    if (value > 242) bright += 1;
  }
  const average = luminance / count;
  const warnings: string[] = [];
  if (average < 42 || dark / count > 0.58)
    warnings.push(
      'This photo is quite dark. A brighter original may show you better.',
    );
  if (average > 224 || bright / count > 0.48)
    warnings.push('This photo has very bright areas with reduced detail.');
  return warnings;
}

async function cropPhoto(
  file: File,
  focusX: number,
  focusY: number,
  zoom: number,
  brightness: number,
): Promise<CroppedPhoto> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  try {
    const full = drawFocusedCrop(
      bitmap,
      OUTPUT_WIDTH,
      OUTPUT_HEIGHT,
      focusX,
      focusY,
      zoom,
      brightness,
    );
    const card = drawFocusedCrop(
      bitmap,
      photoVariants.card.width,
      photoVariants.card.height,
      focusX,
      focusY,
      zoom,
      brightness,
    );
    const avatar = drawFocusedCrop(
      bitmap,
      480,
      480,
      focusX,
      focusY,
      zoom,
      brightness,
    );
    const originalWidth = bitmap.width;
    const originalHeight = bitmap.height;
    const qualityWarnings = assessPhoto(
      full.context,
      full.canvas.width,
      full.canvas.height,
    );
    const [blob, cardBlob, avatarBlob] = await Promise.all([
      canvasBlob(full.canvas, 0.93),
      canvasBlob(card.canvas, 0.9),
      canvasBlob(avatar.canvas, 0.86),
    ]);
    return {
      blob,
      cardBlob,
      avatarBlob,
      originalBlob: file,
      width: full.canvas.width,
      height: full.canvas.height,
      originalWidth,
      originalHeight,
      focusX,
      focusY,
      zoom,
      lowResolution: full.geometry.lowResolution || card.geometry.lowResolution,
      qualityWarnings,
    };
  } finally {
    bitmap.close();
  }
}

async function detectPhotoFaces(bitmap: ImageBitmap) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Framing assistance is unavailable.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return detectFramingFaces(canvas);
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
  const [brightness, setBrightness] = useState(1);
  const [previewVariant, setPreviewVariant] =
    useState<keyof typeof photoVariants>('full');
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [qualityNotice, setQualityNotice] = useState('');
  const [faces, setFaces] = useState<FramingFace[]>([]);
  const [findingFaces, setFindingFaces] = useState(false);
  const [faceNotice, setFaceNotice] = useState('');
  const framingAttempt = useRef(0);
  const userAdjusted = useRef(false);
  const previewCanvas = useRef<HTMLCanvasElement>(null);
  const reviewCanvases = useRef<Record<string, HTMLCanvasElement | null>>({});
  const [saving, setSaving] = useState(false);
  const [savePhase, setSavePhase] = useState('');
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
    setBrightness(1);
    setPreviewVariant('full');
    setBitmap(null);
    setError('');
    setFaces([]);
    setFaceNotice('Preparing automatic framing…');
    setFindingFaces(false);
    userAdjusted.current = false;
    let cancelled = false;
    let decoded: ImageBitmap | null = null;
    void createImageBitmap(file, { imageOrientation: 'from-image' })
      .then((image) => {
        decoded = image;
        if (!cancelled) setBitmap(image);
        else image.close();
      })
      .catch(() => {
        if (!cancelled)
          setError(
            'This photo format could not be opened. Try a JPEG, PNG or WebP photo.',
          );
      });
    return () => {
      framingAttempt.current++;
      cancelled = true;
      decoded?.close();
      URL.revokeObjectURL(url);
    };
  }, [file, open]);

  const applyDetectedFaces = useCallback(
    (detected: FramingFace[], image: ImageBitmap, attempt: number) => {
      if (attempt !== framingAttempt.current) return;
      setFaces(detected);
      if (detected.length === 1) {
        if (userAdjusted.current) {
          setFaceNotice('Face found. Your manual crop was kept.');
          return;
        }
        const focus = faceFramingFocus(detected[0], image.width, image.height);
        setFocusX(focus.focusX);
        setFocusY(focus.focusY);
        setZoom(1);
        setFaceNotice('Face framed automatically. Review all three crops below.');
      } else {
        setFaceNotice(
          detected.length
            ? 'More than one face found. Tap your face below to frame it.'
            : 'No clear face found. Drag and zoom to frame your photo manually.',
        );
      }
    },
    [],
  );

  const runFaceDetection = useCallback(
    async (image: ImageBitmap) => {
      const attempt = ++framingAttempt.current;
      setFindingFaces(true);
      setFaceNotice('Finding a face on this device…');
      try {
        applyDetectedFaces(await detectPhotoFaces(image), image, attempt);
      } catch {
        if (attempt === framingAttempt.current)
          setFaceNotice('Auto frame is unavailable. Drag and zoom manually; saving still works.');
      } finally {
        if (attempt === framingAttempt.current) setFindingFaces(false);
      }
    },
    [applyDetectedFaces],
  );

  useEffect(() => {
    if (!bitmap || !open) return;
    void runFaceDetection(bitmap);
    return () => {
      framingAttempt.current++;
    };
  }, [bitmap, open, runFaceDetection]);

  useEffect(() => {
    if (!bitmap || !previewCanvas.current || !open) return;
    const variant = photoVariants[previewVariant];
    const { canvas, context, geometry } = drawFocusedCrop(
      bitmap,
      variant.width,
      variant.height,
      focusX,
      focusY,
      zoom,
      brightness,
    );
    const preview = previewCanvas.current;
    preview.width = canvas.width;
    preview.height = canvas.height;
    preview.getContext('2d')?.drawImage(canvas, 0, 0);
    const warnings = assessPhoto(context, canvas.width, canvas.height);
    setQualityNotice(
      [
        geometry.lowResolution
          ? 'Limited source detail at this framing. Zoom out or use a larger original; we won’t artificially upscale it.'
          : '',
        ...warnings,
      ]
        .filter(Boolean)
        .join(' '),
    );
  }, [bitmap, open, focusX, focusY, zoom, brightness, previewVariant]);

  useEffect(() => {
    if (!bitmap || !open) return;
    for (const [key, variant] of Object.entries(photoVariants)) {
      const preview = reviewCanvases.current[key];
      if (!preview) continue;
      const scale = Math.min(1, 220 / Math.max(variant.width, variant.height));
      const { canvas } = drawFocusedCrop(
        bitmap,
        Math.round(variant.width * scale),
        Math.round(variant.height * scale),
        focusX,
        focusY,
        zoom,
        brightness,
      );
      preview.width = canvas.width;
      preview.height = canvas.height;
      preview.getContext('2d')?.drawImage(canvas, 0, 0);
    }
  }, [bitmap, open, focusX, focusY, zoom, brightness]);

  const reset = () => {
    userAdjusted.current = true;
    setFocusX(50);
    setFocusY(36);
    setZoom(1);
    setBrightness(1);
  };

  const chooseFace = (face: FramingFace) => {
    if (!bitmap) return;
    userAdjusted.current = true;
    const focus = faceFramingFocus(face, bitmap.width, bitmap.height);
    setFocusX(focus.focusX);
    setFocusY(focus.focusY);
    setZoom(1);
    setFaceNotice(
      'Face framing suggested. Check all three crops and adjust if needed.',
    );
  };
  const findFaces = async () => {
    if (!bitmap || findingFaces || saving) return;
    userAdjusted.current = false;
    await runFaceDetection(bitmap);
  };

  const confirm = async () => {
    if (!file || saving) return;
    setSaving(true);
    setSavePhase('Preparing photo…');
    setError('');
    try {
      const photo = await cropPhoto(file, focusX, focusY, zoom, brightness);
      setSavePhase('Uploading photo…');
      await onConfirm(photo);
      onOpenChange(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The photo could not be prepared. Try another image.',
      );
    } finally {
      setSaving(false);
      setSavePhase('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent
        showCloseButton={false}
        className="photo-crop-dialog"
        overlayClassName="photo-crop-overlay"
        aria-busy={saving}
      >
        <div className="photo-crop-header">
          <button
            type="button"
            className="photo-crop-close"
            aria-label="Close photo editor"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            <X size={20} />
          </button>
          <p className="photo-crop-kicker">
            PROFILE PHOTO · {photoVariants[previewVariant].label}
          </p>
          <DialogTitle>Frame your best shot</DialogTitle>
          <DialogDescription>
            We suggest a face crop on your device. Review the three saved views, then adjust if needed.
          </DialogDescription>
        </div>
        <div className="photo-crop-body">
          <div
            className="photo-crop-stage"
            style={{
              aspectRatio: `${photoVariants[previewVariant].width}/${photoVariants[previewVariant].height}`,
            }}
            onPointerDown={(event) => {
              if (saving) return;
              userAdjusted.current = true;
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
            {bitmap && (
              <canvas
                ref={previewCanvas}
                className="photo-crop-exact-preview"
                aria-label="Exact saved crop preview"
              />
            )}
            <div className="photo-crop-safe-zone" aria-hidden="true" />
            <span className="photo-crop-move-hint">
              <Move size={14} /> Drag to reposition
            </span>
          </div>
          <p className="photo-crop-review-title">Review your three crops</p>
          <div className="photo-preview-variants" aria-label="Preview saved framing">
            {Object.entries(photoVariants).map(([key, variant]) => (
              <button
                type="button"
                key={key}
                aria-pressed={previewVariant === key}
                disabled={saving}
                onClick={() =>
                  setPreviewVariant(key as keyof typeof photoVariants)
                }
              >
                <canvas
                  ref={(element) => { reviewCanvases.current[key] = element; }}
                  aria-hidden="true"
                  style={{ aspectRatio: `${variant.width}/${variant.height}` }}
                />
                <span>{variant.label}</span>
              </button>
            ))}
          </div>
          <div className="photo-face-assistance">
            <button
              type="button"
              disabled={!bitmap || saving || findingFaces}
              onClick={findFaces}
            >
              {findingFaces ? 'Auto framing…' : 'Find faces for framing'}
            </button>
            <small>
              Auto framing runs on this device only. It does not verify identity or upload a face scan.
            </small>
            {faceNotice && <p role="status">{faceNotice}</p>}
            {faces.length > 1 && bitmap && (
              <div
                className="photo-face-picker"
                style={{ aspectRatio: `${bitmap.width}/${bitmap.height}` }}
              >
                <Image
                  src={source}
                  alt="Choose your face in the original"
                  width={bitmap.width}
                  height={bitmap.height}
                  unoptimized
                />
                {faces.map((face, index) => (
                  <button
                    type="button"
                    key={index}
                    disabled={saving}
                    aria-label={`Frame face ${index + 1}`}
                    onClick={() => chooseFace(face)}
                    style={{
                      left: `${face.x * 100}%`,
                      top: `${face.y * 100}%`,
                      width: `${face.width * 100}%`,
                      height: `${face.height * 100}%`,
                    }}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            )}
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
              disabled={saving}
              aria-label="Photo zoom"
              onChange={(event) => {
                userAdjusted.current = true;
                setZoom(Number(event.target.value));
              }}
            />
          </label>
          <label className="photo-light-control">
            Photo look
            <select
              aria-label="Photo look"
              value={brightness}
              disabled={saving}
              onChange={(event) => setBrightness(Number(event.target.value))}
            >
              <option value={1}>Natural · Recommended</option>
              <option value={1.06}>Gentle light · +6% brightness</option>
            </select>
          </label>
          {qualityNotice && (
            <p className="photo-quality-notice" role="status">
              {qualityNotice}
            </p>
          )}
          <details className="photo-quality-details">
            <summary>Quality &amp; crop details</summary>
            <div className="photo-crop-quality">
              <Check size={16} />
              <span>
                <strong>High-quality export</strong>
                <small>
                  Original preserved · full, discovery and avatar crops
                  generated
                </small>
              </span>
            </div>
          </details>
        </div>
        <div className="photo-crop-footer">
          {error && (
            <p className="photo-crop-error" role="alert">
              {error}
            </p>
          )}
          <p className="photo-crop-status" role="status" aria-live="polite">
            {saving
              ? savePhase
              : 'Original preserved · natural look by default.'}
          </p>
          <div className="photo-crop-actions">
            <button type="button" onClick={reset} disabled={saving}>
              <RotateCcw size={17} /> Reset
            </button>
            <button
              type="button"
              className="primary"
              onClick={confirm}
              disabled={saving || !bitmap}
              aria-label="Save photo"
            >
              {saving && (
                <LoaderCircle
                  size={18}
                  className="photo-crop-spinner"
                  aria-hidden="true"
                />
              )}
              {saving ? savePhase : 'Save photo'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
