'use client';

import { useEffect, useMemo } from 'react';
import { Amplify } from 'aws-amplify';
import { ThemeProvider } from '@aws-amplify/ui-react';
import { FaceLivenessDetector } from '@aws-amplify/ui-react-liveness';
import '@aws-amplify/ui-react/styles.css';

export function AwsFaceLiveness({
  sessionId,
  region,
  identityPoolId,
  onComplete,
  onCancel,
  onError,
}: {
  sessionId: string;
  region: string;
  identityPoolId: string;
  onComplete: () => Promise<void>;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const configuration = useMemo(
    () => ({
      Auth: {
        Cognito: {
          identityPoolId,
          allowGuestAccess: true,
        },
      },
    }),
    [identityPoolId],
  );

  useEffect(() => {
    Amplify.configure(configuration);
  }, [configuration]);

  return (
    <div className="aws-liveness-shell" aria-label="Live photo verification">
      <ThemeProvider colorMode="dark">
        <FaceLivenessDetector
          sessionId={sessionId}
          region={region}
          onAnalysisComplete={onComplete}
          onUserCancel={onCancel}
          onError={(error) =>
            onError(
              error.error?.message ||
                'The live video check could not finish. Start a new check and try again.',
            )
          }
        />
      </ThemeProvider>
    </div>
  );
}
