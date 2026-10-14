import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomBytes,scryptSync} from 'node:crypto';
import pg from 'pg';

const source=new URL(process.env.DATABASE_URL??'');
assert.equal(source.hostname,'127.0.0.1','Solo se admiten bases locales de prueba');
assert.match(source.pathname,/_test$/);
const database='iatech_migration_'+Date.now()+'_test';
const root=new URL(source);root.pathname='/postgres';
const admin=new pg.Client({connectionString:root.href});await admin.connect();
await admin.query('CREATE DATABASE "'+database+'"');
const target=new URL(source);target.pathname='/'+database;
const client=new pg.Client({connectionString:target.href});await client.connect();
try {
  for(const file of ['20260930_init','20260930_security_activity']) await client.query(await readFile(new URL('../prisma/migrations/'+file+'/migration.sql',import.meta.url),'utf8'));
  const salt=randomBytes(16).toString('hex');
  const hash=salt+':'+scryptSync('migration-fixture-password',salt,32).toString('hex');
  await client.query("INSERT INTO public.categoria VALUES (99,'SEGURIDAD')");
  await client.query("INSERT INTO public.usuario(id_usuario,nombre,correo,contrasena_hash,id_categoria,rol) VALUES (77,'Prueba','migration@iatech.test',$1,99,'ADMIN')",[hash]);
  await client.query("INSERT INTO public.activo(id_activo,codigo,descripcion,id_categoria) VALUES (99,'SG-PRUEBA','Dato descartable',99)");
  await client.query("INSERT INTO public.seguridad VALUES (99,'Prueba',NULL,NULL)");
  const snapshot=(await client.query('SELECT * FROM public.usuario WHERE id_usuario=77')).rows[0];
  // Aplicar toda la migración en una transacción evita estados intermedios.
  await client.query(await readFile(new URL('../prisma/migrations/20261013_inventory_phase2/migration.sql',import.meta.url),'utf8'));
  assert.deepEqual((await client.query('SELECT * FROM core.usuario WHERE id_usuario=77')).rows[0],snapshot);
  assert.equal((await client.query('SELECT count(*) FROM public.activo')).rows[0].count,'0');
  assert.equal((await client.query('SELECT count(*) FROM public.seguridad')).rows[0].count,'0');
  const config=JSON.parse(await readFile(new URL('../contracts/inventarios-v2.json',import.meta.url),'utf8'));
  for(const[area,c]of Object.entries(config))assert.equal((await client.query('SELECT count(*) FROM "'+area+'"."'+c.table+'"')).rows[0].count,'0');
  console.log('Migración verificada: inventario de prueba descartado; IDs, cuentas y hashes conservados. Base: '+database);
} finally {await client.end();await admin.end();}
// La base de pruebas queda disponible para inspección; no se borra automáticamente.
