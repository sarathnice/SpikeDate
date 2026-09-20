# Face detection assets

MediaPipe Tasks Vision 0.10.32, Apache-2.0. Runtime WASM is copied from the pinned npm dependency by `scripts/prepare-face-assets.mjs` before dev/build and is served from this app, not a third-party CDN.

Model: Google MediaPipe BlazeFace short-range, float16, version 1.
Source: https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite
SHA-256: b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f
Project/license: https://github.com/google-ai-edge/mediapipe (Apache-2.0).
The accompanying `LICENSE` contains the upstream license text.

This model locates faces; it does not recognize identities, compare profile photos, establish age, or detect presentation attacks. Camera frames are processed only in the browser and are not uploaded or persisted.
