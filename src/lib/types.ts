/**
 * Hand-written row types for the tables we read.
 * (Later you can replace these with `supabase gen types typescript` output.)
 */

export type AppRole = 'ungdom' | 'ledare';
export type ViewRole = AppRole | 'kommun';

export type Forening = {
  id: string;
  kommun_id: string;
  name: string;
  color: string;
  join_code: string | null;
  lat: number | null;
  lng: number | null;
  geofence_radius_m: number;
  /** Brand gradient a ledare picked for this förening. See APP_THEMES. */
  theme: string;
};

export type Profile = {
  id: string;
  display_name: string;
  avatar_color: string;
};

export type Membership = {
  id: string;
  user_id: string;
  forening_id: string;
  role: AppRole;
  points: number;
  xp: number;
  level: number;
  streak: number;
  visits: number;
};

/** membership joined with its förening (as returned by an embedded select). */
export type MembershipWithForening = Membership & { forening: Forening };

export type NotificationRow = {
  id: string;
  forening_id: string;
  icon: string;
  tint: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

export type Mission = {
  id: string;
  forening_id: string;
  title: string;
  description: string | null;
  icon: string;
  tint: string;
  goal: number;
  xp: number;
  sort: number;
  auto_visit: boolean;
};

export type MissionProgress = {
  progress: number;
  done: boolean;
};

export type MissionWithProgress = Mission & { mission_progress: MissionProgress[] };

export type Checkin = {
  id: string;
  title: string | null;
  awarded_points: number;
  created_at: string;
};

/** Compact activity shown on the youth home ("Kommande aktiviteter"). */
export type HomeActivity = {
  id: string;
  title: string;
  when_text: string | null;
  points: number;
  starts_at: string | null;
  continuous: boolean;
  theme: string;
};

/** Result returned by the check_in() RPC. */
export type CheckinResult = {
  awarded_points: number;
  awarded_xp: number;
  level: number;
  leveled_up: boolean;
  title: string;
  forening: string;
};

/** Activity fields needed by the scan screen. */
export type ScanActivity = {
  id: string;
  title: string;
  qr_token: string;
  lat: number | null;
  lng: number | null;
};

export type Activity = {
  id: string;
  forening_id: string;
  title: string;
  when_text: string | null;
  points: number;
  place_label: string | null;
  theme: string;
  active: boolean;
  created_at: string;
  qr_token: string;
  lat: number | null;
  lng: number | null;
  starts_at: string | null;
  continuous: boolean;
  checkin_mode: 'qr' | 'open';
  requires_photo: boolean;
  duration_min: number | null;
  daily_limit: number;
  radius_m: number | null;
};

/** Open activity a youth can still check into right now (from youth_open_activities). */
export type YouthOpenActivity = {
  id: string;
  title: string;
  points: number;
  requires_photo: boolean;
  lat: number | null;
  lng: number | null;
  daily_limit: number;
  done_today: number;
};

export type LedareOverview = {
  checked_today: number;
  awarded_today: number;
  youth: number;
  activities: number;
};

export type LedareYouth = {
  user_id: string;
  name: string;
  avatar_color: string;
  visits: number;
  present_today: boolean;
};

export type LedareCheckin = {
  name: string;
  title: string;
  points: number;
  at: string;
  photo_url?: string | null;
};

export type Reward = {
  id: string;
  forening_id: string;
  title: string;
  tag: string | null;
  icon: string;
  tint: string;
  cost: number;
  /** How many can be handed out in total. null = unlimited. */
  stock: number | null;
};

/** A shop row as the youth sees it (from youth_shop). */
export type ShopReward = {
  id: string;
  title: string;
  tag: string | null;
  icon: string;
  tint: string;
  cost: number;
  stock: number | null;
  /** How many have been claimed, by anyone in the förening. */
  taken: number;
  /** Whether this member already claimed it. */
  mine: boolean;
};

/** A shop row as the ledare sees it (from ledare_rewards). */
export type LedareReward = ShopReward & { active: boolean };

/** One badge + the member's progress toward it (from youth_badges). */
export type BadgeRow = {
  code: string;
  name: string;
  description: string;
  icon: string;
  tint: string;
  color: string;
  category: string;
  /** Hidden until unlocked — shown as "???" in the UI. */
  secret: boolean;
  unlocked: boolean;
  /** Capped at `goal`, so progress/goal is always a valid 0–1 fraction. */
  progress: number;
  goal: number;
  sort: number;
};

/** One förening in the kommun overview (förening fields + aggregated stats). */
export type KommunForening = Forening & {
  youth: number;
  activities: number;
  checkins_today: number;
};

/** One row of the leaderboard() RPC. user_id is null for demo competitors. */
export type LeaderboardEntry = {
  rank: number;
  user_id: string | null;
  name: string;
  points: number;
  avatar_color: string;
  is_me: boolean;
};
