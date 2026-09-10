import { describe, expect, it } from 'vitest';

interface SetupQuestion {
  id: string;
  question: string;
  suggestions: string[];
  control: string;
}

function getWizardState({
  questions,
  answers,
  editingKey,
}: {
  questions: SetupQuestion[];
  answers: Record<string, { value: string | string[] }>;
  editingKey?: string;
}) {
  const unanswered = questions.filter((q) => !answers[q.id]);
  const answered = questions.filter((q) => Boolean(answers[q.id]));
  const total = questions.length;
  const completed = answered.length;
  const isCompleted = total > 0 && completed === total && !editingKey;

  const activeQuestion = editingKey
    ? questions.find((q) => q.id === editingKey) || null
    : unanswered[0] || null;

  const currentStepNumber = editingKey
    ? questions.findIndex((q) => q.id === editingKey) + 1
    : total > 0
    ? Math.min(completed + 1, total)
    : 0;

  const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    unanswered,
    answered,
    total,
    completed,
    isCompleted,
    activeQuestion,
    currentStepNumber,
    progressPercentage,
  };
}

describe('GuidedBusinessWizard logic and progression flow', () => {
  const mockQuestions: SetupQuestion[] = [
    {
      id: 'delivery_charge',
      question: 'What is your delivery charge?',
      suggestions: ['Inside Dhaka ৳80, Outside ৳130', 'Free delivery nationwide'],
      control: 'currency',
    },
    {
      id: 'return_policy',
      question: 'What is your return window?',
      suggestions: ['7 days return', 'No returns once opened'],
      control: 'text',
    },
    {
      id: 'cod_available',
      question: 'Is Cash on Delivery available?',
      suggestions: ['COD available nationwide', 'Full prepayment required'],
      control: 'text',
    },
  ];

  it('shows only the first unanswered question initially with 0% progress', () => {
    const state = getWizardState({
      questions: mockQuestions,
      answers: {},
    });

    expect(state.completed).toBe(0);
    expect(state.total).toBe(3);
    expect(state.progressPercentage).toBe(0);
    expect(state.currentStepNumber).toBe(1);
    expect(state.activeQuestion?.id).toBe('delivery_charge');
    expect(state.isCompleted).toBe(false);
  });

  it('advances to next question automatically when active question is answered', () => {
    const state = getWizardState({
      questions: mockQuestions,
      answers: {
        delivery_charge: { value: 'Inside Dhaka ৳80, Outside ৳130' },
      },
    });

    expect(state.completed).toBe(1);
    expect(state.currentStepNumber).toBe(2);
    expect(state.progressPercentage).toBe(33);
    expect(state.activeQuestion?.id).toBe('return_policy');
    expect(state.answered.length).toBe(1);
  });

  it('allows editing a previously answered question while keeping active state scoped', () => {
    const state = getWizardState({
      questions: mockQuestions,
      answers: {
        delivery_charge: { value: 'Inside Dhaka ৳80, Outside ৳130' },
      },
      editingKey: 'delivery_charge',
    });

    expect(state.activeQuestion?.id).toBe('delivery_charge');
    expect(state.currentStepNumber).toBe(1);
  });

  it('identifies completion when all setup questions are answered', () => {
    const state = getWizardState({
      questions: mockQuestions,
      answers: {
        delivery_charge: { value: 'Inside Dhaka ৳80, Outside ৳130' },
        return_policy: { value: '7 days return' },
        cod_available: { value: 'COD available nationwide' },
      },
    });

    expect(state.completed).toBe(3);
    expect(state.progressPercentage).toBe(100);
    expect(state.isCompleted).toBe(true);
    expect(state.activeQuestion).toBeNull();
  });
});
