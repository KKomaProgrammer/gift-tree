CREATE TABLE users (
  uid TEXT PRIMARY KEY,           -- Google Sub ID
  display_name TEXT,
  email TEXT,
  total_exp REAL DEFAULT 0,       -- 누적 경험치
  current_level INTEGER DEFAULT 1, -- 현재 레벨
  last_sync_time INTEGER,         -- 마지막 DB 저장 시간
  multiplier_expiry INTEGER DEFAULT 0 -- 부스트 종료 시간
);
