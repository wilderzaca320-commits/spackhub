import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, MessageSquare, Send } from 'lucide-react';
import { api } from '../lib/api';
import type { ConversationItem, MessageThread } from '../lib/api';
import { avatarFor, formatDateTime } from '../lib/adapters';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';

interface MessagesViewProps {
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({ onShowToast }) => {
  const { user } = useAuth();
  const { refreshMessages } = useStore();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [thread, setThread] = useState<MessageThread | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeId = Number(userId) || null;

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoadingList(true);
    api.messages
      .list()
      .then((data) => {
        if (alive) setConversations(data.items);
      })
      .catch((error: unknown) => {
        if (alive) {
          onShowToast(
            'No se pudieron cargar los mensajes',
            error instanceof Error ? error.message : undefined,
            'error'
          );
        }
      })
      .finally(() => {
        if (alive) setLoadingList(false);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !activeId) {
      setThread(null);
      return;
    }
    let alive = true;
    setLoadingThread(true);
    api.messages
      .thread(activeId)
      .then(async (data) => {
        if (!alive) return;
        setThread(data);
        await refreshMessages();
        window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
      })
      .catch((error: unknown) => {
        if (alive) {
          onShowToast(
            'No se pudo abrir la conversación',
            error instanceof Error ? error.message : undefined,
            'error'
          );
        }
      })
      .finally(() => {
        if (alive) setLoadingThread(false);
      });
    return () => {
      alive = false;
    };
  }, [activeId, user, refreshMessages]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeId) return;
    const contenido = draft.trim();
    if (!contenido) return;
    setSending(true);
    try {
      const result = await api.messages.send({ receiverId: activeId, contenido });
      setDraft('');
      setThread((prev) =>
        prev ? { ...prev, items: [...prev.items, { ...result.item, mine: true }] } : prev
      );
      setConversations((prev) => {
        const exists = prev.some((item) => item.otherId === activeId);
        if (!exists) return prev;
        return prev.map((item) =>
          item.otherId === activeId
            ? { ...item, lastMessage: contenido, lastAt: result.item.createdAt, unread: 0 }
            : item
        );
      });
      window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    } catch (error) {
      onShowToast(
        'No se pudo enviar el mensaje',
        error instanceof Error ? error.message : undefined,
        'error'
      );
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <MessageSquare className="w-12 h-12 mx-auto mb-4 text-purple-300" />
        <h1 className="font-space text-2xl font-bold text-slate-900 mb-3">Mensajes</h1>
        <p className="text-sm text-slate-500 mb-6">Iniciá sesión para hablar con compradores y vendedores.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-700 text-white text-sm font-semibold hover:bg-purple-800 transition"
        >
          Volver a Explorar
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <div className="text-[11px] font-mono-code font-bold uppercase tracking-widest text-purple-700 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
          MENSAJES DIRECTOS
        </div>
        <h1 className="font-space text-3xl font-bold text-slate-900 mt-1">Mensajes</h1>
      </div>

      <div className="grid md:grid-cols-[320px_1fr] rounded-2xl border border-purple-100 bg-white shadow-sm overflow-hidden min-h-[540px]">
        <aside className={`border-r border-purple-100 ${activeId ? 'hidden md:block' : 'block'}`}>
          <div className="px-4 py-3 border-b border-purple-100 text-xs font-bold uppercase tracking-widest text-slate-400">
            Conversaciones
          </div>
          {loadingList ? (
            <div className="py-16 flex justify-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-4 py-10 text-sm text-slate-500">
              Todavía no tenés conversaciones. Podés escribirle a un creador desde su perfil.
            </p>
          ) : (
            <ul className="divide-y divide-purple-50 max-h-[480px] overflow-y-auto">
              {conversations.map((conversation) => (
                <li key={conversation.otherId}>
                  <button
                    type="button"
                    onClick={() => navigate(`/mensajes/${conversation.otherId}`)}
                    className={`w-full text-left flex gap-3 px-4 py-3 hover:bg-purple-50/60 transition ${
                      activeId === conversation.otherId ? 'bg-purple-50' : ''
                    }`}
                  >
                    <img
                      src={avatarFor(conversation.otherAvatarKey)}
                      alt={conversation.otherName}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {conversation.otherName}
                        </span>
                        {conversation.unread > 0 && (
                          <span className="min-w-4 h-4 px-1 rounded-full bg-fuchsia-500 text-[10px] font-bold text-white grid place-items-center">
                            {conversation.unread > 9 ? '9+' : conversation.unread}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{conversation.lastMessage}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className={`flex flex-col ${activeId ? 'block' : 'hidden md:flex'}`}>
          {!activeId ? (
            <div className="flex-1 grid place-items-center p-10 text-center">
              <div>
                <MessageSquare className="w-10 h-10 mx-auto mb-3 text-purple-200" />
                <p className="text-sm text-slate-500">Elegí una conversación para empezar.</p>
              </div>
            </div>
          ) : loadingThread ? (
            <div className="flex-1 grid place-items-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : thread ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-purple-100">
                <button
                  type="button"
                  onClick={() => navigate('/mensajes')}
                  className="md:hidden p-1.5 rounded-lg hover:bg-purple-50"
                  aria-label="Volver a conversaciones"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <img
                  src={avatarFor(thread.other.avatarKey)}
                  alt={thread.other.name}
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900">{thread.other.name}</div>
                  <div className="text-[11px] text-slate-400">Conversación privada</div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-h-[420px] bg-[#fdfbff]">
                {thread.items.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-10">
                    Todavía no hay mensajes. Escribí el primero.
                  </p>
                ) : (
                  thread.items.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${
                          message.mine
                            ? 'bg-purple-700 text-white rounded-br-md'
                            : 'bg-white border border-purple-100 text-slate-800 rounded-bl-md'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.contenido}</p>
                        <div
                          className={`text-[10px] mt-1 ${
                            message.mine ? 'text-purple-200' : 'text-slate-400'
                          }`}
                        >
                          {formatDateTime(message.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={send} className="flex items-center gap-2 px-3 py-3 border-t border-purple-100">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Escribí un mensaje…"
                  maxLength={2000}
                  className="flex-1 h-11 px-4 rounded-xl border border-purple-100 bg-white text-sm outline-none focus:border-purple-400"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="h-11 px-4 inline-flex items-center gap-2 rounded-xl bg-purple-700 text-white text-sm font-semibold hover:bg-purple-800 disabled:opacity-50 transition"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 grid place-items-center p-10 text-sm text-slate-500">
              No se pudo abrir la conversación.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
