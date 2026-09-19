import { PGlite } from '@electric-sql/pglite';
const db = new PGlite('/tmp/bazaar-oldschema');
const r = await db.query(`select column_name, data_type from information_schema.columns where table_name='wallets'`);
console.log(r.rows);
const w = await db.query('select agent_id, balance from wallets where agent_id=$1', ['flight-01']);
console.log(w.rows);
