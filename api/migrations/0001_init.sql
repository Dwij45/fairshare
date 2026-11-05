-- Migration number: 0001 	 2026-11-05T12:24:28.550Z
CREATE TABLE homes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  CONSTRAINT homes_name_not_empty
    CHECK (length(trim(name)) > 0)
);

CREATE TABLE members (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  home_id TEXT NOT NULL,
  name TEXT NOT NULL,

  CONSTRAINT members_home_fk
    FOREIGN KEY (home_id) REFERENCES homes(id),

  CONSTRAINT members_name_not_empty
    CHECK (length(trim(name)) > 0)
);

CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL,
  title TEXT NOT NULL,
  total_cents INTEGER NOT NULL,

  CONSTRAINT bills_home_fk
    FOREIGN KEY (home_id) REFERENCES homes(id),

  CONSTRAINT bills_title_not_empty
    CHECK (length(trim(title)) > 0),

  CONSTRAINT bills_positive_total
    CHECK (
      typeof(total_cents) = 'integer'
      AND total_cents > 0
      AND total_cents <= 9007199254740991
    )
);

CREATE TABLE shares (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  paid_at TEXT,
  payment_key TEXT,

  CONSTRAINT shares_bill_fk
    FOREIGN KEY (bill_id) REFERENCES bills(id),

  CONSTRAINT shares_member_fk
    FOREIGN KEY (member_id) REFERENCES members(id),

  CONSTRAINT shares_one_per_member
    UNIQUE (bill_id, member_id),

  CONSTRAINT shares_nonnegative_amount
    CHECK (
      typeof(amount_cents) = 'integer'
      AND amount_cents >= 0
      AND amount_cents <= 9007199254740991
    ),

  CONSTRAINT shares_valid_payment_state
    CHECK (
      (paid_at IS NULL AND payment_key IS NULL)
      OR
      (
        paid_at IS NOT NULL
        AND payment_key IS NOT NULL
        AND length(trim(payment_key)) > 0
      )
    )
);

CREATE INDEX members_home_order
  ON members(home_id, sequence);

CREATE INDEX bills_home
  ON bills(home_id);

CREATE INDEX shares_member
  ON shares(member_id);