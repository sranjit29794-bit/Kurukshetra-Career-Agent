import React, { useState } from 'react';
import {
  ArrowLeft,
  GitCommit,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FileCode,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { StatusPill } from './StatusPill';
import { SkillIconTile } from './SkillIconTile';
import { ShaChip } from './ShaChip';
import { CodeViewerDrawer } from './CodeViewerDrawer';
import { api, FORCE_FIXTURES } from '../lib/api';
import { DEV_FIXTURES } from '../lib/devFixtures';
import type { Status } from '../types';

export interface CompareViewProps {
  onBack?: () => void;
  onViewReport?: () => void;
  onViewSkillDetail?: (reqId: string) => void;
  trackId?: string;
  repoOwner?: string;
  repoName?: string;
}

export const CompareView: React.FC<CompareViewProps> = ({
  onBack,
  onViewSkillDetail: _onViewSkillDetail,
  trackId,
  repoOwner = '',
  repoName = '',
}) => {
  const [diffData, setDiffData] = useState<any>(
    FORCE_FIXTURES
      ? DEV_FIXTURES.diff
      : {
          from_sha: '',
          to_sha: '',
          commit_message: '',
          files_changed: [],
          items: [],
        }
  );
  const [timelineData, setTimelineData] = useState<any[]>(
    FORCE_FIXTURES ? (DEV_FIXTURES.timeline as any[]) : []
  );
  const [_loading, setLoading] = useState<boolean>(!FORCE_FIXTURES);

  React.useEffect(() => {
    if (FORCE_FIXTURES || !trackId) return;
    const currentTrackId = trackId;
    let isMounted = true;
    async function fetchHistory() {
      try {
        setLoading(true);
        const [diff, timeline] = await Promise.all([
          api.getDiff(currentTrackId).catch(() => ({
            from_sha: '',
            to_sha: '',
            commit_message: 'No diff available',
            files_changed: [],
            items: [],
          })),
          api.getTimeline(currentTrackId).catch(() => []),
        ]);
        if (isMounted) {
          if (diff) setDiffData(diff);
          if (timeline && timeline.length > 0) setTimelineData(timeline);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [trackId]);

  const [activeTab, setActiveTab] = useState<'compare' | 'timeline'>('compare');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({
    req_sql_database: true,
    req_testing: true,
  });

  // Drawer state for citation viewing
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerCitation, setDrawerCitation] = useState({
    filePath: 'app/db.py',
    start: 12,
    end: 30,
  });

  const toggleRow = (reqId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [reqId]: !prev[reqId],
    }));
  };

  const handleOpenCitation = (filePath: string, start: number, end: number) => {
    setDrawerCitation({ filePath, start, end });
    setIsDrawerOpen(true);
  };

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '28px 24px' }}>
      {/* Top Navigation */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '22px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: 'var(--text, #E8EEF9)',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--primary, #2F6DF6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text, #E8EEF9)';
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Overview</span>
        </button>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--surface-2, #101A30)',
            borderRadius: '8px',
            border: '1px solid var(--border, #1A2748)',
            padding: '2px',
            fontSize: '12px',
          }}
        >
          <button
            onClick={() => setActiveTab('compare')}
            style={{
              background: activeTab === 'compare' ? 'var(--primary, #2F6DF6)' : 'transparent',
              color: activeTab === 'compare' ? '#FFFFFF' : 'var(--muted, #8C9AB8)',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.15s ease',
            }}
          >
            Compare Diff (S5)
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            style={{
              background: activeTab === 'timeline' ? 'var(--primary, #2F6DF6)' : 'transparent',
              color: activeTab === 'timeline' ? '#FFFFFF' : 'var(--muted, #8C9AB8)',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.15s ease',
            }}
          >
            Analysis Timeline (S4)
          </button>
        </div>
      </div>

      {/* Screen Title */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            margin: '0 0 6px 0',
            color: 'var(--text, #E8EEF9)',
          }}
        >
          {activeTab === 'compare' ? 'Before / After Compare' : 'Assessment History & Timeline'}
        </h1>
        <p style={{ margin: 0, color: 'var(--muted, #8C9AB8)', fontSize: '14px' }}>
          {activeTab === 'compare'
            ? 'Detailed transition report comparing commit a1b2c3d against c3d4e5f.'
            : 'Chronological timeline of all automated assessments and repository commits.'}
        </p>
      </div>

      {/* TAB 1: S5 BEFORE / AFTER COMPARE TABLE */}
      {activeTab === 'compare' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Change Summary Card */}
          <div
            className="reference-card"
            style={{
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(47, 109, 246, 0.12)',
                  border: '1px solid rgba(47, 109, 246, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary, #2F6DF6)',
                }}
              >
                <GitCommit size={20} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text, #E8EEF9)' }}>
                    {diffData.commit_message}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(52, 211, 153, 0.12)',
                      color: '#34D399',
                      border: '1px solid rgba(52, 211, 153, 0.3)',
                    }}
                  >
                    Reassessed
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--muted, #8C9AB8)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Transition:</span>
                    <ShaChip sha={diffData.from_sha} size="sm" />
                    <span>→</span>
                    <ShaChip sha={diffData.to_sha} size="sm" />
                  </div>
                  <span>•</span>
                  <span>{diffData.files_changed.length} files changed ({diffData.files_changed.join(', ')})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Compare Table */}
          <div
            className="reference-card"
            style={{
              borderRadius: '14px',
              overflow: 'hidden',
              backgroundColor: 'var(--surface, #0A1228)',
              border: '1px solid var(--border, #1A2748)',
            }}
          >
            {/* Table Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '220px 170px 36px 170px 140px 1fr',
                alignItems: 'center',
                padding: '12px 20px',
                backgroundColor: 'var(--surface-2, #101A30)',
                borderBottom: '1px solid var(--border, #1A2748)',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--muted, #8C9AB8)',
              }}
            >
              <span>Requirement</span>
              <span>Previous</span>
              <span />
              <span>Latest</span>
              <span>Change</span>
              <span style={{ textAlign: 'right' }}>Details</span>
            </div>

            {/* Table Rows */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {diffData.items.map((item: any) => {
                const isImproved = item.change === 'improved';
                const isExpanded = !!expandedRows[item.requirement_id];
                const isUnchanged = item.change === 'unchanged';

                return (
                  <div
                    key={item.requirement_id}
                    style={{
                      borderBottom: '1px solid var(--border, #1A2748)',
                      backgroundColor: isImproved
                        ? 'rgba(47, 109, 246, 0.03)'
                        : isUnchanged && !item.reassessed
                        ? 'rgba(10, 18, 40, 0.4)'
                        : 'transparent',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    {/* Row Main Bar */}
                    <div
                      onClick={() => toggleRow(item.requirement_id)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '220px 170px 36px 170px 140px 1fr',
                        alignItems: 'center',
                        padding: '14px 20px',
                        cursor: 'pointer',
                        opacity: isUnchanged && !item.reassessed ? 0.75 : 1,
                      }}
                    >
                      {/* Requirement Name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <SkillIconTile skill={item.name} size="sm" />
                        <span
                          style={{
                            fontSize: '13.5px',
                            fontWeight: 600,
                            color: 'var(--text, #E8EEF9)',
                          }}
                        >
                          {item.name}
                        </span>
                      </div>

                      {/* Previous Status */}
                      <div>
                        <StatusPill status={item.before_status as Status} size="sm" />
                      </div>

                      {/* Arrow */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'center',
                          color: isImproved ? '#34D399' : 'var(--muted, #8C9AB8)',
                        }}
                      >
                        <ArrowRight size={15} />
                      </div>

                      {/* Latest Status */}
                      <div>
                        <StatusPill status={item.after_status as Status} size="sm" />
                      </div>

                      {/* Change Chip */}
                      <div>
                        {isImproved ? (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(52, 211, 153, 0.15)',
                              color: '#34D399',
                              border: '1px solid rgba(52, 211, 153, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>↑ Improved</span>
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(148, 163, 184, 0.08)',
                              color: 'var(--muted, #8C9AB8)',
                              border: '1px solid var(--border, #1A2748)',
                            }}
                          >
                            {item.reassessed ? 'Reassessed' : 'Unchanged'}
                          </span>
                        )}
                      </div>

                      {/* Expand / Collapse Chevron */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', color: 'var(--muted, #8C9AB8)' }}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {/* Expandable "Why It Changed" Drawer Panel */}
                    {isExpanded && (
                      <div
                        style={{
                          padding: '16px 24px 20px 24px',
                          backgroundColor: 'var(--surface-2, #101A30)',
                          borderTop: '1px solid var(--border, #1A2748)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px',
                        }}
                      >
                        {/* Why it changed narrative from Coach */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <Sparkles size={16} style={{ color: 'var(--primary, #2F6DF6)', flexShrink: 0, marginTop: '2px' }} />
                          <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text, #E8EEF9)' }}>
                            <strong>Why it changed:</strong> {item.why}
                          </div>
                        </div>

                        {/* Evidence Added Preview */}
                        {item.evidence_added && item.evidence_added.length > 0 && (
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#34D399', marginBottom: '8px' }}>
                              + Evidence Added ({item.evidence_added.length} signals verified):
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {item.evidence_added.map((ev: any) => (
                                <div
                                  key={ev.id}
                                  style={{
                                    backgroundColor: '#070C18',
                                    border: '1px solid var(--border, #1A2748)',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <div
                                    style={{
                                      padding: '8px 12px',
                                      backgroundColor: 'var(--surface-card, #0A1228)',
                                      borderBottom: '1px solid var(--border, #1A2748)',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      fontSize: '12px',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <FileCode size={14} style={{ color: 'var(--primary, #2F6DF6)' }} />
                                      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text, #E8EEF9)', fontWeight: 600 }}>
                                        {ev.file_path}
                                      </span>
                                      <span style={{ color: 'var(--muted, #8C9AB8)', fontSize: '11px' }}>
                                        Lines {ev.line_start}–{ev.line_end}
                                      </span>
                                    </div>

                                    <button
                                      onClick={() => handleOpenCitation(ev.file_path, ev.line_start, ev.line_end)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--primary, #2F6DF6)',
                                        fontSize: '11.5px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                      }}
                                    >
                                      <span>View file</span>
                                      <ExternalLink size={11} />
                                    </button>
                                  </div>

                                  <div style={{ padding: '2px 0' }}>
                                    <SyntaxHighlighter
                                      language="python"
                                      style={vscDarkPlus}
                                      showLineNumbers
                                      startingLineNumber={ev.line_start}
                                      customStyle={{
                                        margin: 0,
                                        padding: '8px 12px',
                                        backgroundColor: '#070C18',
                                        fontSize: '11.5px',
                                        lineHeight: 1.5,
                                      }}
                                    >
                                      {ev.snippet}
                                    </SyntaxHighlighter>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Unchanged / Not Reassessed Note */}
                        {isUnchanged && !item.reassessed && (
                          <div style={{ fontSize: '12px', color: 'var(--muted, #8C9AB8)', fontStyle: 'italic' }}>
                            Not reassessed — no related files changed in commit {diffData.to_sha.substring(0, 7)}.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: S4 TIMELINE OF ANALYSES */}
      {activeTab === 'timeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {timelineData.map((analysis, idx) => {
            const isLatest = idx === 0;
            const isDocsOnly = analysis.skills_reassessed.length === 0;

            return (
              <div
                key={analysis.id}
                className="reference-card"
                style={{
                  padding: '24px',
                  backgroundColor: 'var(--surface, #0A1228)',
                  border: isLatest ? '1px solid rgba(47, 109, 246, 0.4)' : '1px solid var(--border, #1A2748)',
                  borderRadius: '16px',
                  position: 'relative',
                }}
              >
                {/* Commit Title & Badges */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: '14px',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: isLatest ? 'rgba(47, 109, 246, 0.15)' : 'var(--surface-2, #101A30)',
                        border: '1px solid var(--border, #1A2748)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isLatest ? 'var(--primary, #2F6DF6)' : 'var(--muted, #8C9AB8)',
                      }}
                    >
                      <GitCommit size={18} />
                    </div>

                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 2px 0', color: 'var(--text, #E8EEF9)' }}>
                        {analysis.commit_message}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted, #8C9AB8)' }}>
                        <span>by {analysis.author.split('<')[0].trim()}</span>
                        <span>•</span>
                        <ShaChip sha={analysis.commit_sha} size="sm" />
                        <span>•</span>
                        <span>via {analysis.trigger}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isDocsOnly ? (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px dashed #94A3B8',
                          color: '#94A3B8',
                        }}
                      >
                        docs only — no skill change
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(52, 211, 153, 0.12)',
                          color: '#34D399',
                          border: '1px solid rgba(52, 211, 153, 0.3)',
                        }}
                      >
                        {analysis.skills_reassessed.length} Skills Reassessed
                      </span>
                    )}
                  </div>
                </div>

                {/* Transition Summary Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                  {analysis.transitions.map((t: any, tIdx: number) => {
                    const isImproved = t.change === 'improved';
                    return (
                      <div
                        key={tIdx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: isImproved ? 'rgba(52, 211, 153, 0.08)' : 'var(--surface-2, #101A30)',
                          border: isImproved ? '1px solid rgba(52, 211, 153, 0.25)' : '1px solid var(--border, #1A2748)',
                          fontSize: '12px',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--text, #E8EEF9)' }}>{t.skill}</span>
                        <span style={{ color: 'var(--muted, #8C9AB8)' }}>
                          {t.before === 'DEMONSTRATED' ? '✓' : t.before === 'PARTIAL' ? '◐' : '○'}
                        </span>
                        <ArrowRight size={12} style={{ color: isImproved ? '#34D399' : 'var(--muted, #8C9AB8)' }} />
                        <span style={{ color: isImproved ? '#34D399' : 'var(--text, #E8EEF9)', fontWeight: 600 }}>
                          {t.after === 'DEMONSTRATED' ? '✓' : t.after === 'PARTIAL' ? '◐' : '○'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Action Footer */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border, #1A2748)',
                    fontSize: '12px',
                    color: 'var(--muted, #8C9AB8)',
                  }}
                >
                  <span>{analysis.files_changed_count} files changed in commit</span>

                  <button
                    onClick={() => setActiveTab('compare')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary, #2F6DF6)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>View diff report →</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-over Code Viewer Drawer */}
      <CodeViewerDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        filePath={drawerCitation.filePath}
        sha={diffData.to_sha}
        highlightRange={{ start: drawerCitation.start, end: drawerCitation.end }}
        repoOwner={repoOwner}
        repoName={repoName}
      />
    </div>
  );
};
