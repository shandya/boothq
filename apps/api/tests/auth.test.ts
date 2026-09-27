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
