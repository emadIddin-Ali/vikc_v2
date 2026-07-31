/**
 * Hand-written row types for the tables we read.
 * (Later you can replace these with `supabase gen types typescript` output.)
 */

export type AppRole = 'ungdom' | 'ledare' | 'foralder' | 'larare';
export type ViewRole = AppRole | 'kommun';

/** A parent-managed child profile (no own login). Stats scoped to a förening. */
export type Child = {
  id: string;
  display_name: string;
  avatar_color: string;
  birth_year: number | null;
  personnummer: string | null;
  points: number;
  xp: number;
  level: number;
  streak: number;
  /** Weeks in a row with at least one visit. */
  week_streak: number;
  visits: number;
};

/** One row of a child's check-in history (from child_checkins). */
export type ChildCheckin = {
  id: string;
  title: string | null;
  awarded_points: number;
  created_at: string;
};

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
  /** Public info a ledare can edit (Förening-fliken). All optional. */
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  opening_hours: string | null;
  logo_url: string | null;
  /** When true, members must supply a personnummer to join (per-förening register). */
  require_personnummer: boolean;
  /** XP per star level 1–5. Non-linear so 5★ beats 5×1★. */
  star_xp: number[];
  /** Share of a star's XP also paid out as shop points. 0 = XP only. */
  star_points_factor: number;
  /** Cap on how many stars one teacher may give one student per week. */
  star_max_per_vecka: number;
  /** Visits per week that earn the weekly bonus. 0 = off. */
  week_goal: number;
  week_goal_xp: number;
  week_goal_points: number;
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
  /** Legacy day streak, still written by the check-in functions. Show week_streak. */
  streak: number;
  /** Weeks in a row with at least one visit. Tolerates one skipped week. */
  week_streak: number;
  visits: number;
  /** Only meaningful for role 'larare': false until a ledare approves. */
  larare_godkand: boolean;
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

/**
 * 'goal' = Mål: fylls automatiskt av incheckningar, löses in när stapeln är full.
 * 'task' = Uppgift: något ungdomen aktivt gör och markerar klart för XP direkt.
 */
export type MissionKind = 'goal' | 'task';

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
  kind: MissionKind;
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
  duration_min: number | null;
  continuous: boolean;
  theme: string;
};

/** Result returned by the check_in() / check_out() RPCs. */
export type CheckinResult = {
  awarded_points: number;
  awarded_xp: number;
  level: number;
  leveled_up: boolean;
  title: string;
  forening: string;
  /** 'checked_in' = incheckad, 'checked_out' = utcheckad. */
  action?: 'checked_in' | 'checked_out';
  /** true = incheckad men väntar på utcheckning (poängen ges först då). */
  pending?: boolean;
  /** Set when a parent checked in a child — the child's name. */
  child?: string;
};

/** An open check-in the youth still has to check out of (from my_open_checkins). */
export type OpenSession = {
  id: string;
  activity_id: string;
  title: string;
  points: number;
  lat: number | null;
  lng: number | null;
  started_at: string;
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
  /** Points are awarded on check-OUT, not on check-in. */
  requires_checkout: boolean;
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
  requires_checkout: boolean;
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

/** When a reward can be bought: only at a marknad, or any time. */
export type RewardAvailability = 'marknad' | 'alltid';

/** A shop row as the youth (or a parent's child) sees it (from youth_shop). */
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
  /** How many times this buyer already claimed it. */
  mina: number;
  /** How many times one member may claim it. null = unlimited. */
  limit_per_member: number | null;
  availability: RewardAvailability;
  /** Whether the shop is open for this reward right now. */
  kopbar: boolean;
};

/** A shop row as the ledare sees it (from ledare_rewards). */
export type LedareReward = ShopReward & { active: boolean };

/** The förening's market state, from marknad_status(). */
export type MarknadStatus = {
  /** False when the förening has never scheduled one — then the shop is always open. */
  anvander_marknad: boolean;
  oppen: boolean;
  namn: string | null;
  /** Of the open market, else the next upcoming one. */
  opens_at: string | null;
  closes_at: string | null;
};

/** One scheduled market in the ledare's list. */
export type LedareMarknad = {
  id: string;
  name: string;
  opens_at: string;
  closes_at: string;
  oppen: boolean;
};

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

/* ------------------------------------------------------------------ *
 * Klasser och stjärnor (lärarrollen)
 * ------------------------------------------------------------------ */

/** What a star was given for. Drives the per-skill breakdown. */
export type StarCategory = 'hifz' | 'murajaa' | 'tajwid' | 'laxa' | 'narvaro' | 'adab';

export type NarvaroStatus = 'har' | 'sen' | 'borta' | 'anmald';

/** A class as its teacher sees it (from larare_klasser). */
export type LarareKlass = {
  id: string;
  name: string;
  description: string | null;
  weekday: number | null;
  time_text: string | null;
  color: string;
  join_code: string | null;
  elever: number;
  stjarnor_veckan: number;
  senaste_lektion: string | null;
  /** A lesson that was started but never closed. */
  oppen_lektion: string | null;
};

/** A class as the ledare sees it (from ledare_klasser). */
export type LedareKlass = {
  id: string;
  name: string;
  larare: string;
  /** null when the teacher deleted their account — the class needs a new one. */
  larare_user_id: string | null;
  weekday: number | null;
  time_text: string | null;
  color: string;
  elever: number;
  stjarnor_30d: number;
  senaste_lektion: string | null;
};

/** One student in a class (from klass_elever). */
export type KlassElev = {
  id: string;
  student_user_id: string | null;
  child_id: string | null;
  name: string;
  avatar_color: string;
  level: number;
  stjarnor_veckan: number;
  stjarnor_totalt: number;
};

export type Lektion = {
  id: string;
  klass_id: string;
  forening_id: string;
  held_on: string;
  note: string | null;
  closed_at: string | null;
};

/** A lesson with its class embedded, for the lesson screen header. */
export type LektionMedKlass = Lektion & { klass: { name: string; color: string } | null };

/** One row of the lesson screen: student + attendance + draft stars. */
export type LektionRad = {
  klass_elev_id: string;
  name: string;
  avatar_color: string;
  status: NarvaroStatus;
  stjarna_id: string | null;
  stars: number | null;
  kategori: StarCategory | null;
  note: string | null;
};

/** Result of avsluta_lektion(). */
export type LektionResultat = {
  narvarande: number;
  stjarnor: number;
  xp: number;
  klass: string;
};

/** A förening member a teacher can adopt into a class (from forening_elever). */
export type ForeningElev = {
  kind: 'medlem' | 'barn';
  user_id: string | null;
  child_id: string | null;
  name: string;
  avatar_color: string;
  birth_year: number | null;
  /** Already in one of my classes (any of them). */
  i_min_klass: boolean;
  /** The klass_elev row in the class being managed — null when not in it. */
  klass_elev_id: string | null;
};

/** A class the student (or the parent's child) belongs to. */
export type ElevKlass = {
  klass_elev_id: string;
  klass_id: string;
  name: string;
  larare: string;
  weekday: number | null;
  time_text: string | null;
  color: string;
  stjarnor_veckan: number;
  stjarnor_totalt: number;
};

/** One awarded star in a student's history. */
export type ElevStjarna = {
  id: string;
  stars: number;
  kategori: StarCategory;
  note: string | null;
  xp: number;
  klass: string;
  larare: string;
  created_at: string;
  angrad: boolean;
};

/** A teacher as the ledare sees them, with inflation stats. */
export type LarareRad = {
  user_id: string;
  name: string;
  avatar_color: string;
  godkand: boolean;
  klasser: number;
  elever: number;
  stjarnor_30d: number;
  /** Average stars given over 30 days — a teacher stuck at 5.0 is inflating. */
  snitt: number | null;
};

/** One row of the weekly class leaderboard. */
export type KlassToppRad = {
  rank: number;
  name: string;
  avatar_color: string;
  stjarnor: number;
  is_me: boolean;
};

/* ------------------------------------------------------------------ *
 * Säsong, veckomål och XP-huvudboken
 * ------------------------------------------------------------------ */

/** The current season window. A season runs from one marknad to the next. */
export type SasongStatus = {
  start: string;
  /** When the next market opens and the season ends. null = none scheduled. */
  slut: string | null;
  /** False when no market has opened yet — then the season is the calendar month. */
  marknadsstyrd: boolean;
};

/** Last season's podium (from leaderboard_forra). */
export type ForraToppRad = {
  rank: number;
  name: string;
  xp: number;
  avatar_color: string;
};

/** Everything the home screen's week card needs, from min_vecka(). */
export type MinVecka = {
  xp_vecka: number;
  besok_vecka: number;
  /** Visits needed this week. 0 = the weekly goal is switched off. */
  veckomal: number;
  veckomal_xp: number;
  veckosvit: number;
  sasong_xp: number;
  /** Whether the weekly bonus is already paid out this week. */
  klart: boolean;
};

/** One row of the leaderboard() RPC. user_id is null for children. */
export type LeaderboardEntry = {
  rank: number;
  user_id: string | null;
  name: string;
  /**
   * XP earned this season — not the spendable balance. Ranking on points made
   * shopping cost you your place, which is the opposite of the intent.
   */
  xp: number;
  avatar_color: string;
  is_me: boolean;
};
