import React from 'react';
import { Check } from 'lucide-react';

export interface StepItem {
  id: number;
  label: string;
}

export interface StepperHeaderProps {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (stepId: number) => void;
  className?: string;
}

export const StepperHeader: React.FC<StepperHeaderProps> = ({
  steps,
  currentStep,
  onStepClick,
  className = '',
}) => {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        maxWidth: '480px',
        margin: '0 auto 28px',
      }}
    >
      {steps.map((step, idx) => {
        const isCurrent = step.id === currentStep;
        const isCompleted = step.id < currentStep;
        const isLast = idx === steps.length - 1;

        return (
          <React.Fragment key={step.id}>
            {/* Step node */}
            <div
              onClick={() => onStepClick && onStepClick(step.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: onStepClick ? 'pointer' : 'default',
                userSelect: 'none',
              }}
            >
              {/* Number circle */}
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                  backgroundColor: isCurrent
                    ? '#2F6DF6'
                    : isCompleted
                    ? 'rgba(52, 211, 153, 0.15)'
                    : 'var(--surface-2, #101A30)',
                  color: isCurrent
                    ? '#FFFFFF'
                    : isCompleted
                    ? '#34D399'
                    : 'var(--muted, #8C9AB8)',
                  border: isCurrent
                    ? '1px solid #3B82F6'
                    : isCompleted
                    ? '1px solid rgba(52, 211, 153, 0.4)'
                    : '1px solid var(--border, #1A2748)',
                  boxShadow: isCurrent ? '0 0 12px rgba(47, 109, 246, 0.4)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {isCompleted ? <Check size={13} strokeWidth={2.5} /> : step.id}
              </div>

              {/* Label */}
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: isCurrent ? 600 : 500,
                  color: isCurrent
                    ? 'var(--text, #E8EEF9)'
                    : isCompleted
                    ? 'var(--text, #E8EEF9)'
                    : 'var(--muted, #8C9AB8)',
                  whiteSpace: 'nowrap',
                }}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                style={{
                  flex: 1,
                  height: '2px',
                  margin: '0 12px',
                  backgroundColor: isCompleted
                    ? 'rgba(52, 211, 153, 0.4)'
                    : 'var(--border, #1A2748)',
                  transition: 'background-color 0.2s ease',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
