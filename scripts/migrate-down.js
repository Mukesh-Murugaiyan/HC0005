#!/usr/bin/env node

/**
 * Migration rollback script for Supabase database migrations.
 * Scans supabase/migrations/ for all DOWN migration files (*_down.sql)
 * and executes them in reverse numerical order using parameters loaded from .env file.
 *
 * Usage:
 *   npm run db:migrate:down
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const migrationsDir = path.join(__dirname, '../supabase/migrations');

function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return {};
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        env[key] = value;
      }
    }
  });
  return env;
}

function getSupabaseCommand() {
  const possibleCmds = [
    'supabase',
    path.join(__dirname, '../node_modules/.bin/supabase'),
    '/opt/homebrew/bin/supabase',
    '/usr/local/bin/supabase',
    'npx supabase',
  ];

  for (const cmd of possibleCmds) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore' });
      return cmd;
    } catch (e) {
      // ignore
    }
  }
  return null;
}

function rollbackMigrations() {
  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ Migrations directory not found at: ${migrationsDir}`);
    process.exit(1);
  }

  const env = loadEnv();
  const supabaseUrl =
    env.EXPO_PUBLIC_SUPABASE_URL ||
    env.NEXT_PUBLIC_SUPABASE_URL ||
    env.SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    '';

  let projectRef = env.SUPABASE_PROJECT_ID || process.env.SUPABASE_PROJECT_ID || '';
  if (!projectRef && supabaseUrl) {
    const match = supabaseUrl.match(/https?:\/\/([a-z0-9-]+)\.supabase/i);
    if (match) {
      projectRef = match[1];
    }
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('_down.sql'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log('⚠️ No rollback (*_down.sql) migration files found.');
    return;
  }

  console.log(`📋 Loaded environment configuration from .env:`);
  if (supabaseUrl) console.log(`  • Supabase URL : ${supabaseUrl}`);
  if (projectRef) console.log(`  • Project Ref  : ${projectRef}`);

  console.log(`\n🔄 Found ${files.length} rollback migration file(s) to execute in reverse order:`);
  files.forEach((f) => console.log(`  • ${f}`));

  const supabaseCmd = getSupabaseCommand();

  if (!supabaseCmd) {
    console.error('\n❌ Supabase CLI is not installed on this system.');
    console.error('👉 Run `npm install -g supabase` to install it globally.');
    process.exit(1);
  }

  let successCount = 0;

  for (const file of files) {
    const relativePath = path.join('supabase/migrations', file);
    console.log(`\n▶️ Executing rollback: ${file}...`);
    let rolledBack = false;

    try {
      execSync(`${supabaseCmd} db query --linked --file ${relativePath}`, {
        stdio: 'inherit',
        env: { ...process.env, ...env },
      });
      rolledBack = true;
      console.log(`✅ ${file} rolled back successfully.`);
    } catch (linkedErr) {
      if (env.SUPABASE_DB_URL) {
        console.warn(`ℹ️  --linked mode failed. Retrying with SUPABASE_DB_URL...`);
        try {
          execSync(`${supabaseCmd} db query --db-url "${env.SUPABASE_DB_URL}" --file ${relativePath}`, {
            stdio: 'inherit',
            env: { ...process.env, ...env },
          });
          rolledBack = true;
          console.log(`✅ ${file} rolled back successfully via Database URL.`);
        } catch (dbUrlErr) {
          // ignore
        }
      }

      if (!rolledBack) {
        console.warn(`ℹ️  Retrying rollback against local database (--local)...`);
        try {
          execSync(`${supabaseCmd} db query --local --file ${relativePath}`, {
            stdio: 'inherit',
            env: { ...process.env, ...env },
          });
          rolledBack = true;
          console.log(`✅ ${file} rolled back successfully on local database.`);
        } catch (localErr) {
          console.error(`\n❌ Failed to execute rollback: ${file}`);
          process.exit(1);
        }
      }
    }

    if (rolledBack) {
      successCount++;
    }
  }

  console.log(`\n🎉 Successfully rolled back ${successCount} migration(s).`);
}

rollbackMigrations();
