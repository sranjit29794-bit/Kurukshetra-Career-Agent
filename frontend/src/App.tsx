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

  // Tracked Opportunities state
  const [opportunities, setOpportunities] = useState<TrackOpportunity[]>([
    {
      id: 'track_demo',
      job: {
        id: 'job_devproof_demo',
        title: 'Backend Engineering Intern (Python/FastAPI)',
        company: 'Kinetik Health',
        source_url: 'https://jobs.example.com/kinetik/backend-intern',
        source_type: 'fetched',
        requirements: [
          {
            id: 'req_rest_api',
            name: 'REST APIs',
            category: 'Backend',
            priority: 'must',
            source_sentence: 'Proficient in Python and FastAPI to build clean REST APIs.',
            taxonomy_key: 'rest_api',
          },
          {
            id: 'req_sql_database',
            name: 'SQL Database',
            category: 'Database',
            priority: 'must',
            source_sentence: 'You will work with SQL databases.',
            taxonomy_key: 'sql_database',
          },
          {
            id: 'req_testing',
            name: 'Testing',
            category: 'Quality Assurance',
            priority: 'must',
            source_sentence: 'Write unit and integration tests.',
            taxonomy_key: 'testing',
          },
          {
            id: 'req_deployment',
            name: 'Deployment',
            category: 'DevOps',
            priority: 'nice',
            source_sentence: 'Help containerize services for deployment.',
            taxonomy_key: 'deployment',
          },
          {
            id: 'req_python',
            name: 'Python',
            category: 'Language',
            priority: 'must',
            source_sentence: 'Proficient in Python.',
            taxonomy_key: 'python',
          },
        ],
      },
      repo: {
        id: 'repo_student_api',
        owner: 'rohan-student',
        name: 'student-api',
        default_branch: 'main',
        html_url: 'https://github.com/rohan-student/student-api',
        webhook_status: 'registered',
      },
      branch: 'main',
      last_seen_sha: 'c3d4e5f67890123456789abcdef0123456789012',
      last_assessed_at: '12 minutes ago',
      watcher_mode: 'webhook',
      status_summary: {
        demonstrated: 3,
        partial: 1,
        not_demonstrated: 1,
        unable: 0,
      },
      assessments: [
        {
          id: 'asmt_c2_rest',
          analysis_id: 'analysis_c2',
          requirement_id: 'req_rest_api',
          status: 'DEMONSTRATED',
          strength: 'strong',
          summary: 'FastAPI routes invoke persistent SQL queries from db.py with typed Pydantic response models.',
          limitation: 'Route handlers catch generic exceptions without specific HTTP status code differentiation.',
          next_step: 'Implement dedicated HTTP 404 / 400 exception handlers.',
          carried_forward: false,
          reassessed: true,
          ignored_signals: [],
          ai_used: true,
          evidence: [
            {
              id: 'ev_c2_rest_1',
              signal_id: 'sig_rest_main_15_38',
              detector: 'rest_api',
              file_path: 'app/main.py',
              line_start: 15,
              line_end: 38,
              snippet: "@app.get('/items')\ndef list_items():\n    return db.get_items()\n\n@app.post('/items')\ndef create_item(item: ItemCreate):\n    return db.insert_item(item.name, item.price)",
              blob_sha: 'blob_c2_main',
              strength: 'strong',
              counted: true,
            },
          ],
        },
        {
          id: 'asmt_c2_sql',
          analysis_id: 'analysis_c2',
          requirement_id: 'req_sql_database',
          status: 'DEMONSTRATED',
          strength: 'strong',
          summary: 'Parameterized SQL queries implemented in db.py using sqlite3 with proper placeholder binding (? args).',
          limitation: 'Database queries use local SQLite file; production PostgreSQL migrations and pooling are not yet configured.',
          next_step: 'Add SQLAlchemy or Alembic schema migrations targeting PostgreSQL.',
          carried_forward: false,
          reassessed: true,
          ignored_signals: [],
          ai_used: true,
          evidence: [
            {
              id: 'ev_c2_sql_1',
              signal_id: 'sig_sql_db_12_30',
              detector: 'sql_database',
              file_path: 'app/db.py',
              line_start: 12,
              line_end: 30,
              snippet: "def insert_item(name: str, price: float):\n    with get_connection() as conn:\n        cursor = conn.cursor()\n        cursor.execute('INSERT INTO items (name, price) VALUES (?, ?)', (name, price))\n        conn.commit()\n        return {'id': cursor.lastrowid, 'name': name, 'price': price}",
              blob_sha: 'blob_c2_db',
              strength: 'strong',
              counted: true,
            },
          ],
        },
        {
          id: 'asmt_c2_testing',
          analysis_id: 'analysis_c2',
          requirement_id: 'req_testing',
          status: 'PARTIAL',
          strength: 'moderate',
          summary: 'Automated unit tests added in tests/test_db.py with assertions verifying database inserts and queries against a temporary DB.',
          limitation: 'Testing status is capped at Partially demonstrated because tests exist in repo but have not been verified via executed test runners or CI check-runs.',
          next_step: 'Set up a GitHub Actions workflow to run pytest and record passing test results.',
          carried_forward: false,
          reassessed: true,
          ignored_signals: [],
          ai_used: true,
          evidence: [
            {
              id: 'ev_c2_test_1',
              signal_id: 'sig_test_db_8_24',
              detector: 'testing',
              file_path: 'tests/test_db.py',
              line_start: 8,
              line_end: 24,
              snippet: "def test_insert_and_get_item(temp_db):\n    res = db.insert_item('Book', 19.99)\n    assert res['id'] is not None\n    items = db.get_items()\n    assert len(items) == 1\n    assert items[0]['name'] == 'Book'",
              blob_sha: 'blob_c2_test',
              strength: 'strong',
              counted: true,
            },
          ],
        },
        {
          id: 'asmt_c2_deployment',
          analysis_id: 'analysis_c2',
          requirement_id: 'req_deployment',
          status: 'NOT_DEMONSTRATED',
          strength: 'none',
          summary: 'No deployment configuration found in analyzed repository files.',
          limitation: 'No Dockerfile or deploy manifests were committed.',
          next_step: 'Add a Dockerfile or deployment manifest.',
          carried_forward: true,
          reassessed: false,
          ignored_signals: [],
          ai_used: false,
          evidence: [],
        },
        {
          id: 'asmt_c2_python',
          analysis_id: 'analysis_c2',
          requirement_id: 'req_python',
          status: 'DEMONSTRATED',
          strength: 'strong',
          summary: 'Python backend expanded with modular database access and helper context managers.',
          limitation: 'Exception handling remains rudimentary.',
          next_step: 'Add custom application exception hierarchy.',
          carried_forward: false,
          reassessed: true,
          ignored_signals: [],
          ai_used: true,
          evidence: [
            {
              id: 'ev_c2_py_1',
              signal_id: 'sig_py_db_1_20',
              detector: 'python',
              file_path: 'app/db.py',
              line_start: 1,
              line_end: 20,
              snippet: "import sqlite3\nfrom contextlib import contextmanager\n\n@contextmanager\ndef get_connection():\n    conn = sqlite3.connect('dev.db')\n    try:\n        yield conn\n    finally:\n        conn.close()",
              blob_sha: 'blob_c2_db',
              strength: 'strong',
              counted: true,
            },
          ],
        },
      ],
    },
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
      return (
        <ResultsView
          track={activeTrack}
          onBackToDashboard={() => navigate('/')}
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
        onSelectTrack={(id) => {
          setSelectedTrackId(id);
          navigate(`/tracks/${id}`);
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
