// SQLite through Node's built-in node:sqlite (Node 22.13+), wrapped to look like the subset of the
// better-sqlite3 API the app uses: prepare().run/get/all, exec, pragma. It needs no native module,
// so it runs on cPanel hosts whose old system libraries cannot load better-sqlite3.

/** Returns node:sqlite's DatabaseSync class, or null when this Node version has no built-in SQLite. */
function loadDatabaseSync(): any | null {
  try {
    const mod = (process as any).getBuiltinModule?.('node:sqlite');
    return mod?.DatabaseSync || null;
  } catch {
    return null;
  }
}

export function isNodeSqliteAvailable(): boolean {
  return !!loadDatabaseSync();
}

// node:sqlite binds only null, numbers, bigints, strings and buffers. The app (written for
// better-sqlite3 and the JSON store) also passes undefined, booleans and objects.
function toBindable(value: any): any {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && !ArrayBuffer.isView(value)) return JSON.stringify(value);
  return value;
}

const bindAll = (params: any[]) => params.map(toBindable);

export function openNodeSqlite(filePath: string): any | null {
  const DatabaseSync = loadDatabaseSync();
  if (!DatabaseSync) return null;
  const raw = new DatabaseSync(filePath);

  return {
    driver: 'node-sqlite' as const,
    prepare(sql: string) {
      const statement = raw.prepare(sql);
      return {
        run: (...params: any[]) => statement.run(...bindAll(params)),
        get: (...params: any[]) => statement.get(...bindAll(params)),
        all: (...params: any[]) => statement.all(...bindAll(params)),
      };
    },
    exec(sql: string) {
      raw.exec(sql);
    },
    // better-sqlite3 style: pragma('journal_mode = WAL'), pragma('table_info(users)'),
    // pragma('integrity_check', { simple: true }) returns the first value of the first row
    pragma(source: string, options?: { simple?: boolean }) {
      const statement = raw.prepare(`PRAGMA ${source}`);
      if (options?.simple) {
        const row = statement.get();
        return row ? Object.values(row)[0] : undefined;
      }
      return statement.all();
    },
    close() {
      raw.close();
    },
  };
}
