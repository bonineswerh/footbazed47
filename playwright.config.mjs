import {defineConfig} from '@playwright/test';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';

const artifactsRoot=resolve(tmpdir(),'footbazed-playwright');

export default defineConfig({
  testDir:'./tests/e2e',
  outputDir:resolve(artifactsRoot,'test-results'),
  snapshotPathTemplate:'{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
  timeout:30_000,
  expect:{timeout:7_000},
  fullyParallel:false,
  forbidOnly:Boolean(process.env.CI),
  retries:process.env.CI?2:0,
  workers:process.env.CI?1:undefined,
  reporter:[['list'],['html',{open:'never',outputFolder:resolve(artifactsRoot,'playwright-report')}]],
  use:{
    baseURL:'http://127.0.0.1:4173',
    viewport:{width:1440,height:1000},
    colorScheme:'dark',
    screenshot:'only-on-failure',
    trace:'retain-on-failure'
  },
  webServer:process.env.PW_EXTERNAL_SERVER?undefined:{
    command:'node scripts/serve.mjs',
    url:'http://127.0.0.1:4173',
    reuseExistingServer:!process.env.CI,
    timeout:30_000
  },
  projects:[{name:'chromium',use:{browserName:'chromium'}}]
});
