import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, BookOpen, ExternalLink, Clock, Tag, Copy, RefreshCw, FileText, TrendingUp, Globe } from 'lucide-react';

const MOCK_RESULTS = [
  {
    id: '1',
    title: 'AI Productivity Tools: State of the Market 2026',
    source: 'TechCrunch',
    url: 'https://techcrunch.com',
    snippet: 'The AI productivity software market has grown 340% year-over-year, with enterprise adoption leading the charge. Key players include Notion AI, Microsoft Copilot, and emerging startups…',
    publishedAt: '2 hours ago',
    tags: ['AI', 'Productivity', 'Market Research'],
    relevance: 98,
  },
  {
    id: '2',
    title: 'How Top CEOs Are Using AI Assistants in 2026',
    source: 'Harvard Business Review',
    url: 'https://hbr.org',
    snippet: 'A survey of 500 Fortune 1000 executives reveals that 73% now use some form of AI assistant for daily workflow management. The most common use cases include email management…',
    publishedAt: '1 day ago',
    tags: ['Leadership', 'AI', 'Workflow'],
    relevance: 91,
  },
  {
    id: '3',
    title: 'Building Personal AI Operating Systems: Technical Overview',
    source: 'Wired',
    url: 'https://wired.com',
    snippet: 'Personal AI operating systems represent the next evolution in human-computer interaction. By connecting multiple specialized agents, users can automate complex multi-step workflows…',
    publishedAt: '3 days ago',
    tags: ['Technical', 'AI Agents', 'Architecture'],
    relevance: 87,
  },
  {
    id: '4',
    title: 'The $50B Market for AI Personal Assistants',
    source: 'Forbes',
    url: 'https://forbes.com',
    snippet: 'Market analysts project the AI personal assistant market will reach $50 billion by 2028, driven by enterprise and consumer adoption. Key growth drivers include improved LLM capabilities…',
    publishedAt: '1 week ago',
    tags: ['Market', 'Finance', 'AI'],
    relevance: 82,
  },
];

const QUICK_SEARCHES = [
  { label: 'AI market trends',         icon: TrendingUp },
  { label: 'Competitor analysis',      icon: Globe },
  { label: 'Industry news summary',    icon: FileText },
  { label: 'Research on my project',   icon: BookOpen },
];

export default function ResearchPanel({ onCommand }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [summary, setSummary] = useState('');

  const handleSearch = async (q) => {
    const searchQuery = q ?? query;
    if (!searchQuery.trim()) return;
    setQuery(searchQuery);
    setSearching(true);
    setHasSearched(true);
    setSelectedResult(null);
    setSummary('');

    try {
      await onCommand('research', { query: searchQuery });
      // Simulate results for now
      await new Promise(r => setTimeout(r, 1200));
      setResults(MOCK_RESULTS);
    } catch (_) {
      setResults(MOCK_RESULTS);
    } finally {
      setSearching(false);
    }
  };

  const handleSummarize = async () => {
    if (!results.length) return;
    setSearching(true);
    await new Promise(r => setTimeout(r, 800));
    setSummary(`Based on ${results.length} sources about "${query}":\n\n• The AI productivity market is experiencing rapid growth (340% YoY)\n• Enterprise adoption is the primary driver, with 73% of executives using AI tools\n• Personal AI operating systems are an emerging category expected to reach $50B by 2028\n• Key use cases: email management, calendar optimization, and workflow automation\n\nConclusion: This is a high-growth market with strong enterprise demand and improving technology maturity.`);
    setSearching(false);
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--s0)' }}>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid var(--border)', background: 'var(--s1)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Search size={15} color="var(--purple)" />
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>Research</h1>
          </div>

          {/* Search input */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={14} color="var(--text-3)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                className="input"
                placeholder="Research anything — market trends, competitors, topics…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                style={{ paddingLeft: 36, height: 40, fontSize: 14 }}
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              className="btn btn-primary"
              onClick={() => handleSearch()}
              disabled={!query.trim() || searching}
              style={{ height: 40, paddingInline: 20 }}
            >
              {searching
                ? <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                : <Sparkles size={14} />}
              {searching ? 'Searching…' : 'Research'}
            </motion.button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!hasSearched ? (
            /* Empty state with quick searches */
            <div style={{ padding: '40px 28px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>
                Search the web or ask your AI agent to research any topic in depth.
              </p>

              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>QUICK SEARCHES</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {QUICK_SEARCHES.map(({ label, icon: Icon }) => (
                  <motion.button
                    key={label}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSearch(label)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 16px', borderRadius: 12,
                      background: 'var(--s2)', border: '1px solid var(--border)',
                      color: 'var(--text-2)', cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 13, textAlign: 'left',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--s3)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--s2)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)'; }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={13} color="var(--purple)" />
                    </div>
                    {label}
                  </motion.button>
                ))}
              </div>
            </div>
          ) : searching ? (
            <div style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 100, borderRadius: 12 }} />
              ))}
            </div>
          ) : (
            <div style={{ padding: '20px 28px' }}>
              {/* Summary */}
              {!summary ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{results.length} results for "<span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{query}</span>"</p>
                  <button className="btn btn-secondary btn-sm" onClick={handleSummarize}>
                    <Sparkles size={12} /> AI Summary
                  </button>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ marginBottom: 20, padding: '18px 20px', borderRadius: 12, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <Sparkles size={14} color="#818cf8" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#818cf8' }}>AI Research Summary</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{summary}</p>
                </motion.div>
              )}

              {/* Results */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <AnimatePresence>
                  {results.map((result, i) => (
                    <ResultCard
                      key={result.id}
                      result={result}
                      delay={i * 0.07}
                      isSelected={selectedResult?.id === result.id}
                      onClick={() => setSelectedResult(selectedResult?.id === result.id ? null : result)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right detail pane */}
      <AnimatePresence>
        {selectedResult && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 340 }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ borderLeft: '1px solid var(--border)', background: 'var(--s1)', overflow: 'hidden', flexShrink: 0 }}
          >
            <ResultDetail result={selectedResult} onClose={() => setSelectedResult(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultCard({ result, delay, isSelected, onClick }) {
  const [copied, setCopied] = useState(false);
  const relevanceColor = result.relevance >= 90 ? 'var(--green)' : result.relevance >= 80 ? 'var(--amber)' : 'var(--text-3)';

  const copySnippet = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(result.snippet).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
      whileHover={{ y: -1 }}
      onClick={onClick}
      className="card"
      style={{
        padding: '16px 18px',
        background: isSelected ? 'rgba(99,102,241,0.06)' : 'var(--s2)',
        border: `1px solid ${isSelected ? 'rgba(99,102,241,0.25)' : 'var(--border)'}`,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.3, marginBottom: 4 }}>
            {result.title}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={11} color="var(--text-3)" />
            <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>{result.source}</span>
            <Clock size={10} color="var(--text-3)" />
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{result.publishedAt}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: relevanceColor }}>{result.relevance}%</span>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 10 }} className="truncate-2">
        {result.snippet}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {result.tags.map(tag => <span key={tag} className="badge badge-gray" style={{ fontSize: 10 }}>{tag}</span>)}
        <div style={{ flex: 1 }} />
        <button
          onClick={copySnippet}
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11, opacity: 0.7 }}
        >
          <Copy size={11} /> {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </motion.div>
  );
}

function ResultDetail({ result, onClose }) {
  return (
    <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Source Details</span>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.35, marginBottom: 12 }}>
        {result.title}
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span className="badge badge-accent">{result.source}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', fontSize: 12 }}>
          <Clock size={11} /> {result.publishedAt}
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.75, marginBottom: 20 }}>
        {result.snippet}
      </p>

      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>TAGS</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {result.tags.map(tag => <span key={tag} className="badge badge-gray">{tag}</span>)}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
          <ExternalLink size={13} /> Open source
        </button>
        <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
          <Sparkles size={13} /> Summarize with AI
        </button>
        <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
          <BookOpen size={13} /> Save to research
        </button>
      </div>
    </div>
  );
}
