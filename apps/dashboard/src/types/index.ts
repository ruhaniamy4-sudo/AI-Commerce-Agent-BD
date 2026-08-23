export * from '@edutechs/shared';

// Dashboard Specific Chart Types (not in shared)
export interface AnalyticsResponse {
    kpi: {
        totalCustomers: number;
        totalOrders: number;
        pendingOrders: number;
        conversionRate?: string | number;
    };
    funnel?: {
        stage: string;
        count: number;
    }[];
    institutes?: {
        name: string;
        value: number;
    }[];
    executives?: {
        name: string;
        leads: number;
        closed: number;
    }[];
    growth?: {
        date: string;
        count: number;
    }[];
}

// System Prompt (might not be in shared yet)
export interface SystemPrompt {
    _id: string;
    name: string;
    content: string;
    description?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Meeting {
    _id: string;
    customerId: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    status: 'scheduled' | 'completed' | 'cancelled';
    location?: string;
    googleCalendarEventId?: string;
    createdAt: string;
    updatedAt: string;
    customer?: {
        name: string;
        email: string;
    };
}

export interface AvailabilitySettings {
    _id: string;
    workingDays: number[];
    officeHours: {
        start: string;
        end: string;
    };
    breaks: Array<{
        name: string;
        start: string;
        end: string;
    }>;
    meetingBuffer: number;
    updatedAt: string;
}

export interface MeetingHost {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
    isActive: boolean;
}

export interface UnansweredQuestion {
    _id: string;
    query: string;
    frequency: number;
    lastAsked: string;
    status: 'pending' | 'resolved' | 'ignored';
    metadata?: Record<string, unknown>;
}
export interface ErrorLog {
    _id: string;
    type: string;
    message: string;
    stack?: string;
    context?: Record<string, unknown>;
    timestamp: string;
}
