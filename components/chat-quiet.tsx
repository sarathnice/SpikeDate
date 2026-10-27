'use client';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Lightbulb, Smile, SmilePlus } from 'lucide-react';
import {
  conversationStarters,
  reactionEmojis,
  type MessageReaction,
} from '@/lib/chat-quiet';

const ReactionsContext = createContext<{
  reactions: MessageReaction[];
  busy: boolean;
  update: (id: string, emoji: string | null) => Promise<void>;
}>({ reactions: [], busy: false, update: async () => {} });
export function QuietReactions({
  conversationId,
  children,
}: {
  conversationId?: string;
  children: ReactNode;
}) {
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const writing = useRef(false);
  const revision = useRef(0);
  useEffect(() => {
    let alive = true,
      pending = false;
    const load = async () => {
      if (
        !conversationId ||
        pending ||
        writing.current ||
        document.visibilityState !== 'visible'
      )
        return;
      pending = true;
      const version = revision.current;
      try {
        const response = await fetch(
          `/api/conversations/${encodeURIComponent(conversationId)}/reactions`,
        );
        if (!response.ok) throw Error('Reactions are temporarily unavailable.');
        const data = (await response.json()) as {
          reactions: MessageReaction[];
        };
        if (alive && !writing.current && version === revision.current) {
          setReactions(data.reactions);
          setError('');
        }
      } catch {
        if (alive) setError('Reactions are temporarily unavailable.');
      } finally {
        pending = false;
      }
    };
    void load();
    const interval = window.setInterval(load, 5000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [conversationId]);
  const update = async (id: string, emoji: string | null) => {
    if (writing.current) return;
    if (!conversationId) {
      setReactions((items) => [
        ...items.filter((r) => r.message_id !== id),
        ...(emoji ? [{ message_id: id, emoji, count: 1, mine: 1 }] : []),
      ]);
      return;
    }
    writing.current = true;
    revision.current++;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/conversations/${encodeURIComponent(conversationId)}/reactions`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messageId: id, emoji }),
        },
      );
      if (!response.ok) throw Error();
      const data = (await response.json()) as { reactions: MessageReaction[] };
      setReactions(data.reactions);
    } catch {
      setError('Reaction not saved. Please try again.');
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  return (
    <ReactionsContext.Provider value={{ reactions, busy, update }}>
      {children}
      {error && (
        <p className="quiet-chat-error" role="status">
          {error}
        </p>
      )}
    </ReactionsContext.Provider>
  );
}
export function ChatReaction({
  messageId,
  disabled,
}: {
  messageId: string | number;
  disabled?: boolean;
}) {
  const { reactions, busy, update } = useContext(ReactionsContext);
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // Reveal the inline picker inside history, without scrolling the app shell.
    const history = wrapper.current?.closest<HTMLElement>('.message-body');
    if (history && wrapper.current) {
      const bottom = wrapper.current.getBoundingClientRect().bottom;
      const viewportBottom = history.getBoundingClientRect().bottom;
      if (bottom > viewportBottom) history.scrollTop += bottom - viewportBottom + 8;
    }
    const close = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        wrapper.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  const items = reactions.filter((r) => r.message_id === String(messageId));
  return (
    <div
      className="quiet-message-reactions"
      role="group"
      aria-label="Message reactions"
      ref={wrapper}
    >
      <button
        type="button"
        className="quiet-react-trigger"
        aria-label="React to message"
        aria-expanded={open}
        disabled={disabled || busy}
        onClick={() => setOpen(!open)}
      >
        <SmilePlus size={15} />
      </button>
      {items.map((item) => (
        <button
          type="button"
          key={item.emoji}
          aria-label={`${item.emoji} reaction, ${item.count}${item.mine ? ', yours; remove' : ''}`}
          aria-pressed={Boolean(item.mine)}
          disabled={disabled || busy}
          onClick={() =>
            void update(String(messageId), item.mine ? null : item.emoji)
          }
        >
          {item.emoji} {item.count}
        </button>
      ))}
      {open && (
        <div
          className="quiet-reaction-picker"
          role="group"
          aria-label="Choose reaction"
        >
          {reactionEmojis.map((emoji) => (
            <button
              type="button"
              key={emoji}
              aria-label={`React ${emoji}`}
              disabled={busy || disabled}
              onClick={() => {
                void update(
                  String(messageId),
                  items.some((i) => i.emoji === emoji && i.mine) ? null : emoji,
                );
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export function ChatQuietComposer({
  value,
  onChange,
  lastMessage,
  disabled,
}: {
  value: string;
  onChange: (text: string) => void;
  lastMessage?: string;
  disabled: boolean;
}) {
  const [panel, setPanel] = useState<'emoji' | 'ideas' | null>(null);
  useEffect(() => {
    if (!panel) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(null);
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [panel]);
  return (
    <div
      className="quiet-composer-tools"
      role="group"
      aria-label="Emoji and ideas"
    >
      {panel && (
        <div
          className="quiet-composer-panel"
          role="group"
          aria-label={
            panel === 'emoji' ? 'Emoji picker' : 'Conversation starters'
          }
        >
          {panel === 'emoji' ? (
            ['😊', '😍', '😂', '❤️', '🙌', '🎵', '☕', '👋'].map((emoji) => (
              <button
                key={emoji}
                type="button"
                disabled={disabled}
                aria-label={`Insert ${emoji}`}
                onClick={() => {
                  if (value.length + emoji.length <= 2000) onChange(value + emoji);
                }}
              >
                {emoji}
              </button>
            ))
          ) : (
            <>
              <small>Ideas only — edit before sending</small>
              {conversationStarters(lastMessage).map((text) => (
                <button
                  key={text}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (!value.trim()) {
                      onChange(text);
                      setPanel(null);
                    }
                  }}
                >
                  {text}
                </button>
              ))}
              {value.trim() && (
                <small>Keep or clear your draft before choosing an idea.</small>
              )}
            </>
          )}
        </div>
      )}
      <div className="quiet-composer-toggles">
        <button
          type="button"
          disabled={disabled}
          aria-label="Emoji picker"
          aria-expanded={panel === 'emoji'}
          onClick={() => setPanel(panel === 'emoji' ? null : 'emoji')}
        >
          <Smile size={19} />
          <span>Emoji</span>
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label="Conversation ideas"
          aria-expanded={panel === 'ideas'}
          onClick={() => setPanel(panel === 'ideas' ? null : 'ideas')}
        >
          <Lightbulb size={18} />
          <span>Ideas</span>
        </button>
      </div>
    </div>
  );
}
