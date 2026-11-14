-- Lengo v0.1 read model. The chain stays the source of truth; this only speeds up reads.
create table if not exists deployment (
  chain_id      integer primary key,
  market        text not null,
  t_btc         text not null,
  t_usdc        text not null,
  oracle        text not null,
  start_block   bigint not null,
  environment   text not null default 'testnet',
  created_at    timestamptz not null default now()
);

-- Identity = chain_id + tx_hash + log_index, so re-indexing is idempotent.
create table if not exists activity (
  chain_id      integer not null,
  tx_hash       text not null,
  log_index     integer not null,
  block_number  bigint not null,
  block_hash    text not null,
  event         text not null,
  account       text not null,
  counterparty  text,
  amount_a      numeric(78,0),
  amount_b      numeric(78,0),
  created_at    timestamptz not null default now(),
  primary key (chain_id, tx_hash, log_index)
);
create index if not exists activity_account_idx on activity (chain_id, account, block_number desc);

create table if not exists indexer_cursor (
  chain_id      integer primary key,
  last_block    bigint not null,
  last_hash     text,
  updated_at    timestamptz not null default now()
);

-- Quote previews (dry:true). Addresses are hashed, never stored raw.
create table if not exists quote (
  id              bigserial primary key,
  provider        text not null,
  correlation_id  text,
  origin_asset    text not null,
  dest_asset      text not null,
  amount_in       numeric(78,0) not null,
  amount_out      numeric(78,0),
  status          text not null,
  reason          text,
  recipient_hash  text,
  quoted_at       timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz not null default now()
);

-- Health alerts: idempotent per account+zone, rate-limited by last_notified_at.
create table if not exists alert (
  chain_id          integer not null,
  account           text not null,
  zone              smallint not null,  -- 1: <1.30, 2: <1.15, 3: <1.00
  channel           text not null default 'in_app',
  last_notified_at  timestamptz,
  primary key (chain_id, account, zone, channel)
);
