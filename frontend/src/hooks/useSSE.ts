import { useState, useEffect, useCallback, useRef } from 'react';
import type { AgentEvent } from '../types';

export interface UseSSEOptions {
  trackId?: string;
  fixtureMode?: boolean;
  onAnalysisComplete?: (newCommitSha: string) => void;
}

export interface UseSSEResult {
  isConnected: boolean;
  isReassessing: boolean;
  reassessingSkills: string[];
  recentlyUpdatedSkills: string[];
  activeSha: string;
  toastMessage: string | null;
  agentEvents: AgentEvent[];
  simulateLivePush: (commitType?: 'c2' | 'c1') => void;
  clearToast: () => void;
}

export function useSSE(options: UseSSEOptions = {}): UseSSEResult {
  const { trackId = 'track_demo', fixtureMode = true, onAnalysisComplete } = options;

  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isReassessing, setIsReassessing] = useState<boolean>(false);
  const [reassessingSkills, setReassessingSkills] = useState<string[]>([]);
  const [recentlyUpdatedSkills, setRecentlyUpdatedSkills] = useState<string[]>([]);
  const [activeSha, setActiveSha] = useState<string>('c3d4e5f67890123456789abcdef0123456789012');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  // Simulate the canonical §19.2 demo push
  const simulateLivePush = useCallback(
    (commitType: 'c2' | 'c1' = 'c2') => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (commitType === 'c1') {
        // C1 README-only commit (BRAIN §15.1, §19.1)
        const c1Sha = 'b2c3d4e5f67890123456789abcdef01234567890';
        setActiveSha(c1Sha);
        setToastMessage('New push detected (b2c3d4e) → docs only, no skill change');

        const newEvent: AgentEvent = {
          id: `ev_${Date.now()}`,
          analysis_id: 'analysis_c1',
          agent: 'Change Sentinel',
          message: 'Commit touches README.md only → skipping reassessment per Invariant #7 (docs only)',
          level: 'info',
          created_at: new Date().toISOString(),
        };
        setAgentEvents((prev) => [newEvent, ...prev]);

        timeoutRef.current = setTimeout(() => {
          setToastMessage(null);
        }, 4500);
        return;
      }

      // C2 Live Push: adds SQL queries and tests (BRAIN §19.1, §19.2)
      const c2Sha = 'c3d4e5f67890123456789abcdef0123456789012';
      setIsReassessing(true);
      setReassessingSkills(['req_sql_database', 'req_testing', 'req_rest_api', 'req_python']);
      setRecentlyUpdatedSkills([]);
      setToastMessage('New push detected (c3d4e5f) → reassessing 4 skills…');

      // Add Change Sentinel event
      const sentinelEvent: AgentEvent = {
        id: `ev_${Date.now()}_1`,
        analysis_id: 'analysis_c2',
        agent: 'Change Sentinel',
        message: 'Detected push c3d4e5f on branch main • 3 files changed (app/db.py, app/main.py, tests/test_db.py)',
        level: 'info',
        created_at: new Date().toISOString(),
      };
      setAgentEvents((prev) => [sentinelEvent, ...prev]);

      // Stage 2: Evidence Analyst & Verifier steps (1.2s)
      setTimeout(() => {
        const analystEvent: AgentEvent = {
          id: `ev_${Date.now()}_2`,
          analysis_id: 'analysis_c2',
          agent: 'Evidence Analyst',
          message: 'Found strong SQL signal in app/db.py:12-30 and testing signal in tests/test_db.py:8-24',
          level: 'info',
          created_at: new Date().toISOString(),
        };
        const verifierEvent: AgentEvent = {
          id: `ev_${Date.now()}_3`,
          analysis_id: 'analysis_c2',
          agent: 'Verifier',
          message: 'Validated line citations at commit SHA c3d4e5f (0 mismatches; Invariant #6 cap applied)',
          level: 'info',
          created_at: new Date().toISOString(),
        };
        setAgentEvents((prev) => [verifierEvent, analystEvent, ...prev]);
      }, 1200);

      // Stage 3: Completion flip & highlight animation (2.5s)
      timeoutRef.current = setTimeout(() => {
        setIsReassessing(false);
        setReassessingSkills([]);
        setRecentlyUpdatedSkills(['req_sql_database', 'req_testing', 'req_rest_api', 'req_python']);
        setActiveSha(c2Sha);

        const coachEvent: AgentEvent = {
          id: `ev_${Date.now()}_4`,
          analysis_id: 'analysis_c2',
          agent: 'Coach',
          message: 'Drafted diff explanation: SQL moved Not demonstrated → Demonstrated; Testing moved to Partially demonstrated',
          level: 'info',
          created_at: new Date().toISOString(),
        };
        setAgentEvents((prev) => [coachEvent, ...prev]);
        setToastMessage('Reassessment complete: SQL Demonstrated (✓), Testing Partial (◐)');

        if (onAnalysisComplete) {
          onAnalysisComplete(c2Sha);
        }

        // Clear highlight ring after 3.5s
        setTimeout(() => {
          setRecentlyUpdatedSkills([]);
          setToastMessage(null);
        }, 4000);
      }, 2500);
    },
    [onAnalysisComplete]
  );

  // Real backend SSE connection if not in fixture mode
  useEffect(() => {
    if (fixtureMode) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/events/stream?track_id=${trackId}`);

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.addEventListener('change_detected', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setToastMessage(`New push detected (${data.sha?.substring(0, 7) || 'HEAD'}) → reassessing…`);
          setIsReassessing(true);
          if (data.impacted_skills) {
            setReassessingSkills(data.impacted_skills);
          }
        } catch {
          // parse error fallback
        }
      });

      eventSource.addEventListener('analysis_complete', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setIsReassessing(false);
          setReassessingSkills([]);
          if (data.sha) setActiveSha(data.sha);
          setToastMessage('Reassessment complete: view updated skills');
          if (onAnalysisComplete) onAnalysisComplete(data.sha);
        } catch {
          // parse error fallback
        }
      });

      eventSource.addEventListener('agent_event', (e: MessageEvent) => {
        try {
          const event = JSON.parse(e.data) as AgentEvent;
          setAgentEvents((prev) => [event, ...prev]);
        } catch {
          // parse error fallback
        }
      });

      eventSource.onerror = () => {
        setIsConnected(false);
      };
    } catch {
      // EventSource failed to instantiate
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [trackId, fixtureMode, onAnalysisComplete]);

  return {
    isConnected,
    isReassessing,
    reassessingSkills,
    recentlyUpdatedSkills,
    activeSha,
    toastMessage,
    agentEvents,
    simulateLivePush,
    clearToast,
  };
}
