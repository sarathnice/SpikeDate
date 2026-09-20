'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import NextImage from 'next/image';
import { Camera, ImagePlus, Mic, Square, X } from 'lucide-react';

type Kind = 'photo' | 'voice';
type Mode = 'idle' | 'photo-menu' | 'camera' | 'recording' | 'review-photo' | 'review-voice' | 'sending';

async function jpegFromImage(file: Blob) {
  const url = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The photo could not be prepared.')), 'image/jpeg', 0.86),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ChatMediaActions({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (file: Blob, kind: Kind, durationMs?: number, clientId?: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>('idle');
  const [file, setFile] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState('');
  const [portalReady, setPortalReady] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraVideo = useRef<HTMLVideoElement>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const microphoneStream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const discardRecording = useRef(false);
  const recordStarted = useRef(0);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadId = useRef('');
  useEffect(() => setPortalReady(true), []);

  const stopTracks = () => {
    cameraStream.current?.getTracks().forEach((track) => track.stop());
    microphoneStream.current?.getTracks().forEach((track) => track.stop());
    cameraStream.current = null;
    microphoneStream.current = null;
    if (recordTimer.current) clearInterval(recordTimer.current);
    recordTimer.current = null;
  };
  const close = () => {
    discardRecording.current = true;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stopTracks();
    setMode('idle');
    setFile(null);
    uploadId.current = '';
    setError('');
  };
  useEffect(() => () => {
    discardRecording.current = true;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    cameraStream.current?.getTracks().forEach((track) => track.stop());
    microphoneStream.current?.getTracks().forEach((track) => track.stop());
    if (recordTimer.current) clearInterval(recordTimer.current);
  }, []);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => { URL.revokeObjectURL(url); setPreviewUrl(''); };
  }, [file]);
  useEffect(() => {
    if (mode === 'camera' && cameraVideo.current && cameraStream.current) {
      cameraVideo.current.srcObject = cameraStream.current;
      void cameraVideo.current.play().catch(() => {});
    }
  }, [mode]);

  const startCamera = async () => {
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is unavailable here. Choose a photo instead.');
      cameraStream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      setMode('camera');
    } catch {
      setError('Camera unavailable. Choose a photo from your device instead.');
      setMode('photo-menu');
    }
  };
  const capture = async () => {
    const video = cameraVideo.current;
    if (!video?.videoWidth || !video.videoHeight) { setError('Camera is still starting. Try again.'); return; }
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photo = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!photo) { setError('Could not capture a photo. Try again.'); return; }
    stopTracks();
    uploadId.current = crypto.randomUUID();
    setFile(photo);
    setMode('review-photo');
  };
  const pickPhoto = async (chosen?: File) => {
    if (!chosen) return;
    setError('');
    try {
      const photo = await jpegFromImage(chosen);
      if (photo.size > 6 * 1024 * 1024) throw new Error('Photo is too large.');
      uploadId.current = crypto.randomUUID();
      setFile(photo);
      setMode('review-photo');
    } catch {
      setError('This photo could not be prepared. Try JPEG, PNG, or WebP.');
      setMode('photo-menu');
    }
  };
  const startRecording = async () => {
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Microphone unavailable.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      microphoneStream.current = stream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((value) => MediaRecorder.isTypeSupported(value));
      if (!mimeType) throw new Error('Voice recording is not supported on this device.');
      const chunks: Blob[] = [];
      discardRecording.current = false;
      const active = new MediaRecorder(stream, { mimeType });
      recorder.current = active;
      active.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      active.onstop = () => {
        stopTracks();
        if (discardRecording.current) return;
        const duration = Math.min(60_000, Date.now() - recordStarted.current);
        const note = new Blob(chunks, { type: active.mimeType.split(';')[0] });
        if (!note.size || duration < 300) { setError('Record for at least one second.'); setMode('idle'); return; }
        setDurationMs(duration);
        uploadId.current = crypto.randomUUID();
        setFile(note);
        setMode('review-voice');
      };
      recordStarted.current = Date.now();
      active.start();
      setElapsed(0);
      setMode('recording');
      recordTimer.current = setInterval(() => {
        const seconds = Math.floor((Date.now() - recordStarted.current) / 1000);
        setElapsed(seconds);
        if (seconds >= 60 && active.state === 'recording') active.stop();
      }, 500);
    } catch {
      stopTracks();
      setError('Microphone unavailable. Check permissions and try again.');
      setMode('idle');
    }
  };
  const send = async () => {
    if (!file) return;
    const kind: Kind = mode === 'review-voice' ? 'voice' : 'photo';
    setMode('sending');
    setError('');
    try { await onSend(file, kind, kind === 'voice' ? durationMs : undefined, uploadId.current); close(); }
    catch { setError('Could not send. Your photo or voice note is still here; try again.'); setMode(kind === 'voice' ? 'review-voice' : 'review-photo'); }
  };

  return (
    <div className="chat-media-actions">
      <button type="button" className="chat-media-button" aria-label="Open camera or choose a photo" disabled={disabled || mode !== 'idle'} onClick={() => { setError(''); setMode('photo-menu'); }}><Camera size={20} /></button>
      <button type="button" className="chat-media-button" aria-label="Record a voice message" disabled={disabled || mode !== 'idle'} onClick={() => void startRecording()}><Mic size={20} /></button>
      {portalReady && createPortal(<input ref={fileInput} className="chat-media-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" aria-label="Choose a chat photo" hidden onChange={(event) => { void pickPhoto(event.target.files?.[0]); event.target.value = ''; }} />, document.body)}
      {mode !== 'idle' && <div className="chat-media-panel" role="dialog" aria-label={mode === 'recording' || mode === 'review-voice' ? 'Voice message' : 'Photo message'}>
        <div className="chat-media-panel-head"><strong>{mode === 'photo-menu' ? 'Share a photo' : mode === 'camera' ? 'Take a photo' : mode === 'recording' ? 'Recording voice note' : mode === 'review-voice' ? 'Review voice note' : mode === 'sending' ? 'Sending…' : 'Review photo'}</strong><button type="button" aria-label="Close media composer" disabled={mode === 'sending'} onClick={close}><X size={18} /></button></div>
        {mode === 'photo-menu' && <div className="chat-media-choices"><button type="button" onClick={() => void startCamera()}><Camera size={18} /> Open camera</button><button type="button" onClick={() => fileInput.current?.click()}><ImagePlus size={18} /> Choose from library</button></div>}
        {mode === 'camera' && <><video ref={cameraVideo} className="chat-camera-preview" autoPlay playsInline muted aria-label="Camera preview" /><button className="chat-media-primary" type="button" onClick={() => void capture()}>Capture photo</button></>}
        {mode === 'recording' && <div className="chat-recording"><span className="chat-recording-dot" /> {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} / 1:00 <button type="button" onClick={() => recorder.current?.stop()}><Square size={14} /> Stop</button></div>}
        {mode === 'review-photo' && previewUrl && <NextImage className="chat-photo-preview" src={previewUrl} alt="Your selection" width={500} height={400} unoptimized />}
        {/* Private voice notes have no generated transcript or caption track. */}
        {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
        {mode === 'review-voice' && previewUrl && <audio className="chat-voice-preview" controls src={previewUrl} aria-label="Preview voice note" />}
        {(mode === 'review-photo' || mode === 'review-voice') && <div className="chat-media-review-actions"><button type="button" onClick={close}>Delete</button><button type="button" className="chat-media-primary" onClick={() => void send()}>Send {mode === 'review-voice' ? 'voice note' : 'photo'}</button></div>}
        {error && <p className="chat-media-error" role="alert">{error}</p>}
      </div>}
      {mode === 'idle' && error && <div className="chat-media-panel" role="alert"><div className="chat-media-panel-head"><p className="chat-media-error">{error}</p><button type="button" aria-label="Dismiss media error" onClick={() => setError('')}><X size={18} /></button></div></div>}
    </div>
  );
}
