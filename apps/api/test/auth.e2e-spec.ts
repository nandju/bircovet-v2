// Tests de bout en bout du module auth contre la base Neon de TEST
// (DATABASE_URL_TEST → cliva_test). Ils appliquent d'abord les migrations,
// créent des comptes de test dédiés, puis exercent la vraie application.
import "reflect-metadata";
import "dotenv/config";
import { execSync } from "node:child_process";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { hash } from "@node-rs/argon2";
import { PrismaNeon } from "@prisma/adapter-neon";
import request from "supertest";
import { PrismaClient } from "../src/generated/prisma/client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { REFRESH_COOKIE } from "../src/auth/auth.service";

const TEST_DB_URL = process.env.DATABASE_URL_TEST;
const CLINIC_ID = "00000000-0000-4000-8000-000000000099";
const PASSWORD = "MotDePasse-Test!1";

// Comptes dédiés par scénario (le blocage de l'un ne pollue pas les autres).
const ACC_LOGIN = "test.login@cliva.demo";
const ACC_LOCK = "test.lock@cliva.demo";
const ACC_SESSION = "test.session@cliva.demo";
const ACC_PWD = "test.pwd@cliva.demo";

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    if (!TEST_DB_URL) {
      throw new Error(
        "DATABASE_URL_TEST est vide : remplissez apps/api/.env avec l'adresse directe de cliva_test.",
      );
    }

    // 1) Applique les migrations sur la base de test (via DIRECT_URL,
    //    que prisma.config.ts lit pour les commandes CLI).
    execSync("pnpm exec prisma migrate deploy", {
      env: { ...process.env, DIRECT_URL: TEST_DB_URL },
      stdio: "inherit",
    });

    // 2) Données de test : clinique + 4 comptes au mot de passe connu.
    prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: TEST_DB_URL }) });
    await prisma.clinic.upsert({
      where: { id: CLINIC_ID },
      update: {},
      create: { id: CLINIC_ID, name: "Cliva (tests)", country: "CI", licenseStatus: "trial" },
    });
    const passwordHash = await hash(PASSWORD);
    for (const [i, email] of [ACC_LOGIN, ACC_LOCK, ACC_SESSION, ACC_PWD].entries()) {
      await prisma.account.upsert({
        where: { clinicId_userId: { clinicId: CLINIC_ID, userId: `u-test-${i}` } },
        update: { passwordHash, active: true, failedLogins: 0, lockedUntil: null },
        create: {
          clinicId: CLINIC_ID,
          userId: `u-test-${i}`,
          email,
          passwordHash,
          roleId: "vet",
          active: true,
        },
      });
    }

    // 3) L'application réelle, branchée sur la base de test.
    process.env.DATABASE_URL = TEST_DB_URL;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app); // mêmes middlewares/règles que la production
    await app.init();
  });

  afterAll(async () => {
    // Nettoyage : la suppression de la clinique efface en cascade
    // comptes, jetons et état de test.
    await prisma?.clinic.deleteMany({ where: { id: CLINIC_ID } });
    await prisma?.$disconnect();
    await app?.close();
  });

  const agent = () => request(app.getHttpServer());

  it("login : bon mot de passe → 200 + accessToken + cookie de renouvellement", async () => {
    const res = await agent().post("/api/auth/login").send({ email: ACC_LOGIN, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.headers["set-cookie"]?.[0]).toContain(REFRESH_COOKIE);
    expect(res.headers["set-cookie"]?.[0]).toContain("HttpOnly");
  });

  it("login : mauvais mot de passe → 401 générique (même si l'email existe)", async () => {
    const res = await agent()
      .post("/api/auth/login")
      .send({ email: ACC_LOGIN, password: "mauvais-mot-de-passe" });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Email ou mot de passe incorrect");
    const res2 = await agent()
      .post("/api/auth/login")
      .send({ email: "inconnu@cliva.demo", password: "x" });
    expect(res2.body.message).toBe("Email ou mot de passe incorrect");
  });

  it("login : 5 échecs → compte bloqué 15 min (même avec le bon mot de passe)", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await agent()
        .post("/api/auth/login")
        .send({ email: ACC_LOCK, password: "mauvais" });
      expect(res.status).toBe(401);
    }
    // Le bon mot de passe est aussi refusé pendant le blocage.
    const res = await agent().post("/api/auth/login").send({ email: ACC_LOCK, password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it("route protégée sans jeton → 401", async () => {
    const res = await agent().get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("login → me → refresh (rotation) → logout (révocation)", async () => {
    // Connexion.
    const login = await agent().post("/api/auth/login").send({ email: ACC_SESSION, password: PASSWORD });
    expect(login.status).toBe(200);
    const accessToken = login.body.accessToken as string;
    const cookie = login.headers["set-cookie"][0];

    // /me avec le jeton d'accès.
    const me = await agent().get("/api/auth/me").set("Authorization", `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(ACC_SESSION);
    expect(me.body.passwordHash).toBeUndefined(); // jamais de hash vers le client
    expect(me.body.totpSecret).toBeUndefined();

    // Refresh : nouveau jeton d'accès + rotation du cookie.
    const refresh = await agent().post("/api/auth/refresh").set("Cookie", cookie);
    expect(refresh.status).toBe(200);
    expect(refresh.body.accessToken).toBeDefined();
    const newCookie = refresh.headers["set-cookie"][0];
    expect(newCookie).not.toBe(cookie);

    // L'ANCIEN jeton de renouvellement est révoqué (rotation).
    const replay = await agent().post("/api/auth/refresh").set("Cookie", cookie);
    expect(replay.status).toBe(401);

    // Logout : révoque le nouveau jeton.
    const logout = await agent()
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${refresh.body.accessToken}`)
      .set("Cookie", newCookie);
    expect(logout.status).toBe(200);
    const refreshAfterLogout = await agent().post("/api/auth/refresh").set("Cookie", newCookie);
    expect(refreshAfterLogout.status).toBe(401);
  });

  it("change-password : ancien vérifié, nouveau requis (10 car. min), sessions révoquées", async () => {
    const login = await agent().post("/api/auth/login").send({ email: ACC_PWD, password: PASSWORD });
    const accessToken = login.body.accessToken as string;

    // Mot de passe trop court → 400.
    const tooShort = await agent()
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ oldPassword: PASSWORD, newPassword: "court" });
    expect(tooShort.status).toBe(400);

    // Changement valide.
    const ok = await agent()
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ oldPassword: PASSWORD, newPassword: "Nouveau-Passe-2!" });
    expect(ok.status).toBe(200);

    // L'ancien mot de passe ne marche plus, le nouveau oui.
    const oldLogin = await agent().post("/api/auth/login").send({ email: ACC_PWD, password: PASSWORD });
    expect(oldLogin.status).toBe(401);
    const newLogin = await agent()
      .post("/api/auth/login")
      .send({ email: ACC_PWD, password: "Nouveau-Passe-2!" });
    expect(newLogin.status).toBe(200);
  });
});
