import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { z } from 'zod';
import { writeJson } from '#lib/shared/artifacts.ts';
import { toPrettyJson } from '#lib/shared/strings.ts';

const Schema = z.object({ id: z.number(), title: z.string() });

describe('writeJson', () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'artifacts-test-'));
    path = join(dir, 'nested', '001.test.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('first write creates file and missing parent dirs with changed: true', () => {
    const result = writeJson(path, Schema, { id: 1, title: 'a' });
    expect(result).toEqual({ path, changed: true });
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).toBe(toPrettyJson({ id: 1, title: 'a' }));
  });

  test('identical second write skips the write and leaves mtime untouched', () => {
    writeJson(path, Schema, { id: 1, title: 'a' });
    const mtimeBefore = statSync(path).mtimeMs;

    const result = writeJson(path, Schema, { id: 1, title: 'a' });
    expect(result).toEqual({ path, changed: false });
    expect(statSync(path).mtimeMs).toBe(mtimeBefore);
  });

  test('different data rewrites the file with changed: true', () => {
    writeJson(path, Schema, { id: 1, title: 'a' });

    const result = writeJson(path, Schema, { id: 1, title: 'b' });
    expect(result).toEqual({ path, changed: true });
    expect(readFileSync(path, 'utf8')).toBe(toPrettyJson({ id: 1, title: 'b' }));
  });

  test('same JSON with different formatting is treated as changed', () => {
    writeJson(path, Schema, { id: 1, title: 'a' });
    writeFileSync(path, JSON.stringify({ id: 1, title: 'a' }));

    const result = writeJson(path, Schema, { id: 1, title: 'a' });
    expect(result).toEqual({ path, changed: true });
    expect(readFileSync(path, 'utf8')).toBe(toPrettyJson({ id: 1, title: 'a' }));
  });

  test('corrupt existing file is repaired without throwing', () => {
    writeJson(path, Schema, { id: 1, title: 'a' });
    writeFileSync(path, '{ not valid json');

    const result = writeJson(path, Schema, { id: 1, title: 'a' });
    expect(result).toEqual({ path, changed: true });
    expect(readFileSync(path, 'utf8')).toBe(toPrettyJson({ id: 1, title: 'a' }));
  });
});
