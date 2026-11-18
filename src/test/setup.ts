import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { closeDb } from "../storage/db";
import { setCharacterSource } from "../srd/character";
import { FIXTURE_CHARACTER } from "../srd/fixtures";

// Fresh in-memory IndexedDB per test; remounting <App/> within a test keeps it.
beforeEach(() => {
  closeDb();
  globalThis.indexedDB = new IDBFactory();
  setCharacterSource(async () => FIXTURE_CHARACTER);
});
afterEach(() => { cleanup(); setCharacterSource(null); });
