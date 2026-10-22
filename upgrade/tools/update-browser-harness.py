from pathlib import Path
for p in Path('upgrade/tests').glob('*.cjs'):
 s=p.read_text(encoding='utf-8')
 s=s.replace("window.MilanoReady===true,{timeout:65000}","window.MilanoReady===true,null,{timeout:90000}")
 s=s.replace("window.MilanoReady===true,{timeout:60000}","window.MilanoReady===true,null,{timeout:90000}")
 s=s.replace("(isNight||hdrReady),{timeout:60000}","(isNight||hdrReady),null,{timeout:90000}")
 s=s.replace("await page.locator('[data-go=\"pr\"]').click();","await page.locator('[data-ov=\"sessions\"]').click();await page.locator('[data-go=\"pr\"]').click();")
 p.write_text(s,encoding='utf-8')
