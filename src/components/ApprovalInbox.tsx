import React, { useState } from 'react';
import {
  Inbox,
  Gavel,
  CheckCircle2,
  XCircle,
  Eye,
  Upload,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Quote,
} from 'lucide-react';
import { ArticlePost, AuditReport } from '../types';

/**
 * A caixa de entrada da aprovação.
 *
 * O problema que ela resolve não é organizacional, é de escala: com N blogs
 * produzindo sozinhos, ler cada artigo inteiro para decidir não fecha a conta.
 * Aqui você decide pelo RESUMO — nota, o que o crítico disse, o que ele mandou
 * corrigir — e só abre o texto quando o resumo não bastar.
 *
 * Os reprovados aparecem também, e de propósito. A triagem erra, você tem que
 * poder discordar dela, e é dessa discordância que sai a calibração da F5.
 */

interface ApprovalInboxProps {
  posts: ArticlePost[];
  onSelectPost: (post: ArticlePost) => void;
  onPublish: (post: ArticlePost) => void;
  onReject: (post: ArticlePost) => void;
  onRestore: (post: ArticlePost) => void;
}

export const ApprovalInbox: React.FC<ApprovalInboxProps> = ({
  posts,
  onSelectPost,
  onPublish,
  onReject,
  onRestore,
}) => {
  const waiting = posts.filter((p) => p.status === 'completed' && !p.isPublished);
  const rejected = posts.filter((p) => p.status === 'rejected');

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-4">
      <header className="bg-white dark:bg-[#18191e] rounded-2xl p-4 sm:p-6 border border-stone-200 dark:border-stone-800 shadow-sm transition-colors">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-100">
              Aprovação
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {waiting.length} esperando você · {rejected.length} reprovado(s) pela triagem
            </p>
          </div>
        </div>
      </header>

      {waiting.length === 0 && rejected.length === 0 && (
        <div className="bg-white dark:bg-[#18191e] rounded-2xl p-10 border border-dashed border-stone-300 dark:border-stone-800 text-center">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Nada na fila. Quando o worker rodar, o que passar na triagem aparece aqui.
          </p>
        </div>
      )}

      {waiting.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 px-1">
            Esperando você
          </h3>
          {waiting.map((post) => (
            <InboxCard
              key={post.id}
              post={post}
              onOpen={() => onSelectPost(post)}
              primary={{ label: 'Publicar', icon: Upload, action: () => onPublish(post) }}
              secondary={{ label: 'Descartar', icon: XCircle, action: () => onReject(post) }}
            />
          ))}
        </section>
      )}

      {rejected.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 px-1">
            Reprovados pela triagem — discordar é seu direito
          </h3>
          {rejected.map((post) => (
            <InboxCard
              key={post.id}
              post={post}
              rejected
              onOpen={() => onSelectPost(post)}
              primary={{ label: 'Recuperar', icon: RotateCcw, action: () => onRestore(post) }}
            />
          ))}
        </section>
      )}
    </div>
  );
};

interface Action {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

const InboxCard: React.FC<{
  post: ArticlePost;
  rejected?: boolean;
  onOpen: () => void;
  primary: Action;
  secondary?: Action;
}> = ({ post, rejected, onOpen, primary, secondary }) => {
  const [expanded, setExpanded] = useState(false);

  const title = post.review?.revisedTitle || post.draft?.title || post.topic;
  const audit = post.audit;
  const words = (post.review?.revisedText || post.draft?.rawText || '').split(/\s+/).length;

  return (
    <article
      className={`bg-white dark:bg-[#18191e] rounded-2xl border shadow-sm transition-colors ${
        rejected
          ? 'border-rose-200 dark:border-rose-900/50'
          : 'border-stone-200 dark:border-stone-800'
      }`}
    >
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h4 className="font-serif font-bold text-stone-900 dark:text-stone-100 leading-snug">
              {title}
            </h4>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {words} palavras · {post.review?.keyTakeaways?.length || 0} destaques ·{' '}
              {post.review?.readingTimeMinutes || '?'} min
              {audit?.repairs ? ` · ${audit.repairs} reparo(s)` : ''}
            </p>
          </div>
          {audit && <ScoreBadge audit={audit} />}
        </div>

        {audit?.critique?.verdict && (
          <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed border-l-2 border-stone-300 dark:border-stone-700 pl-3">
            {audit.critique.verdict}
          </p>
        )}

        {rejected && audit?.reason && (
          <p className="text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Reprovado por: {audit.reason}</span>
          </p>
        )}

        {audit && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-semibold text-teal-700 dark:text-teal-400 flex items-center space-x-1 hover:underline"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span>
              {expanded ? 'Esconder o parecer' : `Ver o parecer (${audit.critique?.problems?.length || 0} apontamentos)`}
            </span>
          </button>
        )}

        {expanded && audit && <AuditDetail audit={audit} />}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={onOpen}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center space-x-1.5 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Abrir</span>
          </button>

          <button
            onClick={primary.action}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 flex items-center space-x-1.5 transition-colors"
          >
            <primary.icon className="w-3.5 h-3.5" />
            <span>{primary.label}</span>
          </button>

          {secondary && (
            <button
              onClick={secondary.action}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center space-x-1.5 transition-colors"
            >
              <secondary.icon className="w-3.5 h-3.5" />
              <span>{secondary.label}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

/** A nota do crítico, que é o dado que decide em um olhar. */
const ScoreBadge: React.FC<{ audit: AuditReport }> = ({ audit }) => {
  const score = audit.critique?.score ?? audit.score;
  const tone =
    score >= 8
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
      : score >= 7
      ? 'bg-teal-500/15 text-teal-700 dark:text-teal-400'
      : score >= 5
      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
      : 'bg-rose-500/15 text-rose-700 dark:text-rose-400';

  return (
    <div className={`shrink-0 px-3 py-1.5 rounded-xl text-center ${tone}`}>
      <div className="text-lg font-bold leading-none">{score}</div>
      <div className="text-[10px] uppercase tracking-wider mt-0.5 opacity-80">de 10</div>
    </div>
  );
};

const AuditDetail: React.FC<{ audit: AuditReport }> = ({ audit }) => {
  const vetos = audit.deterministic.findings.filter((f) => f.severity === 'veto');
  const avisos = audit.deterministic.findings.filter((f) => f.severity === 'aviso');

  return (
    <div className="space-y-4 pt-1">
      {audit.critique?.strongestPoint && (
        <div className="text-xs text-stone-600 dark:text-stone-400 flex items-start space-x-2">
          <Quote className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-500" />
          <span>
            <strong className="text-stone-800 dark:text-stone-200">O que não pode se perder:</strong>{' '}
            {audit.critique.strongestPoint}
          </span>
        </div>
      )}

      {audit.critique?.problems && audit.critique.problems.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center space-x-1.5">
            <Gavel className="w-3 h-3" />
            <span>O crítico apontou, em ordem de gravidade</span>
          </p>
          <ol className="space-y-2">
            {audit.critique.problems.map((p) => (
              <li
                key={p.rank}
                className="text-xs text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-stone-900/60 rounded-lg p-3 space-y-1"
              >
                <div className="flex items-start space-x-2">
                  <span className="font-mono text-stone-400 dark:text-stone-600 shrink-0">
                    #{p.rank}
                  </span>
                  <div className="space-y-1 min-w-0">
                    <p className="font-semibold text-stone-900 dark:text-stone-100">{p.what}</p>
                    {p.where && (
                      <p className="text-stone-500 dark:text-stone-500 italic truncate">"{p.where}"</p>
                    )}
                    <p className="text-stone-600 dark:text-stone-400">{p.fix}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {(vetos.length > 0 || avisos.length > 0) && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            Medido por código, sem IA
          </p>
          {[...vetos, ...avisos].map((f) => (
            <p
              key={f.code}
              className={`text-xs flex items-start space-x-1.5 ${
                f.severity === 'veto'
                  ? 'text-rose-700 dark:text-rose-400'
                  : 'text-amber-700 dark:text-amber-500'
              }`}
            >
              {f.severity === 'veto' ? (
                <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              )}
              <span>{f.message}</span>
            </p>
          ))}
        </div>
      )}

      {audit.deterministic.findings.length === 0 && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center space-x-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Nenhuma marca de texto de máquina na verificação objetiva.</span>
        </p>
      )}
    </div>
  );
};
