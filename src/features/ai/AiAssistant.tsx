import { useEffect, useRef, useState, type ReactNode } from 'react';
import { askAssistant } from '../../ai/assistant';

export interface AiAssistantProps {
  /** Business context built in App via buildBusinessSnapshot. */
  snapshot: string;
}

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
}

const QUICK_QUESTIONS: string[] = [
  'ما أكبر المديونيات الحالية؟',
  'ما اللوطات المتأخرة عن مهلة الدفع؟',
  'كم إجمالي الـ 70% غير المحصّل؟',
  'ما توقع السيولة للفترة القادمة؟',
];

export function AiAssistant({ snapshot }: AiAssistantProps): ReactNode {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, open]);

  async function send(question: string): Promise<void> {
    const trimmed = question.trim();
    if (trimmed === '' || loading) return;
    setError('');
    setMessages((prev) => [...prev, { id: nextId.current++, role: 'user', text: trimmed }]);
    setDraft('');
    setLoading(true);
    try {
      const answer = await askAssistant(trimmed, snapshot);
      setMessages((prev) => [...prev, { id: nextId.current++, role: 'assistant', text: answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void send(draft);
  }

  return (
    <div dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="المساعد الذكي"
        className="fixed bottom-24 left-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-700 text-2xl text-white shadow-xl transition-transform hover:scale-105 md:bottom-6"
      >
        {open ? '✕' : '🤖'}
      </button>

      {open ? (
        <section
          aria-label="المساعد الذكي"
          className="fixed bottom-24 left-4 right-4 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl sm:left-5 sm:right-auto sm:w-[380px] dark:border-slate-700 dark:bg-slate-900"
        >
          <header className="flex items-center gap-2 bg-gradient-to-l from-indigo-600 to-violet-700 px-4 py-3 text-white">
            <span className="text-xl">🤖</span>
            <div>
              <h2 className="text-sm font-black">مساعد العبارة الذكي</h2>
              <p className="text-[10px] text-indigo-100">يجيب من واقع بياناتك الحالية</p>
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="rounded-2xl bg-slate-100 p-3 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  👋 أهلاً! اسألني عن المديونيات، اللوطات المتأخرة، أو توقع السيولة — إجاباتي مبنية على
                  ملخص نشاطك الحالي.
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={loading}
                      onClick={() => void send(q)}
                      className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-[90%] rounded-2xl px-3 py-2 text-xs leading-6 font-semibold whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'mr-auto bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                  }`}
                >
                  {msg.text}
                </div>
              ))
            )}
            {loading ? (
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                جاري التفكير...
              </div>
            ) : null}
            {error !== '' ? (
              <p
                role="alert"
                className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
              >
                ⚠️ {error}
              </p>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-200 p-3 dark:border-slate-700">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="اكتب سؤالك هنا..."
              disabled={loading}
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
            <button
              type="submit"
              disabled={loading || draft.trim() === ''}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              إرسال
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
