// Preload test environment to isolate automated tests from development database
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://rollz_app:rollz_secure_pass_2026@localhost:5432/rollz_pos_test?schema=public";
