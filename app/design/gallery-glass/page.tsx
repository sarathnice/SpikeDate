'use client';
/* oxlint-disable next/no-img-element -- Standalone approval preview uses existing local photos without changing the production image pipeline. */

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  CalendarDays,
  Check,
  Heart,
  MessageCircle,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  X,
  Zap,
} from 'lucide-react';
import './preview.css';

const screens = [
  'Home',
  'Full profile',
  'Send Spike',
  'Boost',
  'Likes',
  'Chat',
  'My Profile',
] as const;
type Screen = (typeof screens)[number];

export default function GalleryGlassPreview() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [screen, setScreen] = useState<Screen>('Home');
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState('');
  const [todayOpen, setTodayOpen] = useState(false);
  const [today, setToday] = useState('Coffee and a sunset walk');
  const [available, setAvailable] = useState(true);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([
    'That sunset walk sounds lovely.',
    'Want to grab coffee first?',
  ]);
  const [note, setNote] = useState(
    'Coffee and a sunset walk sounds like my kind of Sunday.',
  );
  const [target, setTarget] = useState('Prompt');
  const [incoming, setIncoming] = useState('Likes');
  const [fresh, setFresh] = useState(false);
  const [boost, setBoost] = useState(false);
  const notify = (text: string) => setNotice(text);
  const action = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    extra = '',
  ) => (
    <button className={`gg-icon ${extra}`} aria-label={label} onClick={onClick}>
      {icon}
    </button>
  );
  const tools = (
    <div className="gg-tools">
      {action('Open Boost', <Zap />, () => setScreen('Boost'))}
      {action('Edit Today', <CalendarDays />, () => setTodayOpen(true))}
    </div>
  );
  const nav = (
    <nav className="gg-nav" aria-label="App navigation">
      {(
        [
          ['Home', 'Discover', <Sparkles key="d" />],
          ['Home', 'Galaxy', <Sparkles key="g" />],
          ['Likes', 'Likes', <Heart key="l" />],
          ['Chat', 'Chats', <MessageCircle key="c" />],
          ['My Profile', 'Profile', <UserRound key="p" />],
        ] as [Screen, string, React.ReactNode][]
      ).map(([destination, label, icon]) => (
        <button
          key={label}
          className={
            screen === destination && label !== 'Galaxy' ? 'selected' : ''
          }
          onClick={() =>
            label === 'Galaxy'
              ? notify(
                  'Galaxy is retained in the app; not redesigned in this preview.',
                )
              : setScreen(destination as Screen)
          }
        >
          {icon}
          {label === 'Likes' && <sup>6</sup>}
          {label === 'Chats' && <sup>2</sup>}
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
  const actions = (
    <div className="gg-actions">
      {action('Pass', <X />, () => notify('Demo: passed. No account changed.'))}
      {action(
        'Like',
        <Heart fill="currentColor" />,
        () => notify('Demo: liked → next profile. No note required.'),
        'gg-like',
      )}
      {action('Send Spike', <MessageCircle />, () => setScreen('Send Spike'))}
      {action(
        saved ? 'Unsave profile' : 'Save profile',
        <Bookmark fill={saved ? 'currentColor' : 'none'} />,
        () => setSaved(!saved),
      )}
    </div>
  );
  const facts = [
    ['Height', '5′6″'],
    ['Gender', 'Woman'],
    ['Smoking', 'No'],
    ['Drinking', 'Socially'],
  ];

  return (
    <main className="gg-preview" data-ready={ready}>
      <header className="gg-intro">
        <h1>Gallery Glass</h1>
        <p>
          Coded approval preview · Inter 400 / 500 · Demo only, no account
          writes
        </p>
        <div className="gg-tabs">
          {screens.map((s) => (
            <button
              key={s}
              aria-pressed={screen === s}
              onClick={() => {
                setScreen(s);
                setNotice('');
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </header>
      <div className={`gg-phone ${screen === 'Home' ? 'gg-home' : ''}`}>
        {screen === 'Home' ? (
          <>
            <img
              className="gg-cover"
              src="/maya-walk.png"
              alt="Maya outdoors"
            />
            <header className="gg-header">
              <strong>
                Spike<span>Date</span>
              </strong>
              {tools}
            </header>
            <div className="gg-secondary">
              {' '}
              <button onClick={() => setFresh(true)}>
                <Sparkles size={16} /> Fresh 3
              </button>
              <button
                aria-label="Filters, 2 applied"
                onClick={() =>
                  notify(
                    'Demo: 2 filters applied. Existing filter sheet will be retained.',
                  )
                }
              >
                <SlidersHorizontal size={20} />
                <span>2</span>
              </button>
            </div>
            <div className="gg-home-details">
              <button
                className="gg-name"
                onClick={() => setScreen('Full profile')}
              >
                Maya, 27
              </button>
              <p>Long-term relationship</p>
              {today && (
                <p className="gg-today">
                  <CalendarDays size={14} /> Today: {today}
                </p>
              )}
              {available && (
                <p className="gg-today">
                  <span className="gg-dot" /> Available tonight
                </p>
              )}
              {actions}
            </div>
            {nav}
          </>
        ) : screen === 'Full profile' ? (
          <>
            <div className="gg-hero">
              <img src="/maya-walk.png" alt="Maya outdoors" />
              <header className="gg-header">
                {action('Back to Home', <ArrowLeft />, () => setScreen('Home'))}
                {tools}
              </header>
              <div>
                <h2>Maya, 27</h2>
                <p>Long-term relationship</p>
                {today && <p>Today: {today}</p>}
                {available && <p>Available tonight</p>}
              </div>
            </div>
            <div className="gg-content">
              <section>
                <h3>About me</h3>
                <p>
                  I love good coffee, seaside walks and conversations that go
                  somewhere. Usually planning my next little adventure.
                </p>
              </section>
              <section>
                <h3>Essentials</h3>
                <div className="gg-facts">
                  {facts.map(([label, value]) => (
                    <div key={label}>
                      <small>{label}</small>
                      <p>{value}</p>
                    </div>
                  ))}
                </div>
                <div className="gg-fact-row">
                  <small>Work</small>
                  <p>Product designer</p>
                </div>
                <div className="gg-two">
                  <div>
                    <small>Open to kids</small>
                    <p>Yes</p>
                  </div>
                  <div>
                    <small>Have kids</small>
                    <p>No kids</p>
                  </div>
                </div>
              </section>
              <section>
                <h3>Lifestyle</h3>
                <div className="gg-two">
                  <div>
                    <small>Workout</small>
                    <p>Often</p>
                  </div>
                  <div>
                    <small>Religion</small>
                    <p>Not shared</p>
                  </div>
                </div>
                <div className="gg-chips">
                  {['Coffee', 'Nature', 'Art', 'Travel'].map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              </section>
              <img
                className="gg-extra-photo"
                src="/maya-vinyl.png"
                alt="Maya enjoying music"
              />
              <section>
                <h3>My perfect Sunday</h3>
                <p>A slow morning, a new café and nowhere to rush.</p>
                <button
                  className="gg-outline"
                  onClick={() => setScreen('Send Spike')}
                >
                  Reply with a Spike
                </button>
              </section>
              <section className="gg-safety">
                <button
                  onClick={() =>
                    notify(
                      'Report flow remains in the app. Demo does not submit reports.',
                    )
                  }
                >
                  Report
                </button>
                <button
                  onClick={() =>
                    notify(
                      'Block flow remains in the app. Demo does not block users.',
                    )
                  }
                >
                  Block
                </button>
              </section>
            </div>
            <footer className="gg-sticky">{actions}</footer>
          </>
        ) : (
          <>
            <header className="gg-header gg-solid">
              <h2>{screen}</h2>
              {['Boost', 'Send Spike'].includes(screen)
                ? action('Close', <X />, () => setScreen('Home'))
                : tools}
            </header>
            <div className="gg-content">
              {screen === 'Send Spike' && (
                <>
                  <div className="gg-person">
                    <img src="/maya.png" alt="Maya" />
                    <div>
                      <h3>Maya, 27</h3>
                      <small>Long-term relationship</small>
                    </div>
                  </div>
                  <h3>Add a personal introduction</h3>
                  <div className="gg-two gg-choice">
                    {['Photo', 'Prompt'].map((t) => (
                      <button
                        key={t}
                        aria-pressed={target === t}
                        onClick={() => setTarget(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <label>
                    {target === 'Prompt' ? 'My perfect Sunday' : 'Photo 1'}
                    <textarea
                      maxLength={140}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  <small className="gg-counter">{note.length}/140</small>
                  <p className="gg-muted">
                    Shown first in their Incoming. Sending uses your existing
                    Spike allowance.
                  </p>
                  <button
                    className="gg-primary"
                    onClick={() =>
                      notify(
                        'Demo: Spike sent. No allowance used or introduction delivered.',
                      )
                    }
                  >
                    Send Spike
                  </button>
                </>
              )}
              {screen === 'Boost' && (
                <div className="gg-boost">
                  <Zap size={44} />
                  <h2>Be seen by more people</h2>
                  <p>Temporary visibility in eligible Discover feeds.</p>
                  <div className="gg-balance">
                    <h2>{boost ? 'Active' : '1'}</h2>
                    <small>
                      {boost ? 'Demo Boost' : 'boost available · demo balance'}
                    </small>
                  </div>
                  <button
                    className="gg-primary"
                    disabled={boost}
                    onClick={() => setBoost(true)}
                  >
                    {boost ? 'Boost active · demo' : 'Use a boost'}
                  </button>
                  <button
                    className="gg-outline"
                    onClick={() =>
                      notify(
                        'Demo purchase only. Existing Boost packs and checkout will be retained.',
                      )
                    }
                  >
                    Buy boosts
                  </button>
                  <small>More visibility, not guaranteed matches.</small>
                </div>
              )}
              {screen === 'Likes' && (
                <>
                  <div className="gg-two gg-choice">
                    {['Likes', 'Spikes'].map((t) => (
                      <button
                        key={t}
                        aria-pressed={incoming === t}
                        onClick={() => setIncoming(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="gg-cards">
                    {[
                      ['Maya', '/maya.png'],
                      ['Lena', '/lena.png'],
                      ['Imani', '/imani.png'],
                      ['Ava', '/ava.png'],
                    ].map(([name, photo]) => (
                      <button
                        key={name}
                        onClick={() => {
                          if (name === 'Maya') setScreen('Full profile');
                          else
                            notify(
                              `${name}: demonstration card, full-detail preview uses Maya.`,
                            );
                        }}
                      >
                        <img src={photo} alt={name} />
                        <span>
                          {name}, 27
                          {incoming === 'Spikes' && (
                            <small>“Coffee sounds like a great start.”</small>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {screen === 'Chat' && (
                <>
                  <button
                    className="gg-person gg-chat-name"
                    onClick={() => setScreen('Full profile')}
                  >
                    <img src="/maya.png" alt="Maya" />
                    <div>
                      <h3>Maya, 27</h3>
                      <small>Open full profile</small>
                    </div>
                  </button>
                  <div className="gg-messages">
                    {messages.map((m, i) => (
                      <p key={i} className={i % 2 === 0 ? 'outgoing' : ''}>
                        {m}
                      </p>
                    ))}
                  </div>
                  <button
                    className="gg-outline"
                    onClick={() =>
                      notify(
                        'Existing mutual-match date-plan flow will remain. Demo does not create invitations.',
                      )
                    }
                  >
                    Plan coffee →
                  </button>
                </>
              )}
              {screen === 'My Profile' && (
                <>
                  <div className="gg-person">
                    <img src="/elias.png" alt="Demo Alex" />
                    <div>
                      <h2>Alex, 28</h2>
                      <small>Demo profile</small>
                    </div>
                  </div>
                  <button
                    className="gg-outline"
                    onClick={() => setScreen('Full profile')}
                  >
                    Preview design using Maya’s sample profile
                  </button>
                  {[
                    ['About me', 'A short introduction'],
                    ['Essentials', 'Height · gender · children'],
                    ['Lifestyle', 'Work · workout · beliefs'],
                    ['Today', today || 'Add an update'],
                    ['Notifications', 'Choose what reaches you'],
                    ['Subscription', '$1 weekly · $4 monthly'],
                  ].map(([title, value]) => (
                    <button
                      className="gg-setting"
                      key={title}
                      onClick={() =>
                        title === 'Today'
                          ? setTodayOpen(true)
                          : notify(
                              `${title}: existing functionality retained; not editable in this demo.`,
                            )
                      }
                    >
                      <span>
                        <h3>{title}</h3>
                        <small>{value}</small>
                      </span>
                      <span>›</span>
                    </button>
                  ))}
                </>
              )}
            </div>
            {screen === 'Chat' && (
              <form
                className="gg-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draft.trim()) {
                    setMessages([...messages, draft.trim()]);
                    setDraft('');
                  }
                }}
              >
                <input
                  aria-label="Message"
                  placeholder="Write a message…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button aria-label="Send demo message">
                  <Check />
                </button>
              </form>
            )}
            {!['Boost', 'Send Spike'].includes(screen) && nav}
          </>
        )}
        {notice && (
          <div className="gg-notice" role="status">
            <span>{notice}</span>
            <button aria-label="Dismiss notice" onClick={() => setNotice('')}>
              <X size={16} />
            </button>
          </div>
        )}
        {(todayOpen || fresh) && (
          <div className="gg-overlay">
            <div
              className="gg-dialog"
              role="dialog"
              aria-modal="true"
              aria-label={fresh ? 'Fresh updates' : 'Today editor'}
            >
              <header>
                <h2>{fresh ? 'Fresh updates' : 'Today update'}</h2>
                {action('Close dialog', <X />, () => {
                  setTodayOpen(false);
                  setFresh(false);
                })}
              </header>
              {fresh ? (
                <>
                  <p>Active for 24 hours</p>
                  {[
                    'Coffee and a sunset walk',
                    'Trying a new dinner spot',
                    'An evening outdoors',
                  ].map((t) => (
                    <button
                      className="gg-setting"
                      key={t}
                      onClick={() => {
                        setFresh(false);
                        setScreen('Full profile');
                      }}
                    >
                      {t}
                    </button>
                  ))}
                  <small>Sample updates only; no live timestamps.</small>
                </>
              ) : (
                <>
                  <label>
                    What are you doing today?
                    <textarea
                      maxLength={140}
                      value={today}
                      onChange={(e) => setToday(e.target.value)}
                    />
                  </label>
                  <button
                    className="gg-availability"
                    role="switch"
                    aria-checked={available}
                    onClick={() => setAvailable(!available)}
                  >
                    <span>Available tonight</span>
                    <span>{available ? '✓ On' : 'Off'}</span>
                  </button>
                  {available && (
                    <label>
                      Available after
                      <input type="time" defaultValue="19:00" />
                    </label>
                  )}
                  <p className="gg-muted">
                    Visible for 24 hours · One active update
                  </p>
                  <button
                    className="gg-primary"
                    onClick={() => {
                      setTodayOpen(false);
                      notify('Demo update saved in this preview only.');
                    }}
                  >
                    Save update
                  </button>
                  <button
                    className="gg-delete"
                    onClick={() => {
                      setToday('');
                      setAvailable(false);
                      setTodayOpen(false);
                    }}
                  >
                    Delete update
                  </button>
                  <small>
                    This demo does not persist changes or run an expiry timer.
                  </small>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <p className="gg-footnote">
        Approval preview only. No live likes, Spikes, messages, purchases or
        profile changes. Other themes are unchanged.
      </p>
    </main>
  );
}
