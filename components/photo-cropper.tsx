'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, LoaderCircle, Move, RotateCcw, X, ZoomIn } from 'lucide-react';
import { detectFramingFaces } from '@/lib/face-capture';
import { faceFramingFocus, type FramingFace } from '@/lib/face-framing';
import {
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
type PhotoLook = 'cinematic' | 'bright' | 'original';
type PhotoRecipe = {
  brightness: number;
  contrast: number;
  saturation: number;
  label: string;
};

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
  recipe: PhotoRecipe,
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
  if (
    recipe.brightness !== 1 ||
    recipe.contrast !== 1 ||
    recipe.saturation !== 1
  ) {
    // Pixel processing is deterministic across mobile browsers and is baked
    // only into the prepared variants. The uploaded original stays untouched.
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    applyPhotoRecipe(image.data, recipe);
    context.putImageData(image, 0, 0);
  }
  return { canvas, context, geometry };
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function applyPhotoRecipe(pixels: Uint8ClampedArray, recipe: PhotoRecipe) {
  for (let index = 0; index < pixels.length; index += 4) {
    let red = pixels[index] * recipe.brightness;
    let green = pixels[index + 1] * recipe.brightness;
    let blue = pixels[index + 2] * recipe.brightness;
    red = (red - 128) * recipe.contrast + 128;
    green = (green - 128) * recipe.contrast + 128;
    blue = (blue - 128) * recipe.contrast + 128;
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    pixels[index] = clampChannel(
      luminance + (red - luminance) * recipe.saturation,
    );
    pixels[index + 1] = clampChannel(
      luminance + (green - luminance) * recipe.saturation,
    );
    pixels[index + 2] = clampChannel(
      luminance + (blue - luminance) * recipe.saturation,
    );
  }
}

function neutralRecipe(): PhotoRecipe {
  return {
    brightness: 1,
    contrast: 1,
    saturation: 1,
    label: 'Original',
  };
}

function analyzeTone(
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
  if (!sampleContext)
    return { average: 128, darkRatio: 0, brightRatio: 0 };
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
  return {
    average: luminance / count,
    darkRatio: dark / count,
    brightRatio: bright / count,
  };
}

function automaticRecipe(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  look: PhotoLook,
): PhotoRecipe {
  if (look === 'original') return neutralRecipe();
  const tone = analyzeTone(context, width, height);
  if (look === 'bright')
    return {
      brightness: tone.brightRatio > 0.38 ? 1.04 : 1.1,
      contrast: tone.brightRatio > 0.38 ? 0.99 : 1.03,
      saturation: 1.04,
      label: 'Bright Social',
    };
  const brightness =
    tone.average < 72 || tone.darkRatio > 0.48
      ? 1.1
      : tone.average < 112
        ? 1.06
        : tone.average > 205 || tone.brightRatio > 0.4
          ? 0.97
          : 1.02;
  return {
    brightness,
    contrast:
      tone.darkRatio > 0.48 || tone.brightRatio > 0.4 ? 0.99 : 1.035,
    saturation: tone.brightRatio > 0.4 ? 1.01 : 1.025,
    label: 'Natural Cinematic',
  };
}

function resolveRecipe(
  bitmap: ImageBitmap,
  focusX: number,
  focusY: number,
  zoom: number,
  look: PhotoLook,
) {
  const sample = drawFocusedCrop(
    bitmap,
    288,
    360,
    focusX,
    focusY,
    zoom,
    neutralRecipe(),
  );
  return automaticRecipe(sample.context, sample.canvas.width, sample.canvas.height, look);
}

function assessPhoto(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const { average, darkRatio, brightRatio } = analyzeTone(context, width, height);
  const warnings: string[] = [];
  if (average < 42 || darkRatio > 0.58)
    warnings.push(
      'This photo is quite dark. A brighter original may show you better.',
    );
  if (average > 224 || brightRatio > 0.48)
    warnings.push('This photo has very bright areas with reduced detail.');
  return warnings;
}

async function cropPhoto(
  file: File,
  focusX: number,
  focusY: number,
  zoom: number,
  look: PhotoLook,
): Promise<CroppedPhoto> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  try {
    const recipe = resolveRecipe(bitmap, focusX, focusY, zoom, look);
    const full = drawFocusedCrop(
      bitmap,
      OUTPUT_WIDTH,
      OUTPUT_HEIGHT,
      focusX,
      focusY,
      zoom,
      recipe,
    );
    const card = drawFocusedCrop(
      bitmap,
      photoVariants.card.width,
      photoVariants.card.height,
      focusX,
      focusY,
      zoom,
      recipe,
    );
    const avatar = drawFocusedCrop(
      bitmap,
      480,
      480,
      focusX,
      focusY,
      zoom,
      recipe,
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
  const [photoLook, setPhotoLook] = useState<PhotoLook>('cinematic');
  const [previewVariant, setPreviewVariant] =
    useState<keyof typeof photoVariants>('full');
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [qualityNotice, setQualityNotice] = useState('');
  const [lowResolutionPreview, setLowResolutionPreview] = useState(false);
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
    setPhotoLook('cinematic');
    setPreviewVariant('full');
    setBitmap(null);
    setLowResolutionPreview(false);
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
    const recipe = resolveRecipe(bitmap, focusX, focusY, zoom, photoLook);
    const { canvas, context, geometry } = drawFocusedCrop(
      bitmap,
      variant.width,
      variant.height,
      focusX,
      focusY,
      zoom,
      recipe,
    );
    const preview = previewCanvas.current;
    preview.width = canvas.width;
    preview.height = canvas.height;
    preview.getContext('2d')?.drawImage(canvas, 0, 0);
    const warnings = assessPhoto(context, canvas.width, canvas.height);
    setLowResolutionPreview(geometry.lowResolution);
    setQualityNotice(
      [
        geometry.lowResolution
          ? 'Low-resolution source. SpikeDate will apply Cloud Enhance after upload and preserve your original. A larger original will still look best.'
          : '',
        ...warnings,
      ]
        .filter(Boolean)
        .join(' '),
    );
  }, [bitmap, open, focusX, focusY, zoom, photoLook, previewVariant]);

  useEffect(() => {
    if (!bitmap || !open) return;
    const recipe = resolveRecipe(bitmap, focusX, focusY, zoom, photoLook);
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
        recipe,
      );
      preview.width = canvas.width;
      preview.height = canvas.height;
      preview.getContext('2d')?.drawImage(canvas, 0, 0);
    }
  }, [bitmap, open, focusX, focusY, zoom, photoLook]);

  const reset = () => {
    userAdjusted.current = true;
    setFocusX(50);
    setFocusY(36);
    setZoom(1);
    setPhotoLook('cinematic');
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
      const photo = await cropPhoto(file, focusX, focusY, zoom, photoLook);
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
            GUIDED STUDIO · AUTO FRAME · {photoVariants[previewVariant].label}
          </p>
          <DialogTitle>Review your photo</DialogTitle>
          <DialogDescription>
            We centered your face automatically. Review how it appears across
            SpikeDate, then adjust only if needed.
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
          <p className="photo-crop-review-title">Preview every placement</p>
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
              {findingFaces ? 'Auto framing…' : 'Run auto frame again'}
            </button>
            <small>
              Face-aware framing runs on this device only. It does not verify
              identity or upload a face scan.
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
              value={photoLook}
              disabled={saving}
              onChange={(event) =>
                setPhotoLook(event.target.value as PhotoLook)
              }
            >
              <option value="cinematic">Natural Cinematic · Recommended</option>
              <option value="bright">Bright Social</option>
              <option value="original">Original</option>
            </select>
            <small>
              Natural Cinematic adapts light and color to this photo. No skin
              smoothing or face reshaping.
            </small>
          </label>
          {qualityNotice && (
            <p className="photo-quality-notice" role="status">
              {qualityNotice}
            </p>
          )}
          <details className="photo-quality-details">
            <summary>Quality &amp; crop details</summary>
            <div
              className={`photo-crop-quality${lowResolutionPreview ? ' is-enhanced' : ''}`}
            >
              <Check size={16} />
              <span>
                <strong>
                  {lowResolutionPreview
                    ? 'Cloud Enhance will be applied'
                    : 'High-quality export'}
                </strong>
                <small>
                  {lowResolutionPreview
                    ? 'AI upscale · natural detail · original preserved'
                    : 'Original preserved · Home, Galaxy, full-profile and avatar placements prepared'}
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
