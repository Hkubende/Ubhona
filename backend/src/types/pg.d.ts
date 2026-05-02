declare module "pg" {
  export class Client {
    constructor(config?: {
      connectionString?: string;
      connectionTimeoutMillis?: number;
      query_timeout?: number;
      statement_timeout?: number;
      ssl?: {
        rejectUnauthorized?: boolean;
      };
    });
    connect(): Promise<void>;
    query(queryText: string): Promise<unknown>;
    end(): Promise<void>;
  }
}
