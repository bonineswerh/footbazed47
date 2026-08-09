import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./tests/e2e',
  timeout:30_000,
  expect:{timeout:7_000},
  fullyParallel:false,
  forbidOnly:Boolean(process.env.CI),
  retries:process.env.CI?2:0,
  workers:process.env.CI?1:undefined,
  reporter:[['list'],['html',{open:'never',outputFolder:'playwright-report'}]],
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
