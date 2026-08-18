/**
 * Minimal ambient types for `pg`.
 *
 * `@types/pg` is not part of the locked dependency list, and Kysely declares its
 * own structural `PostgresPool` interface, so this only needs to cover what we
 * actually call: constructing a pool, querying it, and ending it.
 */
declare module 'pg' {
  export interface PoolConfig {
    connectionString?: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  }

  export interface QueryResult<R = Record<string, unknown>> {
    rows: R[];
    rowCount: number;
    /** Narrowed to the commands Kysely's `PostgresQueryResult` expects. */
    command: 'UPDATE' | 'DELETE' | 'INSERT' | 'SELECT' | 'MERGE';
    fields: { name: string; dataTypeID: number }[];
  }

  export class Pool {
    constructor(config?: PoolConfig);
    query<R = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[]
    ): Promise<QueryResult<R>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
    on(event: 'error', listener: (err: Error) => void): this;
  }

  export interface PoolClient {
    query<R = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[]
    ): Promise<QueryResult<R>>;
    /** Kysely's streaming path passes a cursor instead of SQL; it is returned as-is. */
    query<C>(cursor: C): C;
    release(): void;
  }
}
