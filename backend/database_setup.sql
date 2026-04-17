--To set the database structure with PostgreSQL

create database ethercraft

create table users (
  account_id varchar(20) primary key,
  password varchar(45) not null,
  access_token varchar(40) not null,
  account_number serial,
  user_nickname varchar(20) not null,
  register_date date not null,
  status varchar(15) not null,
  account_cards varchar(20)[],
  account_decks varchar(20)[]
)

create table game_cards (
  card_id varchar(20) primary key,
  card_number serial,
  name varchar(40) not null,
  total_life int not null,
  type varchar(10) not null,
  classes varchar(15)[],
  mana_cost int not null,
  abilities jsonb[]
)

create table game_decks (
  deck_id varchar(20) primary key,
  deck_number serial,
  name varchar(40) not null,
  card_ids varchar(20)[] not null
)

create table active_sessions (
  session_id varchar(10) primary key,
  start_time timestamp not null,
  players_ids varchar(20)[] not null,
  players_lifes int[] not null,
  players_mana_levels int[] not null,
  players_hand_cards jsonb[],
  players_table_cards jsonb[],
  current_turn_player_id varchar(20) not null,
  total_turns_count int not null
)