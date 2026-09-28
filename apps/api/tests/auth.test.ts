import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { json, loginCookie, resetDb, TEST_PINS } from "./helpers.js";

let app: Express;

beforeEach(async () => {
  await resetDb();
  app = createApp();
});

describe("POST /api/auth/login", () => {
  it("succeeds with the right PIN and sets a session cookie", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send({ role: "ADMIN", pin: TEST_PINS.ADMIN });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ role: "ADMIN" });
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^bq_session=/);
  });

  it("rejects the wrong PIN", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send({ role: "ADMIN", pin: "000000" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_PIN");
  });

  it("rejects an illustrator hitting an admin-only route", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send({ role: "ILLUSTRATOR", pin: TEST_PINS.ILLUSTRATOR });
    const cookie = login.headers["set-cookie"][0].split(";")[0];

    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ role: "ILLUSTRATOR" });
  });

  it("returns 401 from /api/auth/me with no session", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("blocks an illustrator from an admin-only route", async () => {
    const illustratorCookie = await loginCookie(app, "ILLUSTRATOR");
    const res = await json(request(app).post("/api/day/open").set("Cookie", illustratorCookie)).send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session so /me is unauthenticated again", async () => {
    const cookie = await loginCookie(app, "ADMIN");
    const logout = await request(app).post("/api/auth/logout").set("Cookie", cookie).set("Content-Type", "application/json");
    expect(logout.status).toBe(200);
    expect(logout.body).toEqual({ ok: true });

    const clearedCookie = logout.headers["set-cookie"][0].split(";")[0];
    const me = await request(app).get("/api/auth/me").set("Cookie", clearedCookie);
    expect(me.status).toBe(401);
  });
});

describe("CSRF protection", () => {
  it("rejects a mutation without a JSON Content-Type", async () => {
    const res = await request(app).post("/api/auth/login").send("role=ADMIN&pin=111111");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects a mutation from a mismatched Origin", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .set("Origin", "https://evil.example.com")
      .send({ role: "ADMIN", pin: TEST_PINS.ADMIN });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("allows a mutation from the configured PUBLIC_WEB_URL origin", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .set("Origin", process.env.PUBLIC_WEB_URL ?? "")
      .send({ role: "ADMIN", pin: TEST_PINS.ADMIN });
    expect(res.status).toBe(200);
  });

  it("tolerates a trailing slash in PUBLIC_WEB_URL", async () => {
    const original = process.env.PUBLIC_WEB_URL ?? "";
    const origin = new URL(original).origin;
    process.env.PUBLIC_WEB_URL = `${origin}/`;
    try {
      const res = await request(app)
        .post("/api/auth/login")
        .set("Content-Type", "application/json")
        .set("Origin", origin)
        .send({ role: "ADMIN", pin: TEST_PINS.ADMIN });
      expect(res.status).toBe(200);
    } finally {
      process.env.PUBLIC_WEB_URL = original;
    }
  });
});
