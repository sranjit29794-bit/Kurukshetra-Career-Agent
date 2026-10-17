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
import { ClaimsMatrixView } from './components/ClaimsMatrixView';
import type { JobDraft, TrackOpportunity, RecentChange, NextAction } from './types';
import { DEV_FIXTURES } from './lib/devFixtures';
import { api, FORCE_FIXTURES } from './lib/api';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(
    typeof window !== 'undefined' ? window.location.pathname || '/' : '/'
  );
  const [selectedTrackId, setSelectedTrackId] = useState<string>('');

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

  // Tracked Opportunities state (loads real tracks from SQLite DB; fixture only if VITE_USE_FIXTURES=1)
  const [opportunities, setOpportunities] = useState<TrackOpportunity[]>(
    FORCE_FIXTURES ? [DEV_FIXTURES.trackC2 as unknown as TrackOpportunity] : []
  );

  const [healthInfo, setHealthInfo] = useState<{
    watcherMode: 'webhook' | 'polling';
    nextPollInSeconds: number;
    llmMode: 'ai_on' | 'deterministic';
    rateLimitRemaining: number;
    mode: 'real' | 'fixtures';
  }>({
    watcherMode: 'polling',
    nextPollInSeconds: 15,
    llmMode: 'ai_on',
    rateLimitRemaining: 5000,
    mode: FORCE_FIXTURES ? 'fixtures' : 'real',
  });

  // Load real health and real tracks on mount
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const health = await api.getHealth();
        if (isMounted && health) {
          setHealthInfo({
            watcherMode: health.watcher === 'webhook' ? 'webhook' : 'polling',
            nextPollInSeconds: health.next_poll_in_s || 15,
            llmMode: health.llm === 'disabled' ? 'deterministic' : 'ai_on',
            rateLimitRemaining: health.rate_remaining ?? 5000,
            mode: health.mode === 'fixtures' ? 'fixtures' : 'real',
          });
        }
      } catch (err) {
        console.warn('Could not fetch health from backend:', err);
      }

      if (!FORCE_FIXTURES) {
        try {
          const realTracks = await api.getTracks();
          if (isMounted && realTracks) {
            setOpportunities(realTracks);
            if (realTracks.length > 0) {
              setSelectedTrackId(realTracks[0].id);
            }
          }
        } catch (err) {
          console.warn('Could not fetch real tracks from backend:', err);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

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

  const handleWizardComplete = async (job: JobDraft, repoUrl: string) => {
    if (!FORCE_FIXTURES) {
      try {
        const savedJob = await api.saveJob(job);
        const trackResp = await api.createTrack({
          jobId: String(savedJob.id || job.id || ''),
          repoUrl,
        });
        try {
          await api.checkNow(trackResp.id);
        } catch {
          // ignore if check offline
        }
        const refreshed = await api.getTracks();
        setOpportunities(refreshed);
        setSelectedTrackId(trackResp.id);
        navigate(`/tracks/${trackResp.id}`);
        return;
      } catch (err: any) {
        console.error('Failed to create track in backend:', err);
        alert(`Failed to save job and create track: ${err.message || 'Unknown error'}`);
        return;
      }
    }

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
          onViewClaimsMatrix={(jobId) => navigate(`/jobs/${jobId}/claims`)}
        />
      );
    }
    if (currentPath.startsWith('/jobs/') && currentPath.includes('/claims')) {
      const match = currentPath.match(/^\/jobs\/([^/]+)\/claims/);
      const jobId = match ? match[1] : 'job_devproof_demo';
      return (
        <ClaimsMatrixView
          jobId={jobId}
          onBackToDashboard={() => navigate('/')}
          onProceedToAssessment={(trackId) => navigate(`/tracks/${trackId}/skills/req_sql_database`)}
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
          trackId={activeTrack?.id}
          repoOwner={activeTrack?.repo?.owner}
          repoName={activeTrack?.repo?.name}
          onBack={() => navigate(activeTrack?.id ? `/tracks/${activeTrack.id}` : '/')}
          onViewReport={() => navigate(activeTrack?.id ? `/tracks/${activeTrack.id}` : '/')}
        />
      );
    }
    if (currentPath.startsWith('/tracks')) {
      const match = currentPath.match(/^\/tracks\/([^/]+)(?:\/skills\/([^/]+))?/);
      const urlTrackId = match ? match[1] : '';
      const targetTrack = opportunities.find((o) => o.id === urlTrackId) || activeTrack;
      const firstReqId = targetTrack?.job?.requirements?.[0]?.id || 'req_sql_database';
      const reqId = match && match[2] ? match[2] : firstReqId;

      return (
        <ResultsView
          track={targetTrack}
          requirementId={reqId}
          onBackToDashboard={() => navigate('/')}
          onSelectSkill={(newReqId) =>
            navigate(targetTrack?.id ? `/tracks/${targetTrack.id}/skills/${newReqId}` : `/tracks/skills/${newReqId}`)
          }
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
        onNavigateCompare={() => navigate('/changes')}
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
          watcherMode={healthInfo.watcherMode}
          nextPollInSeconds={healthInfo.nextPollInSeconds}
          llmMode={healthInfo.llmMode}
          rateLimitRemaining={healthInfo.rateLimitRemaining}
          isFixtureMode={FORCE_FIXTURES || healthInfo.mode === 'fixtures'}
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
