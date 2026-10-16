import React from 'react';
import {
  Briefcase,
  GitBranch,
  CheckCircle2,
} from 'lucide-react';
import { StatusPill } from './StatusPill';
import { StrengthLabel } from './StrengthLabel';
import { ShaChip } from './ShaChip';
import { SourceBadge } from './SourceBadge';
import { UpdatedChip } from './UpdatedChip';
import { WatcherChip } from './WatcherChip';
import { LlmChip } from './LlmChip';
import { RateLimitChip } from './RateLimitChip';
import { LiveChip } from './LiveChip';
import { InfoBanner } from './InfoBanner';
import { SkillIconTile } from './SkillIconTile';
import { StatCard } from './StatCard';
import { SegmentedRing } from './SegmentedRing';
import { AgentRow } from './AgentRow';
import { StepperHeader } from './StepperHeader';
import { ChecklistItem } from './ChecklistItem';

export const DevComponentsShowcase: React.FC = () => {
  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '36px 28px', color: 'var(--text, #E8EEF9)' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Design System & Component Showcase
          </h1>
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'JetBrains Mono',
              padding: '2px 8px',
              backgroundColor: 'var(--surface-2, #101A30)',
              border: '1px solid var(--border, #1A2748)',
              borderRadius: '6px',
              color: 'var(--primary, #2F6DF6)',
            }}
          >
            /dev/components
          </span>
        </div>
        <p style={{ margin: 0, color: 'var(--muted, #8C9AB8)', fontSize: '14px' }}>
          All pills, chips, tiles, and widgets in every supported state per DESIGN-REFERENCE.md and reference.png.
        </p>
      </div>

      {/* InfoBanner Strip Showcase */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted, #8C9AB8)', textTransform: 'uppercase', marginBottom: '10px' }}>
          InfoBanner (Persistent Subtle Absence ≠ Failure Strip)
        </h3>
        <div style={{ border: '1px solid var(--border, #1A2748)', borderRadius: '8px', overflow: 'hidden' }}>
          <InfoBanner />
        </div>
      </div>

      {/* Status Pills */}
      <div className="reference-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0' }}>
          1. StatusPill (All States — Invariant #10: Not Demonstrated is Slate Dashed, NEVER Red)
        </h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <StatusPill status="DEMONSTRATED" size="lg" />
          <StatusPill status="DEMONSTRATED" size="md" />
          <StatusPill status="DEMONSTRATED" size="sm" />
          <StatusPill status="PARTIAL" size="md" />
          <StatusPill status="NOT_DEMONSTRATED" size="md" />
          <StatusPill status="UNABLE_TO_ASSESS" size="md" />
        </div>
      </div>

      {/* Strength Labels */}
      <div className="reference-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0' }}>
          2. StrengthLabel (Signal Verification Tiers)
        </h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <StrengthLabel strength="strong" />
          <StrengthLabel strength="moderate" />
          <StrengthLabel strength="weak" />
          <StrengthLabel strength="none" />
        </div>
      </div>

      {/* Chips & Badges Row */}
      <div className="reference-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0' }}>
          3. System & Context Chips (ShaChip, SourceBadge, UpdatedChip, WatcherChip, LlmChip, RateLimitChip, LiveChip)
        </h3>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <ShaChip sha="c3d4e5f67890123456789abcdef0123456789012" branch="main" />
          <SourceBadge sourceType="fetched" sourceUrl="https://jobs.example.com" />
          <SourceBadge sourceType="user_provided" />
          <UpdatedChip type="files" count={2} />
          <UpdatedChip type="files" count={1} />
          <UpdatedChip type="no_change" />
          <UpdatedChip type="reassessed" />
          <WatcherChip mode="webhook" />
          <WatcherChip mode="polling" nextPollInSeconds={15} />
          <LlmChip mode="ai_on" />
          <LlmChip mode="deterministic" />
          <RateLimitChip remaining={4982} total={5000} />
          <LiveChip label="Live" />
        </div>
      </div>

      {/* Skill Icon Tiles */}
      <div className="reference-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0' }}>
          4. SkillIconTile (Rounded-square Lucide icon tiles)
        </h3>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <SkillIconTile skill="Python" size="lg" />
            <span style={{ fontSize: '11px', color: 'var(--muted, #8C9AB8)' }}>Python</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <SkillIconTile skill="FastAPI" size="lg" />
            <span style={{ fontSize: '11px', color: 'var(--muted, #8C9AB8)' }}>FastAPI</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <SkillIconTile skill="SQL Database" size="lg" />
            <span style={{ fontSize: '11px', color: 'var(--muted, #8C9AB8)' }}>SQL</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <SkillIconTile skill="Testing" size="lg" />
            <span style={{ fontSize: '11px', color: 'var(--muted, #8C9AB8)' }}>Testing</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <SkillIconTile skill="Deployment" size="lg" />
            <span style={{ fontSize: '11px', color: 'var(--muted, #8C9AB8)' }}>Deployment</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <SkillIconTile skill="Git & GitHub" size="lg" />
            <span style={{ fontSize: '11px', color: 'var(--muted, #8C9AB8)' }}>Git</span>
          </div>
        </div>
      </div>

      {/* StatCards */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0' }}>
          5. StatCard (Top row metrics with rounded-square icon, value, sub-line, link)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
          <StatCard
            icon={<Briefcase size={20} />}
            label="Active Job"
            value="Software Developer Intern"
            subLine="Google · Posted 3 days ago"
            actionText="View Job >"
          />
          <StatCard
            icon={<GitBranch size={20} />}
            iconBg="linear-gradient(135deg, rgba(100, 116, 139, 0.3) 0%, rgba(51, 65, 85, 0.5) 100%)"
            iconColor="#CBD5E1"
            label="Connected Repository"
            value="rohan-dev/portfolio"
            subLine="Last commit: 2 hours ago"
            actionText="View Repo >"
          />
          <StatCard
            icon={<CheckCircle2 size={20} />}
            iconBg="linear-gradient(135deg, rgba(52, 211, 153, 0.25) 0%, rgba(16, 149, 106, 0.45) 100%)"
            iconColor="#34D399"
            label="Last Assessment"
            value="2 hours ago"
            subLine="4 skills updated"
            actionText="View Details >"
          />
        </div>
      </div>

      {/* SegmentedRing */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0' }}>
          6. SegmentedRing (Counts by status, center "X of N demonstrated", STRICTLY NO %)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
          <SegmentedRing demonstrated={4} partial={1} notDemonstrated={1} total={6} />
          <SegmentedRing demonstrated={2} partial={1} notDemonstrated={2} total={5} />
        </div>
      </div>

      {/* AgentRow & StepperHeader */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* AgentRow */}
        <div className="reference-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
              7. AgentRow (Agent icon, name, message, time)
            </h3>
            <LiveChip label="Live" size="sm" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <AgentRow
              agent="Code Analyzer"
              message="Parsed 12 files for skill matching"
              timestamp="2m ago"
            />
            <AgentRow
              agent="Evidence Collector"
              message="Found 3 new evidence snippets"
              timestamp="3m ago"
            />
            <AgentRow
              agent="Verifier"
              message="Validated 3 citations against AST"
              timestamp="4m ago"
            />
            <AgentRow
              agent="Impact Analyzer"
              message="Detected 2 changed skills (SQL, Testing)"
              timestamp="5m ago"
            />
          </div>
        </div>

        {/* StepperHeader & ChecklistItem */}
        <div className="reference-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0' }}>
            8. StepperHeader & ChecklistItem (No Red ✕ Invariant)
          </h3>
          <div style={{ marginBottom: '20px' }}>
            <StepperHeader
              steps={[
                { id: 1, label: 'Job URL' },
                { id: 2, label: 'Repository' },
                { id: 3, label: 'Analysis' },
              ]}
              currentStep={2}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <ChecklistItem label="Basic queries" status="completed" subText="✓ Found in models.py" />
            <ChecklistItem label="Joins and relationships" status="partial" subText="◐ Simple joins only" />
            <ChecklistItem label="Query optimization" status="pending" subText="○ Not demonstrated in scope" />
            <ChecklistItem label="Database migrations" status="warning" subText="⚠ SQLite used, no migrations" />
          </div>
        </div>
      </div>
    </div>
  );
};
