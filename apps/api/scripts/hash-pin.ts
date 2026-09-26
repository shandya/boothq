import bcrypt from "bcryptjs";

const pin = process.argv[2];

if (!pin || !/^\d{6,}$/.test(pin)) {
  console.error("Usage: pnpm --filter api hash-pin <6+ digit PIN>");
  process.exit(1);
}

const hash = bcrypt.hashSync(pin, 10);
console.log(hash);
