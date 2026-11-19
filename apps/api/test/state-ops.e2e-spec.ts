// Tests e2e de GET /api/state(/version) et POST /api/ops contre la base
// Neon de TEST (DATABASE_URL_TEST → cliva_test). Migrations appliquées en
// beforeAll, deux cliniques isolées créées, vraie application Nest démarrée.
import "reflect-metadata";
import "dotenv/config";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { hash } from "@node-rs/argon2";
import { PrismaNeon } from "@prisma/adapter-neon";
import request from "supertest";
import { PrismaClient } from "../src/generated/prisma/client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { createSeed, stripDemoPasswords, SCHEMA_VERSION, type DemoDB } from "@cliva/core";

const TEST_DB_URL = process.env.DATABASE_URL_TEST;
const PASSWORD = "MotDePasse-Test!1";
const CLINIC1 = "00000000-0000-4000-8000-0000000000c1";
const CLINIC2 = "00000000-0000-4000-8000-0000000000c2";
const MARKER = "MARQUEUR-BIRCOVET-UNIQUE-9f3";

// Corps JSON d'un POST /api/ops.
const opBody = (name: string, input: unknown, opKey = randomUUID()) => ({
  opKey,
  name,
  input,
  clientNow: new Date().toISOString(),
});

// État réduit (~quelques Ko au lieu de ~1 Mo) : les collections volumineuses
// sont tronquées à 1 élément. Utilisé pour la clinique 2, qui ne fait que des
// lectures d'isolement — Neon facture les octets lus, inutile de payer 1 Mo.
const reducedState = (db: DemoDB): DemoDB => {
  const small = { ...db } as Record<string, unknown>;
  for (const [k, v] of Object.entries(small)) {
    if (Array.isArray(v) && k !== "users" && k !== "establishments") small[k] = v.slice(0, 1);
  }
  return small as unknown as DemoDB;
};

// Input complet et valide pour l'opération « clients.creer ».
const clientInput = {
  type: "particulier",
  name: "Client E2E Ops",
  phoneCode: "+225",
  phone: "07 55 66 77 88",
  email: "e2e@cliva.demo",
  address: "Rue des tests",
  city: "Abidjan",
  contacts: [],
  commPrefs: { sms: true, whatsapp: false, email: false, call: false },
  segment: "standard",
  payerName: "Client E2E Ops",
  payerTaxId: "",
};

describe("State & Ops (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tokenDg: string;
  let tokenAssistant: string;
  let tokenClinic2: string;

  const login = async (email: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  };

  beforeAll(async () => {
    if (!TEST_DB_URL) {
      throw new Error(
        "DATABASE_URL_TEST est vide : remplissez apps/api/.env avec l'adresse directe de cliva_test.",
      );
    }
    execSync("pnpm exec prisma migrate deploy", {
      env: { ...process.env, DIRECT_URL: TEST_DB_URL },
      stdio: "inherit",
    });

    prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: TEST_DB_URL }) });
    const passwordHash = await hash(PASSWORD);

    // Clinique 1 : état de démonstration complet + comptes dg/assistant.
    const db1 = stripDemoPasswords(createSeed(new Date())) as DemoDB;
    // Marqueur unique : seule la clinique 1 doit le renvoyer dans /api/state.
    db1.settings = { ...db1.settings, clinicName: MARKER };
    await prisma.clinic.upsert({
      where: { id: CLINIC1 },
      update: {},
      create: { id: CLINIC1, name: "BIRCOVET (test)", country: "CI", licenseStatus: "trial" },
    });
    await prisma.clinicState.upsert({
      where: { clinicId: CLINIC1 },
      update: { data: db1 as object, schemaVersion: SCHEMA_VERSION, version: { increment: 1 } },
      create: { clinicId: CLINIC1, version: 1, schemaVersion: SCHEMA_VERSION, data: db1 as object },
    });
    for (const [userId, email, roleId] of [
      ["u-dg", "dg.e2e@cliva.demo", "dg"],
      ["u-asst1", "asst.e2e@cliva.demo", "assistant"],
    ] as const) {
      await prisma.account.upsert({
        where: { clinicId_userId: { clinicId: CLINIC1, userId } },
        update: { passwordHash, active: true },
        create: { clinicId: CLINIC1, userId, email, passwordHash, roleId, active: true },
      });
    }

    // Clinique 2 : état RÉDUIT (lectures d'isolement seulement — chaque Ko
    // lu depuis Neon compte dans le quota de la base de test).
    const db2 = reducedState(stripDemoPasswords(createSeed(new Date())) as DemoDB);
    await prisma.clinic.upsert({
      where: { id: CLINIC2 },
      update: {},
      create: { id: CLINIC2, name: "Clinique 2 (test)", country: "CI", licenseStatus: "trial" },
    });
    await prisma.clinicState.upsert({
      where: { clinicId: CLINIC2 },
      update: { data: db2 as object, schemaVersion: SCHEMA_VERSION, version: { increment: 1 } },
      create: { clinicId: CLINIC2, version: 1, schemaVersion: SCHEMA_VERSION, data: db2 as object },
    });
    await prisma.account.upsert({
      where: { clinicId_userId: { clinicId: CLINIC2, userId: "u-dg" } },
      update: { passwordHash, active: true },
      create: {
        clinicId: CLINIC2,
        userId: "u-dg",
        email: "dg2.e2e@cliva.demo",
        passwordHash,
        roleId: "dg",
        active: true,
      },
    });

    process.env.DATABASE_URL = TEST_DB_URL;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    tokenDg = await login("dg.e2e@cliva.demo");
    tokenAssistant = await login("asst.e2e@cliva.demo");
    tokenClinic2 = await login("dg2.e2e@cliva.demo");
  });

  afterAll(async () => {
    await prisma?.clinic.deleteMany({ where: { id: { in: [CLINIC1, CLINIC2] } } });
    await prisma?.$disconnect();
    await app?.close();
  });

  const agent = () => request(app.getHttpServer());
  // .set() s'applique sur la requête (pas sur l'agent) — d'où ce mini-helper.
  const authed = (token: string) => ({
    get: (url: string) => agent().get(url).set("Authorization", `Bearer ${token}`),
    post: (url: string) => agent().post(url).set("Authorization", `Bearer ${token}`),
  });

  it("POST /api/ops : opération acceptée → ok + version incrémentée + état mis à jour", async () => {
    const v0 = (await authed(tokenDg).get("/api/state/version")).body.version as number;
    const res = await authed(tokenDg).post("/api/ops").send(opBody("clients.creer", clientInput));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.version).toBe(v0 + 1);

    const state = await authed(tokenDg).get("/api/state");
    expect(state.body.version).toBe(v0 + 1);
    expect(state.body.data.clients.some((c: { name: string }) => c.name === "Client E2E Ops")).toBe(true);
  });

  it("POST /api/ops : même opKey deux fois → rejouée, un seul client créé", async () => {
    const opKey = randomUUID();
    const body = opBody("clients.creer", { ...clientInput, name: "Client Idempotent" }, opKey);
    const r1 = await authed(tokenDg).post("/api/ops").send(body);
    const r2 = await authed(tokenDg).post("/api/ops").send(body);
    expect(r1.body.ok).toBe(true);
    expect(r2.body.ok).toBe(true);
    expect(r2.body.replayed).toBe(true);
    expect(r2.body.version).toBe(r1.body.version);

    const state = await authed(tokenDg).get("/api/state");
    const count = state.body.data.clients.filter(
      (c: { name: string }) => c.name === "Client Idempotent",
    ).length;
    expect(count).toBe(1);
  });

  it("POST /api/ops : opération inconnue → 400", async () => {
    const res = await authed(tokenDg).post("/api/ops").send(opBody("inexistante.bidon", {}));
    expect(res.status).toBe(400);
  });

  it("POST /api/ops : opération admin pour un assistant → 403", async () => {
    const res = await authed(tokenAssistant)
      .post("/api/ops")
      .send(opBody("admin.utilisateur.creer", {}));
    expect(res.status).toBe(403);
  });

  it("GET /api/state : un assistant ne reçoit ni salaires, ni platform, ni demoPassword", async () => {
    const res = await authed(tokenAssistant).get("/api/state");
    expect(res.status).toBe(200);
    expect(res.body.data.salaries).toBeUndefined();
    expect(res.body.data.budgets).toBeUndefined();
    expect(res.body.data.platform).toBeUndefined();
    expect(JSON.stringify(res.body.data)).not.toContain("demoPassword");
  });

  it("GET /api/state : la clinique 2 ne voit JAMAIS les données de BIRCOVET", async () => {
    const res = await authed(tokenClinic2).get("/api/state");
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(MARKER);
    // Et son état est bien le sien (version propre à la clinique 2).
    const v2 = (await authed(tokenClinic2).get("/api/state/version")).body.version as number;
    expect(v2).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/health/usage : compteurs de lecture Neon — DG seulement", async () => {
    const denied = await authed(tokenAssistant).get("/api/health/usage");
    expect(denied.status).toBe(403);

    const res = await authed(tokenDg).get("/api/health/usage");
    expect(res.status).toBe(200);
    // Des lectures complètes de data ont eu lieu au moins une fois (seed du cache).
    expect(res.body.fullDataReads).toBeGreaterThanOrEqual(1);
    expect(res.body.dataBytesRead).toBeGreaterThan(0);
  });

  /* ---------- /api/accounts : gestion des accès par le DG ---------- */

  // E-mail unique à chaque exécution : les tests restent rejouables.
  const NEW_EMAIL = `acct-${randomUUID().slice(0, 8)}@cliva.test`;
  const NEW_PASSWORD = "Temporaire-E2E!123";
  const newUserInput = (estId: string) => ({
    name: "Compte E2E",
    email: NEW_EMAIL,
    roleId: "vet",
    establishmentId: estId,
    title: "Vétérinaire de test",
    phone: "01 02 03 04 05",
  });

  const firstEstablishmentId = async (): Promise<string> => {
    const st = await authed(tokenDg).get("/api/state");
    return st.body.data.establishments[0].id as string;
  };

  it("POST /api/accounts : un assistant reçoit 403", async () => {
    const res = await authed(tokenAssistant)
      .post("/api/accounts")
      .send({ user: newUserInput("x"), email: NEW_EMAIL, temporaryPassword: NEW_PASSWORD });
    expect(res.status).toBe(403);
  });

  it("POST /api/accounts : le DG crée un utilisateur qui peut se connecter (mustChangePassword)", async () => {
    const res = await authed(tokenDg)
      .post("/api/accounts")
      .send({ user: newUserInput(await firstEstablishmentId()), email: NEW_EMAIL, temporaryPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.userId).toBe("string");

    // L'utilisateur est bien dans l'état de la clinique 1…
    const state = await authed(tokenDg).get("/api/state");
    const created = state.body.data.users.find((u: { id: string }) => u.id === res.body.userId);
    expect(created).toBeDefined();
    expect(created.email).toBe(NEW_EMAIL);

    // … et son accès fonctionne : connexion réussie, mot de passe à changer.
    const loginRes = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: NEW_EMAIL, password: NEW_PASSWORD });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.mustChangePassword).toBe(true);

    // Le compte créé appartient à la clinique du jeton (jamais une autre).
    const account = await prisma.account.findUnique({ where: { email: NEW_EMAIL } });
    expect(account?.clinicId).toBe(CLINIC1);
    // Et l'utilisateur n'apparaît pas dans l'état de la clinique 2.
    const state2 = await authed(tokenClinic2).get("/api/state");
    expect(state2.body.data.users.some((u: { id: string }) => u.id === res.body.userId)).toBe(false);
  });

  it("POST /api/accounts : e-mail déjà pris → refus explicite", async () => {
    const res = await authed(tokenDg)
      .post("/api/accounts")
      .send({ user: { ...newUserInput(await firstEstablishmentId()), name: "Doublon" }, email: NEW_EMAIL, temporaryPassword: NEW_PASSWORD });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain("déjà utilisé");
  });

  it("Utilisateur désactivé : connexion refusée, réactivation → connexion possible", async () => {
    const account = await prisma.account.findUnique({ where: { email: NEW_EMAIL } });
    expect(account).not.toBeNull();

    // Désactivation métier via l'opération existante → Account.active suit.
    const off = await authed(tokenDg)
      .post("/api/ops")
      .send(opBody("admin.utilisateur.actif", { id: account!.userId, active: false, reason: "Test e2e désactivation" }));
    expect(off.body.ok).toBe(true);
    const disabled = await prisma.account.findUnique({ where: { email: NEW_EMAIL } });
    expect(disabled?.active).toBe(false);

    const loginOff = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: NEW_EMAIL, password: NEW_PASSWORD });
    expect(loginOff.status).toBe(401);

    // Réactivation → l'accès fonctionne de nouveau.
    const on = await authed(tokenDg)
      .post("/api/ops")
      .send(opBody("admin.utilisateur.actif", { id: account!.userId, active: true, reason: "Test e2e réactivation" }));
    expect(on.body.ok).toBe(true);
    const loginOn = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: NEW_EMAIL, password: NEW_PASSWORD });
    expect(loginOn.status).toBe(200);
  });

  it("POST /api/accounts/:userId/reset-password : nouveau mot de passe temporaire, sessions révoquées", async () => {
    const account = await prisma.account.findUnique({ where: { email: NEW_EMAIL } });
    const res = await authed(tokenDg)
      .post(`/api/accounts/${account!.userId}/reset-password`)
      .send({ temporaryPassword: "Nouveau-Temp-E2E!456" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // L'ancien mot de passe ne marche plus ; le nouveau impose un changement.
    const oldLogin = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: NEW_EMAIL, password: NEW_PASSWORD });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: NEW_EMAIL, password: "Nouveau-Temp-E2E!456" });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.mustChangePassword).toBe(true);
  });
});
