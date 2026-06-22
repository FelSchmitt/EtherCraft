CREATE DATABASE ethercraft;

-- CARDS

CREATE TABLE game_cards (
  card_id            varchar(20) PRIMARY KEY,
  card_number        serial,
  name               varchar(40)  NOT NULL,
  total_life         int          NOT NULL,
  attack_damage      int          NOT NULL,
  mana_cost          int          NOT NULL,
  rarity             varchar(10)  NOT NULL,
  classes            varchar(20)[],
  abilities          jsonb[], -- each entry: { "name": "...", "trigger": "on_play|in_hand|passive", "description": "..." }
  geometry_variation decimal(2, 0) -- just references one of the 3d models in the frontend to give cards different styles
);

-- ACCOUNTS

CREATE TABLE users (
  account_id       varchar(20)  PRIMARY KEY,
  password_hash    varchar(100) NOT NULL,
  access_token     varchar(40)  NOT NULL,
  nickname         varchar(20)  NOT NULL,
  register_date    date         NOT NULL,
  status           varchar(15)  NOT NULL DEFAULT 'active', -- active | suspended | banned
  player_level     int          NOT NULL DEFAULT 0,
  xp               int          NOT NULL DEFAULT 0,
  coins            int          NOT NULL DEFAULT 0,
  dust             int          NOT NULL DEFAULT 0,
  discovery_tokens int          NOT NULL DEFAULT 0,
  packs_opened     int          NOT NULL DEFAULT 0 -- tracks the every-10th-pack Epic guarantee
);

-- Cards owned by a user (one row per unique card; count tracks duplicates)
CREATE TABLE user_cards (
  account_id  varchar(20) NOT NULL REFERENCES users(account_id) ON DELETE CASCADE,
  card_id     varchar(20) NOT NULL REFERENCES game_cards(card_id),
  count       int         NOT NULL DEFAULT 1,
  discovered  boolean     NOT NULL DEFAULT false,
  PRIMARY KEY (account_id, card_id)
);

-- DECKS

CREATE TABLE user_decks (
  deck_id     varchar(20) PRIMARY KEY,
  deck_number serial,
  account_id  varchar(20) NOT NULL REFERENCES users(account_id) ON DELETE CASCADE,
  name        varchar(40) NOT NULL
);

CREATE TABLE deck_cards (
  deck_id  varchar(20) NOT NULL REFERENCES user_decks(deck_id) ON DELETE CASCADE,
  card_id  varchar(20) NOT NULL REFERENCES game_cards(card_id),
  PRIMARY KEY (deck_id, card_id)
);

-- PROGRESSION — MODE STATS & CLASS MASTERY

-- classic | destiny | chaos | ritual | dungeon_run | eclipse
CREATE TABLE user_mode_stats (
  account_id    varchar(20) NOT NULL REFERENCES users(account_id) ON DELETE CASCADE,
  mode          varchar(20) NOT NULL,
  wins          int         NOT NULL DEFAULT 0,
  losses        int         NOT NULL DEFAULT 0,
  mastery_rank  varchar(15) NOT NULL DEFAULT 'bronze', -- bronze | silver | gold | platinum | ethermaster
  first_win_today boolean NOT NULL DEFAULT false, -- tracks the first-win-of-the-day bonus (reset daily by the server)
  PRIMARY KEY (account_id, mode)
);

CREATE TABLE user_class_mastery (
  account_id   varchar(20) NOT NULL REFERENCES users(account_id) ON DELETE CASCADE,
  class_name   varchar(20) NOT NULL,
  wins         int         NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, class_name)
);

-- QUESTS & CHALLENGES

CREATE TABLE daily_quests (
  quest_id     varchar(20) PRIMARY KEY,
  quest_number serial,
  description  text        NOT NULL,
  coin_reward  int         NOT NULL,
  xp_reward    int         NOT NULL
);

CREATE TABLE user_daily_quests (
  account_id   varchar(20) NOT NULL REFERENCES users(account_id) ON DELETE CASCADE,
  quest_id     varchar(20) NOT NULL REFERENCES daily_quests(quest_id),
  progress     int         NOT NULL DEFAULT 0,
  completed    boolean     NOT NULL DEFAULT false,
  assigned_on  date        NOT NULL,
  PRIMARY KEY (account_id, quest_id, assigned_on)
);

CREATE TABLE weekly_challenges (
  challenge_id     varchar(20) PRIMARY KEY,
  challenge_number serial,
  description      text        NOT NULL,
  pack_reward      int         NOT NULL DEFAULT 1,
  token_reward     int         NOT NULL DEFAULT 1
);

CREATE TABLE user_weekly_challenges (
  account_id    varchar(20) NOT NULL REFERENCES users(account_id) ON DELETE CASCADE,
  challenge_id  varchar(20) NOT NULL REFERENCES weekly_challenges(challenge_id),
  progress      int         NOT NULL DEFAULT 0,
  completed     boolean     NOT NULL DEFAULT false,
  week_start    date        NOT NULL,  -- always a Monday
  PRIMARY KEY (account_id, challenge_id, week_start)
);

-- SEASONS & RANKED

CREATE TABLE seasons (
  season_id     serial      PRIMARY KEY,
  name          varchar(40) NOT NULL,
  start_date    date        NOT NULL,
  end_date      date        NOT NULL
);

CREATE TABLE user_season_ranks (
  account_id  varchar(20) NOT NULL REFERENCES users(account_id) ON DELETE CASCADE,
  season_id   int         NOT NULL REFERENCES seasons(season_id),
  peak_rank   int         NOT NULL DEFAULT 0,
  final_rank  int,
  PRIMARY KEY (account_id, season_id)
);

-- Decks used in ranked per season; a deck config is banned after 5 losses
CREATE TABLE ranked_season_decks (
  id           serial PRIMARY KEY,
  account_id   varchar(20) NOT NULL REFERENCES users(account_id) ON DELETE CASCADE,
  season_id    int         NOT NULL REFERENCES seasons(season_id),
  deck_id      varchar(20) NOT NULL REFERENCES user_decks(deck_id),
  -- snapshot of card_ids at time of first ranked use (deck may change later)
  card_ids_snapshot varchar(20)[] NOT NULL,
  losses       int         NOT NULL DEFAULT 0,
  banned       boolean     NOT NULL DEFAULT false
);

-- DUNGEON RUN

CREATE TABLE dungeons (
  dungeon_id   varchar(20) PRIMARY KEY,
  name         varchar(60) NOT NULL,
  theme        varchar(40),
  floors       int         NOT NULL DEFAULT 7
);

-- Each floor's AI deck configuration (stored as card_ids)
CREATE TABLE dungeon_floors (
  dungeon_id   varchar(20) NOT NULL REFERENCES dungeons(dungeon_id),
  floor_number int         NOT NULL,
  ai_deck      varchar(20)[] NOT NULL,
  -- optional boss mechanic description (floors 3 and 7)
  boss_mechanic text,
  PRIMARY KEY (dungeon_id, floor_number)
);

CREATE TABLE dungeon_runs (
  run_id          varchar(20) PRIMARY KEY,
  account_id      varchar(20) NOT NULL REFERENCES users(account_id) ON DELETE CASCADE,
  dungeon_id      varchar(20) NOT NULL REFERENCES dungeons(dungeon_id),
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  -- in_progress | completed | failed
  status          varchar(15) NOT NULL DEFAULT 'in_progress',
  current_floor   int         NOT NULL DEFAULT 1,
  -- current run deck (grows as the player picks draft rewards)
  run_deck        varchar(20)[] NOT NULL,
  hero_card_id    varchar(20)  REFERENCES game_cards(card_id),
  ironclad_mode   boolean      NOT NULL DEFAULT false,
  floors_cleared  int          NOT NULL DEFAULT 0,
  coins_earned    int          NOT NULL DEFAULT 0
);

-- Cards drafted during a run (one row per pick per floor)
CREATE TABLE dungeon_run_rewards (
  run_id       varchar(20) NOT NULL REFERENCES dungeon_runs(run_id) ON DELETE CASCADE,
  floor_number int         NOT NULL,
  card_id      varchar(20) NOT NULL REFERENCES game_cards(card_id),
  PRIMARY KEY (run_id, floor_number)
);

-- MATCH HISTORY

CREATE TABLE matches (
  match_id      varchar(20) PRIMARY KEY,
  mode          varchar(20) NOT NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  player1_id    varchar(20) NOT NULL REFERENCES users(account_id),
  player2_id    varchar(20)          REFERENCES users(account_id),  -- NULL for Dungeon Run AI
  winner_id     varchar(20)          REFERENCES users(account_id),
  season_id     int                  REFERENCES seasons(season_id),  -- set when ranked
  is_ranked     boolean     NOT NULL DEFAULT false,
  -- final health totals, end-of-match board snapshot, etc.
  match_summary jsonb
);