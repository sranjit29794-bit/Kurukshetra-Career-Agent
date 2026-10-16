import React, { useState } from 'react';
import {
  ExternalLink,
  Activity,
  ArrowUpDown,
  ArrowLeft,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { StatusPill } from './StatusPill';
import { ShaChip } from './ShaChip';
import { WatcherChip } from './WatcherChip';
import { UpdatedChip } from './UpdatedChip';
import { InfoBanner } from './InfoBanner';
import { SkillIconTile } from './SkillIconTile';
import { EvidenceCard } from './EvidenceCard';
import { CodeViewer } from './CodeViewer';
import { AgentActivityDrawer } from './AgentActivityDrawer';
import { ScopeModal } from './ScopeModal';
import { REPO_CODE_FIXTURES } from '../fixtures/repoCode';
import type { TrackOpportunity, Evidence, ScopeInfo } from '../types';
import eventsFixture from '../../../docs/fixtures/events.json';

interface ResultsViewProps {
  track: TrackOpportunity;
  onBackToDashboard: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ track, onBackToDashboard }) => {
  // Sort toggle: 'gaps_first' vs 'job_order'
  const [sortOrder, setSortOrder] = useState<'gaps_first' | 'job_order'>('gaps_first');

  // Currently selected requirement ID
  const [selectedReqId, setSelectedReqId] = useState<string>(
    track.assessments[0]?.requirement_id || 'req_sql_database'
  );

  // Active citation state for right CodeViewer pane
  const initialEvidence = track.assessments.flatMap((a) => a.evidence)[0];
  const [activeCitation, setActiveCitation] = useState<{
    filePath: string;
    start: number;
    end: number;
    evidenceId?: string;
  }>({
    filePath: initialEvidence?.file_path || 'app/db.py',
    start: initialEvidence?.line_start || 12,
    end: initialEvidence?.line_end || 30,
    evidenceId: initialEvidence?.id,
  });

  // Drawer & Modal state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isScopeModalOpen, setIsScopeModalOpen] = useState<boolean>(false);

  // Scope information
  const scope: ScopeInfo = {
    analyzed: 6,
    skipped: 2,
    skipped_reasons: {
      'Documentation (*.md)': 1,
      'Virtualenv / packages': 1,
    },
    truncated: false,
  };

  // Find currently active assessment and matching requirement
  const currentAssessment =
    track.assessments.find((a) => a.requirement_id === selectedReqId) || track.assessments[0];
  const currentRequirement = track.job.requirements.find(
    (r) => r.id === currentAssessment.requirement_id
  );

  // Handle citation click from EvidenceCard
  const handleSelectCitation = (ev: Evidence) => {
    setActiveCitation({
      filePath: ev.file_path,
      start: ev.line_start,
      end: ev.line_end,
      evidenceId: ev.id,
    });
  };

  // Sorting logic: gaps first puts NOT_DEMONSTRATED & PARTIAL before DEMONSTRATED
  const sortedAssessments = [...track.assessments].sort((a, b) => {
    if (sortOrder === 'job_order') {
      const posA = track.job.requirements.find((r) => r.id === a.requirement_id)?.position || 0;
      const posB = track.job.requirements.find((r) => r.id === b.requirement_id)?.position || 0;
      return posA - posB;
    }
    const rank = (status: string) => {
      switch (status) {
        case 'NOT_DEMONSTRATED':
          return 0;
        case 'PARTIAL':
          return 1;
        case 'DEMONSTRATED':
          return 2;
        default:
          return 3;
      }
    };
    return rank(a.status) - rank(b.status);
  });

  // Get active code content for Right Pane
  const activeFileFixture = REPO_CODE_FIXTURES[activeCitation.filePath] || {
    path: activeCitation.filePath,
    sha: track.last_seen_sha,
    language: 'python',
    content: `# File: ${activeCitation.filePath}\n# No local fixture snippet available for this path.`,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      {/* S3 HEADER BAR matching reference.png */}
      <div
        style={{
          borderBottom: '1px solid var(--border, #1A2748)',
          backgroundColor: 'var(--surface, #0A1228)',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onBackToDashboard}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--surface-2, #101A30)',
              border: '1px solid var(--border, #1A2748)',
              color: 'var(--text, #E8EEF9)',
              fontSize: '12.5px',
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <ArrowLeft size={14} />
            <span>Back to Overview</span>
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text, #E8EEF9)' }}>
                {track.job.title}
              </h1>
              <span style={{ color: 'var(--muted, #8C9AB8)', fontSize: '13px' }}>at {track.job.company}</span>
              <a
                href={track.job.source_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: 'var(--primary, #2F6DF6)',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  textDecoration: 'none',
                }}
              >
                Posting <ExternalLink size={11} />
              </a>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--muted, #8C9AB8)', marginTop: '2px' }}>
              <span>repo: <strong>{track.repo.owner}/{track.repo.name}</strong></span>
              <span>•</span>
              <span>branch: <code>{track.branch}</code></span>
              <span>•</span>
              <span
                title="Click to view scope exclusion boundaries"
                onClick={() => setIsScopeModalOpen(true)}
                style={{
                  color: 'var(--primary, #2F6DF6)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                Scope: {scope.analyzed} files analyzed, {scope.skipped} skipped
              </span>
            </div>
          </div>
        </div>

        {/* Right Header: SHA, Timestamp, Watcher, Activity Drawer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Analyzed Commit SHA Chip */}
          <ShaChip sha={track.last_seen_sha} size="sm" />

          {/* Last Analyzed Timestamp */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill, 8px)',
              backgroundColor: 'var(--surface-2, #101A30)',
              border: '1px solid var(--border, #1A2748)',
              fontSize: '12px',
              color: 'var(--muted, #8C9AB8)',
            }}
          >
            <Clock size={12} />
            <span>Last analyzed: {track.last_assessed_at}</span>
            <RefreshCw size={11} style={{ color: 'var(--primary, #2F6DF6)', cursor: 'pointer', marginLeft: '2px' }} />
          </div>

          {/* Watcher Chip */}
          <WatcherChip mode={track.watcher_mode} compact size="sm" />

          {/* Agent Activity Drawer Toggle */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '8px',
              backgroundColor: isDrawerOpen ? 'var(--primary, #2F6DF6)' : 'var(--surface-2, #101A30)',
              color: isDrawerOpen ? '#FFFFFF' : 'var(--text, #E8EEF9)',
              border: '1px solid var(--border, #1A2748)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Activity size={13} />
            <span>Agent Feed</span>
            <span
              style={{
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: '8px',
                backgroundColor: isDrawerOpen ? '#FFFFFF' : 'var(--primary, #2F6DF6)',
                color: isDrawerOpen ? 'var(--primary, #2F6DF6)' : '#FFFFFF',
                fontWeight: 700,
              }}
            >
              8
            </span>
          </button>
        </div>
      </div>

      {/* Persistent Subtle Absence ≠ Failure Banner Strip */}
      <InfoBanner />

      {/* THREE-PANE LAYOUT per BRAIN §16.3 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '320px 480px 1fr',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* LEFT PANE: REQUIREMENTS LIST */}
        <div
          style={{
            borderRight: '1px solid var(--border, #1A2748)',
            backgroundColor: 'var(--surface, #0A1228)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          {/* List Header & Sort Toggle */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border, #1A2748)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--surface-2, #101A30)',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted, #8C9AB8)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Requirements ({track.assessments.length})
            </span>

            <button
              onClick={() => setSortOrder(sortOrder === 'gaps_first' ? 'job_order' : 'gaps_first')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'transparent',
                border: 'none',
                color: 'var(--primary, #2F6DF6)',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <ArrowUpDown size={12} />
              <span>{sortOrder === 'gaps_first' ? 'Gaps first' : 'Job order'}</span>
            </button>
          </div>

          {/* List Items */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sortedAssessments.map((asmt) => {
              const req = track.job.requirements.find((r) => r.id === asmt.requirement_id);
              const isSelected = selectedReqId === asmt.requirement_id;
              const isUpdated = asmt.reassessed && asmt.evidence.length > 0;
              const skillName = req ? req.name : asmt.requirement_id;

              return (
                <div
                  key={asmt.id}
                  onClick={() => {
                    setSelectedReqId(asmt.requirement_id);
                    if (asmt.evidence.length > 0) {
                      handleSelectCitation(asmt.evidence[0]);
                    }
                  }}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border, #1A2748)',
                    backgroundColor: isSelected ? 'var(--surface-2, #101A30)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--primary, #2F6DF6)' : '3px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <SkillIconTile skill={skillName} size="sm" />
                      <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text, #E8EEF9)' }}>
                        {skillName}
                      </span>
                    </div>

                    {isUpdated && (
                      <UpdatedChip type="reassessed" label="UPDATED" size="sm" />
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '36px' }}>
                    <StatusPill status={asmt.status} size="sm" showLabel={true} />

                    {req && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: 'var(--muted, #8C9AB8)',
                          backgroundColor: 'var(--surface-card, #0A1228)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          border: '1px solid var(--border, #1A2748)',
                        }}
                      >
                        {req.priority.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER PANE: EVIDENCE CARD */}
        <div
          style={{
            borderRight: '1px solid var(--border, #1A2748)',
            backgroundColor: 'var(--bg, #050A1A)',
            overflowY: 'auto',
            padding: '16px',
          }}
        >
          {currentAssessment && (
            <EvidenceCard
              assessment={currentAssessment}
              requirement={currentRequirement}
              onSelectCitation={handleSelectCitation}
              selectedEvidenceId={activeCitation.evidenceId}
              onRetry={() => alert('Retrying deterministic detector pass...')}
            />
          )}
        </div>

        {/* RIGHT PANE: CODE VIEWER */}
        <div style={{ overflowY: 'hidden', padding: '16px', backgroundColor: 'var(--bg, #050A1A)' }}>
          <CodeViewer
            filePath={activeCitation.filePath}
            sha={track.last_seen_sha}
            code={activeFileFixture.content}
            language={activeFileFixture.language}
            highlightRange={{ start: activeCitation.start, end: activeCitation.end }}
            repoOwner={track.repo.owner}
            repoName={track.repo.name}
          />
        </div>
      </div>

      {/* Scope Boundaries Modal */}
      <ScopeModal
        isOpen={isScopeModalOpen}
        onClose={() => setIsScopeModalOpen(false)}
        scope={scope}
      />

      {/* Agent Activity Drawer */}
      <AgentActivityDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        events={eventsFixture as any}
      />
    </div>
  );
};
