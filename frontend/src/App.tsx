import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Dashboard } from './components/Dashboard';
import { AddJobWizard } from './components/AddJobWizard';
import { ResultsView } from './components/ResultsView';
import { RepositoriesView } from './components/RepositoriesView';
import { AgentActivityView } from './components/AgentActivityView';
import { CompareView } from './components/CompareView';
import { DevComponentsShowcase } from './components/DevComponentsShowcase';
import type { JobDraft, TrackOpportunity, RecentChange, NextAction } from './types';
import trackC2 from '../../docs/fixtures/track_assessment_c2.json';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(
    typeof window !== 'undefined' ? window.location.pathname || '/' : '/'
  );
  const [selectedTrackId, setSelectedTrackId] = useState<string>('track_demo');

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  // Tracked Opportunities state initialized with canonical C2 fixture (6 skills)
  const [opportunities, setOpportunities] = useState<TrackOpportunity[]>([
    trackC2 as unknown as TrackOpportunity,
  ]);

  // Recent changes feed
  const recentChanges: RecentChange[] = [
    {
      id: 'change_c2',
      commit_sha: 'c3d4e5f67890123456789abcdef0123456789012',
      commit_message: 'feat(db): add sqlite database and tests',
      author: 'Rohan',
      timestamp: '12m ago via webhook',
      files_changed_count: 3,
      skills_reassessed: ['SQL Database', 'Testing', 'REST APIs', 'Python'],
      skills_unchanged: ['Deployment'],
      transitions: [
        {
          skill: 'SQL Database',
          before: 'NOT_DEMONSTRATED',
          after: 'DEMONSTRATED',
          change: 'improved',
        },
        {
          skill: 'Testing',
          before: 'NOT_DEMONSTRATED',
          after: 'PARTIAL',
          change: 'improved',
        },
      ],
    },
  ];

  // Next actions
  const nextActions: NextAction[] = [
    {
      id: 'act_1',
      skill: 'SQL Database',
      title: 'PostgreSQL Migration',
      detail: 'Add SQLAlchemy or Alembic migrations targeting PostgreSQL to meet enterprise job requirements.',
      priority: 'must',
      target_file: 'app/db.py',
    },
    {
      id: 'act_2',
      skill: 'Testing',
      title: 'CI Test Execution',
      detail: 'Set up GitHub Actions workflow (.github/workflows/test.yml) to run pytest check-runs on every push.',
      priority: 'must',
      target_file: '.github/workflows/test.yml',
    },
    {
      id: 'act_3',
      skill: 'Deployment',
      title: 'Containerization',
      detail: 'Add a Dockerfile with multi-stage build referencing the FastAPI application.',
      priority: 'nice',
      target_file: 'Dockerfile',
    },
  ];

  const handleWizardComplete = (job: JobDraft, repoUrl: string) => {
    const newOpportunity: TrackOpportunity = {
      id: `track_${Date.now()}`,
      job,
      repo: {
        id: `repo_${Date.now()}`,
        owner: repoUrl.split('/')[3] || 'user',
        name: repoUrl.split('/')[4] || 'candidate-repo',
        default_branch: 'main',
        html_url: repoUrl,
        webhook_status: 'registered',
      },
      branch: 'main',
      last_seen_sha: 'a1b2c3d4e5f67890123456789abcdef012345678',
      last_assessed_at: 'Just now',
      watcher_mode: 'polling',
      status_summary: {
        demonstrated: 1,
        partial: 1,
        not_demonstrated: job.requirements.length - 2,
        unable: 0,
      },
      assessments: job.requirements.map((req, idx) => ({
        id: `asmt_${idx}`,
        analysis_id: 'analysis_initial',
        requirement_id: req.id,
        status: idx === 0 ? 'DEMONSTRATED' : idx === 1 ? 'PARTIAL' : 'NOT_DEMONSTRATED',
        strength: idx === 0 ? 'strong' : idx === 1 ? 'moderate' : 'none',
        summary: `Initial automated assessment for ${req.name}.`,
        limitation: idx > 1 ? 'No evidence found in repository files analyzed.' : 'Scope is limited.',
        next_step: `Implement verified patterns for ${req.name}.`,
        carried_forward: false,
        reassessed: true,
        ignored_signals: [],
        ai_used: true,
        evidence: [],
      })),
    };

    setOpportunities((prev) => [newOpportunity, ...prev]);
    navigate('/');
  };

  const activeTrack = opportunities.find((o) => o.id === selectedTrackId) || opportunities[0];

  // Route resolver
  const renderContent = () => {
    if (currentPath === '/dev/components') {
      return <DevComponentsShowcase />;
    }
    if (currentPath === '/add-job') {
      return (
        <AddJobWizard
          onComplete={handleWizardComplete}
          onCancel={() => navigate('/')}
        />
      );
    }
    if (currentPath === '/repositories') {
      return (
        <RepositoriesView
          repoOwner={activeTrack?.repo?.owner}
          repoName={activeTrack?.repo?.name}
          branch={activeTrack?.branch}
          lastSha={activeTrack?.last_seen_sha}
          onRunAssessment={() => navigate(`/tracks/${activeTrack?.id}`)}
        />
      );
    }
    if (currentPath === '/activity') {
      return <AgentActivityView />;
    }
    if (currentPath.includes('/changes') || currentPath.includes('/compare')) {
      return (
        <CompareView
          onBack={() => navigate(`/tracks/${activeTrack?.id}`)}
          onViewReport={() => navigate(`/tracks/${activeTrack?.id}`)}
        />
      );
    }
    if (currentPath.startsWith('/tracks/')) {
      const match = currentPath.match(/^\/tracks\/([^/]+)(?:\/skills\/([^/]+))?/);
      const trackId = match ? match[1] : activeTrack?.id || 'track_demo';
      const reqId = match && match[2] ? match[2] : 'req_sql_database';

      return (
        <ResultsView
          track={activeTrack}
          requirementId={reqId}
          onBackToDashboard={() => navigate('/')}
          onSelectSkill={(newReqId) => navigate(`/tracks/${trackId}/skills/${newReqId}`)}
        />
      );
    }

    // Default: Home / Dashboard (/)
    return (
      <Dashboard
        opportunities={opportunities}
        recentChanges={recentChanges}
        nextActions={nextActions}
        onAddJob={() => navigate('/add-job')}
        onSelectTrack={(id, reqId) => {
          setSelectedTrackId(id);
          navigate(`/tracks/${id}/skills/${reqId || 'req_sql_database'}`);
        }}
        onNavigateActivity={() => navigate('/activity')}
      />
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--bg, #050A1A)',
        color: 'var(--text, #E8EEF9)',
      }}
    >
      {/* Left Sidebar */}
      <Sidebar
        currentPath={currentPath}
        onNavigate={navigate}
        trackId={selectedTrackId}
      />

      {/* Main Column */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflowX: 'hidden',
        }}
      >
        {/* Top Header Bar */}
        <TopBar
          watcherMode="webhook"
          nextPollInSeconds={15}
          llmMode="ai_on"
          rateLimitRemaining={4982}
          onNavigate={navigate}
        />

        {/* Viewport Content */}
        <main style={{ flex: 1 }}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
