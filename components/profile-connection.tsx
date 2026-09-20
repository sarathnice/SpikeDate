'use client';
import { useEffect, useState } from 'react';
import {
  Clock3,
  Heart,
  MessageCircle,
  Languages,
  HandHeart,
} from 'lucide-react';
import {
  connectionOptions,
  type ProfileConnection,
} from '@/lib/profile-connection';

export function ProfileConnectionFields({
  value,
  onChange,
  quick = false,
}: {
  value: ProfileConnection;
  onChange: (value: Partial<ProfileConnection>) => void;
  quick?: boolean;
}) {
  const languageValue = value.languages.join(', ');
  const [languageText, setLanguageText] = useState(languageValue);
  useEffect(() => {
    setLanguageText(languageValue);
  }, [languageValue]);
  const select = (
    key: 'relationshipStyle' | 'datingPace' | 'communicationPreference',
    label: string,
  ) => (
    <label key={key}>
      {label}
      <select
        aria-label={label}
        value={value[key]}
        onChange={(e) => onChange({ [key]: e.target.value })}
      >
        <option value="">Not shared</option>
        {connectionOptions[key].map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="connection-fields">
      {select('relationshipStyle', 'Relationship style')}
      <fieldset>
        <legend>Three personal values · Optional</legend>
        <div className="connection-choices">
          {connectionOptions.values.map((option) => (
            <button
              type="button"
              key={option}
              aria-pressed={value.values.includes(option)}
              disabled={
                !value.values.includes(option) && value.values.length >= 3
              }
              onClick={() =>
                onChange({
                  values: value.values.includes(option)
                    ? value.values.filter((x) => x !== option)
                    : [...value.values, option],
                })
              }
            >
              {option}
            </button>
          ))}
        </div>
        <small>
          Pick up to three. These describe you, not requirements for others.
        </small>
      </fieldset>
      {!quick && (
        <>
          {select('datingPace', 'Dating pace')}
          {select('communicationPreference', 'Communication preference')}
          <fieldset>
            <legend>Everyday rhythm · Optional</legend>
            <div className="connection-choices">
              {connectionOptions.rhythm.map((option) => (
                <button
                  type="button"
                  key={option}
                  aria-pressed={value.rhythm.includes(option)}
                  onClick={() => {
                    const group =
                      option === 'Early bird' || option === 'Night owl'
                        ? ['Early bird', 'Night owl']
                        : [
                            'Quiet weekends',
                            'Social weekends',
                            'A mix of both',
                          ];
                    onChange({
                      rhythm: value.rhythm.includes(option)
                        ? value.rhythm.filter((x) => x !== option)
                        : [
                            ...value.rhythm.filter((x) => !group.includes(x)),
                            option,
                          ],
                    });
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            Languages spoken
            <input
              aria-label="Languages spoken"
              value={languageText}
              placeholder="English, Spanish"
              onChange={(e) => setLanguageText(e.target.value)}
              onBlur={(e) =>
                onChange({
                  languages: [
                    ...new Set(
                      e.target.value
                        .split(',')
                        .map((x) => x.trim())
                        .filter(Boolean),
                    ),
                  ].slice(0, 10),
                })
              }
            />
          </label>
        </>
      )}
      <small>
        Optional and editable any time. Skip anything you prefer not to share.
      </small>
    </div>
  );
}

export function ProfileConnectionSummary({
  value,
}: {
  value: ProfileConnection;
}) {
  const entries = [
    { label: 'Relationship style', text: value.relationshipStyle, Icon: Heart },
    { label: 'Dating pace', text: value.datingPace, Icon: Clock3 },
    {
      label: 'Communication',
      text: value.communicationPreference,
      Icon: MessageCircle,
    },
    {
      label: 'Personal values',
      text: value.values.join(' · '),
      Icon: HandHeart,
    },
    { label: 'Everyday rhythm', text: value.rhythm.join(' · '), Icon: Clock3 },
    { label: 'Languages', text: value.languages.join(' · '), Icon: Languages },
  ].filter((item) => item.text);
  if (!entries.length) return null;
  return (
    <section
      className="profile-connection-summary"
      aria-label="Connection details"
    >
      <span className="section-label">
        <HandHeart size={17} aria-hidden="true" />
        How we connect
      </span>
      <div className="connection-summary-grid">
        {entries.map(({ label, text, Icon }) => (
          <div key={label}>
            <Icon size={17} strokeWidth={1.5} aria-hidden="true" />
            <span>
              <small>{label}</small>
              <p>{text}</p>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
