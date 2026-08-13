import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

test('home stays inside the frontend performance budget',async({page})=>{
  await page.addInitScript(()=>{
    window.__FOOTBAZED_LAYOUT_SHIFTS__=[];
    try{
      new PerformanceObserver(list=>{
        for(const entry of list.getEntries()){
          if(entry.hadRecentInput)continue;
          window.__FOOTBAZED_LAYOUT_SHIFTS__.push({
            value:entry.value,
            sources:entry.sources.map(source=>({
              node:source.node?.id?`#${source.node.id}`:source.node?.className?`.${String(source.node.className).trim().replace(/\s+/gu,'.')}`:source.node?.tagName||'unknown',
              previousRect:source.previousRect.toJSON?.()||source.previousRect,
              currentRect:source.currentRect.toJSON?.()||source.currentRect
            }))
          });
        }
      }).observe({type:'layout-shift',buffered:true});
    }catch{}
  });
  await installSupabaseMock(page);
  await page.goto('/?__e2e=1#home');
  await expect(page.locator('#homeDashboardTitle')).toBeVisible();
  await page.waitForTimeout(800);

  const result=await page.evaluate(()=>{
    const assets=performance.getEntriesByType('resource')
      .filter(entry=>/\.(?:js|css)(?:\?|$)/u.test(entry.name))
      .map(entry=>({
        path:new URL(entry.name).pathname,
        bytes:entry.transferSize||entry.decodedBodySize||0
      }));
    return{
      metrics:window.FBZPerformance?.getSnapshot(),
      shifts:window.__FOOTBAZED_LAYOUT_SHIFTS__||[],
      assetBytes:assets.reduce((sum,entry)=>sum+entry.bytes,0),
      assetPaths:assets.map(entry=>entry.path)
    };
  });

  expect(result.metrics).toBeTruthy();
  expect(result.metrics.lcp).not.toBeNull();
  expect(result.metrics.lcp).toBeLessThanOrEqual(2_500);
  expect(result.metrics.cls,JSON.stringify(result.shifts,null,2)).toBeLessThanOrEqual(0.1);
  expect(result.assetBytes).toBeLessThanOrEqual(500*1024);
  expect(result.assetPaths).not.toContain('/js/admin.js');
  expect(result.assetPaths).not.toContain('/admin.css');
  expect(result.assetPaths).not.toContain('/js/entities.js');
  expect(result.assetPaths).not.toContain('/css/entities.css');
});
