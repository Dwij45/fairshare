-- Migration number: 0002 	 2026-11-06T22:35:55.336Z
CREATE UNIQUE INDEX homes_unique_name
ON homes(LOWER(TRIM(name)));