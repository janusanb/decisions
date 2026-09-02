export type ParticipantId = "a" | "b";

export type SessionStatus = "open" | "revealed" | "spun" | "confirmed" | "rejected" | "cancelled";

export type VisitSource = "confirmed_spin" | "manual";

export type Participant = {
  id: ParticipantId;
  name: string;
  updatedAt: string;
};

export type Restaurant = {
  id: string;
  name: string;
  notes: string | null;
  createdAt: string;
  archivedAt: string | null;
};

export type RestaurantView = Restaurant & {
  lastVisitedAt: string | null;
  daysSinceVisit: number | null;
  due: boolean;
  neverVisited: boolean;
};

export type Visit = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  visitedAt: string;
  source: VisitSource;
  sessionId: string | null;
  notes: string | null;
  createdAt: string;
};

export type Candidate = {
  restaurantId: string;
  name: string;
  tickets: number;
  probability: number;
  sliceStartDegrees: number;
  sliceAngleDegrees: number;
};

export type SessionView = {
  id: string;
  status: SessionStatus;
  createdAt: string;
  revealedAt: string | null;
  spunAt: string | null;
  resolvedAt: string | null;
  createdBy: ParticipantId;
  previousResultRestaurantId: string | null;
  previousResultName: string | null;
  skippedPrevious: boolean;
  you: {
    participantId: ParticipantId;
    locked: boolean;
    choices: string[];
  };
  other: {
    participantId: ParticipantId;
    name: string;
    locked: boolean;
    choices: string[] | null;
  };
  candidates: Candidate[] | null;
  result: {
    restaurantId: string;
    name: string;
    rotationDegrees: number;
  } | null;
};

export type AppState = {
  dueAfterDays: number;
  participants: Participant[];
  restaurants: RestaurantView[];
  visits: Visit[];
  session: SessionView | null;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export type BackupPayload = {
  version: 1;
  exportedAt: string;
  dueAfterDays: number;
  participants: Array<{ id: ParticipantId; name: string; updatedAt: string }>;
  restaurants: Array<{
    id: string;
    name: string;
    notes: string | null;
    createdAt: string;
    archivedAt: string | null;
  }>;
  visits: Array<{
    id: string;
    restaurantId: string;
    visitedAt: string;
    source: VisitSource;
    sessionId: string | null;
    notes: string | null;
    createdAt: string;
  }>;
  sessions: Array<{
    id: string;
    status: SessionStatus;
    createdAt: string;
    revealedAt: string | null;
    spunAt: string | null;
    resolvedAt: string | null;
    resultRestaurantId: string | null;
    previousResultRestaurantId: string | null;
    rotationDegrees: number | null;
    createdBy: ParticipantId;
  }>;
  submissions: Array<{
    sessionId: string;
    participantId: ParticipantId;
    lockedAt: string | null;
    updatedAt: string;
    restaurantIds: string[];
  }>;
  spinCandidates: Array<{
    sessionId: string;
    restaurantId: string;
    tickets: number;
    sliceStartDegrees: number;
    sliceAngleDegrees: number;
  }>;
};
