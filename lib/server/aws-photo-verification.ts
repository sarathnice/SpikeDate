import { env } from 'cloudflare:workers';
import {
  CompareFacesCommand,
  CreateFaceLivenessSessionCommand,
  GetFaceLivenessSessionResultsCommand,
  RekognitionClient,
} from '@aws-sdk/client-rekognition';
import type { D1DatabaseLike } from '@/lib/server/db';
import {
  decidePhotoVerification,
  type VerificationPhotoMatch,
} from '@/lib/photo-verification-decision';

type AwsVerificationEnvironment = {
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_SESSION_TOKEN?: string;
  SPIKEDATE_AWS_REGION?: string;
  SPIKEDATE_AWS_COGNITO_IDENTITY_POOL_ID?: string;
  SPIKEDATE_LIVENESS_THRESHOLD?: string;
  SPIKEDATE_FACE_MATCH_THRESHOLD?: string;
  MEDIA?: {
    get: (key: string) => Promise<{
      arrayBuffer: () => Promise<ArrayBuffer>;
    } | null>;
  };
};

export type AwsPhotoVerificationResult = {
  status: 'photo_verified' | 'needs_review' | 'needs_retry';
  reason:
    | 'verified'
    | 'liveness_incomplete'
    | 'liveness_failed'
    | 'no_profile_photo'
    | 'primary_photo_mismatch'
    | 'additional_photo_review';
  livenessConfidenceBps: number;
  matches: VerificationPhotoMatch[];
};

function runtimeEnvironment() {
  return env as unknown as AwsVerificationEnvironment;
}

function threshold(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
    ? parsed
    : fallback;
}

export function awsPhotoVerificationConfiguration() {
  const runtime = runtimeEnvironment();
  const region = runtime.SPIKEDATE_AWS_REGION?.trim() || '';
  const identityPoolId =
    runtime.SPIKEDATE_AWS_COGNITO_IDENTITY_POOL_ID?.trim() || '';
  const configured = Boolean(
    region &&
    identityPoolId &&
    runtime.AWS_ACCESS_KEY_ID &&
    runtime.AWS_SECRET_ACCESS_KEY &&
    runtime.MEDIA,
  );
  return { configured, region, identityPoolId };
}

function rekognitionClient() {
  const runtime = runtimeEnvironment();
  const configuration = awsPhotoVerificationConfiguration();
  if (!configuration.configured)
    throw new Response(
      'AWS photo verification is not configured for this environment.',
      { status: 503 },
    );
  return new RekognitionClient({
    region: configuration.region,
    credentials: {
      accessKeyId: runtime.AWS_ACCESS_KEY_ID!,
      secretAccessKey: runtime.AWS_SECRET_ACCESS_KEY!,
      ...(runtime.AWS_SESSION_TOKEN
        ? { sessionToken: runtime.AWS_SESSION_TOKEN }
        : {}),
    },
  });
}

export async function createAwsLivenessSession(requestId: string) {
  const client = rekognitionClient();
  try {
    const result = await client.send(
      new CreateFaceLivenessSessionCommand({
        ClientRequestToken: requestId,
        Settings: {
          AuditImagesLimit: 2,
          ChallengePreferences: [{ Type: 'FaceMovementAndLightChallenge' }],
        },
      }),
    );
    if (!result.SessionId)
      throw new Error('AWS did not return a liveness session ID.');
    return result.SessionId;
  } finally {
    client.destroy();
  }
}

async function approvedPhotos(db: D1DatabaseLike, userId: string) {
  const result = await db
    .prepare(
      'SELECT id, object_key, original_object_key, position FROM profile_media ' +
        "WHERE user_id = ? AND type = 'photo' AND moderation_status != 'rejected' " +
        'ORDER BY position ASC LIMIT 6',
    )
    .bind(userId)
    .all<{
      id: string;
      object_key: string;
      original_object_key: string | null;
      position: number;
    }>();
  return result.results;
}

export async function evaluateAwsPhotoVerification(
  db: D1DatabaseLike,
  userId: string,
  sessionId: string,
): Promise<AwsPhotoVerificationResult> {
  const runtime = runtimeEnvironment();
  const client = rekognitionClient();
  try {
    let liveness = await client.send(
      new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId }),
    );
    // The Amplify UI can finish its event stream a fraction before the results
    // endpoint becomes consistent. Do not turn that short IN_PROGRESS window
    // into a failed verification that forces another video capture.
    for (
      let attempt = 0;
      attempt < 6 &&
      (liveness.Status === 'CREATED' || liveness.Status === 'IN_PROGRESS');
      attempt += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 750));
      liveness = await client.send(
        new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId }),
      );
    }
    if (
      (liveness.Status === 'CREATED' || liveness.Status === 'IN_PROGRESS') &&
      !liveness.ReferenceImage?.Bytes
    )
      return {
        status: 'needs_retry',
        reason: 'liveness_incomplete',
        livenessConfidenceBps: Math.round((liveness.Confidence ?? 0) * 100),
        matches: [],
      };
    if (liveness.Status !== 'SUCCEEDED' || !liveness.ReferenceImage?.Bytes)
      return {
        status: 'needs_retry',
        reason: 'liveness_failed',
        livenessConfidenceBps: Math.round((liveness.Confidence ?? 0) * 100),
        matches: [],
      };

    const livenessThreshold = threshold(
      runtime.SPIKEDATE_LIVENESS_THRESHOLD,
      90,
    );
    const livenessConfidence = liveness.Confidence ?? 0;
    if (livenessConfidence < livenessThreshold)
      return {
        status: 'needs_retry',
        reason: 'liveness_failed',
        livenessConfidenceBps: Math.round(livenessConfidence * 100),
        matches: [],
      };

    const photos = await approvedPhotos(db, userId);
    if (!photos.length)
      return {
        status: 'needs_retry',
        reason: 'no_profile_photo',
        livenessConfidenceBps: Math.round(livenessConfidence * 100),
        matches: [],
      };

    const faceThreshold = threshold(runtime.SPIKEDATE_FACE_MATCH_THRESHOLD, 90);
    const matches: VerificationPhotoMatch[] = [];
    for (const photo of photos) {
      // Compare the same optimized full image that members see. The original
      // upload may exceed Rekognition's byte limit and can have a different crop.
      const object = await runtime.MEDIA!.get(photo.object_key);
      if (!object) {
        matches.push({
          mediaId: photo.id,
          position: photo.position,
          similarityBps: null,
          decision: 'not_comparable',
        });
        continue;
      }
      try {
        const comparison = await client.send(
          new CompareFacesCommand({
            SourceImage: { Bytes: liveness.ReferenceImage.Bytes },
            TargetImage: { Bytes: new Uint8Array(await object.arrayBuffer()) },
            SimilarityThreshold: faceThreshold,
            QualityFilter: 'AUTO',
          }),
        );
        const bestSimilarity = Math.max(
          0,
          ...(comparison.FaceMatches ?? []).map(
            (match) => match.Similarity ?? 0,
          ),
        );
        matches.push({
          mediaId: photo.id,
          position: photo.position,
          similarityBps: Math.round(bestSimilarity * 100),
          decision: bestSimilarity >= faceThreshold ? 'matched' : 'mismatched',
        });
      } catch (error) {
        if (
          error instanceof Error &&
          (error.name === 'InvalidParameterException' ||
            error.name === 'ImageTooLargeException')
        ) {
          matches.push({
            mediaId: photo.id,
            position: photo.position,
            similarityBps: null,
            decision: 'not_comparable',
          });
          continue;
        }
        throw error;
      }
    }

    const status = decidePhotoVerification(matches);
    return {
      status,
      reason:
        status === 'photo_verified'
          ? 'verified'
          : status === 'needs_review'
            ? 'additional_photo_review'
            : 'primary_photo_mismatch',
      livenessConfidenceBps: Math.round(livenessConfidence * 100),
      matches,
    };
  } finally {
    client.destroy();
  }
}
