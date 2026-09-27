import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl } from "@/shared/config";
import * as schema from "./schema";

const sql = neon(getDatabaseUrl());
export const db = drizzle(sql, { schema });
