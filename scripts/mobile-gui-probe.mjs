import { chromium } from '/var/lib/dsh/DSH-creator/deepseek-harness/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.mjs'
import fs from 'node:fs'
const output = process.argv[2] ?? '/tmp/dsh-mobile-gui-probe'
fs.mkdirSync(output, { recursive: true })
const browser = await chromium.launch({headless: true, executablePath:'/var/lib/dsh/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args:['--no-sandbox']})
try {
 const context = await browser.newContext({viewport:{width:Number(process.env.MOBILE_WIDTH??390),height:844},isMobile:Number(process.env.MOBILE_WIDTH??390)<768,hasTouch:Number(process.env.MOBILE_WIDTH??390)<768,colorScheme:process.env.MOBILE_DARK==='1'?'dark':'light',locale:'ru-RU'})
 const page = await context.newPage()
 const candidates = JSON.parse(fs.readFileSync('/tmp/dsh-mobile-login-urls.json','utf8'))
 const errors = []
 page.on('pageerror',error=>errors.push(error.message))
 page.on('console',message=>{ if(message.type()==='error') console.log('Browser error:', message.text().replace(/token=[^\s&]+/g,'token=[redacted]')) })
 const patched = process.env.MOBILE_CANDIDATE === '1'
 const intercepted = []
 if(patched) await page.route('**/*', async route => {
   if(route.request().resourceType() !== 'script') return route.continue()
   if(!route.request().url().includes('dsh-web-mobile') && !route.request().url().includes('dsh-workspace-groups')) return route.continue()
   const response = await route.fetch()
   let body = await response.text()
   for(const [id,name,file] of [['dsh-web-mobile','mobile','mobile-camera/package'],['dsh-workspace-groups','groups','mobile-groups-020-v2']]) {
     const regex = new RegExp('window\\.__ModuleLoader__\\.load\\(\\{\\s*id:\\s*["\\\']'+id+'["\\\']')
     const match = regex.exec(body)
     if(!match) continue
     const start = match.index
     const next = body.indexOf('window.__ModuleLoader__.load(',start+match[0].length)
     const replacement = fs.readFileSync('/var/lib/dsh/Project/dsh-workspace-groups/.staging/'+file+'/lib/client.js','utf8')
     body = body.slice(0,start)+replacement+'\n'+(next===-1?'':body.slice(next)); intercepted.push(name)
   }
   await route.fulfill({response,body})
 })
 await page.goto(candidates.at(-1) ?? process.env.DSH_WEB_URL, {waitUntil:'domcontentloaded'})
 console.log('Navigation:', await page.evaluate(()=>({origin:location.origin,path:location.pathname,text:document.body.innerText.slice(0,900)})))
 await page.screenshot({path:output+'/navigation.png'})
 await page.waitForSelector('.wgRoot, [data-composer-card]', {timeout:45000}).catch(async()=>{ console.log('Render diagnostics',JSON.stringify({errors,intercepted,text:await page.locator('body').innerText()})); throw new Error('Resident GUI did not render') })
 await page.waitForTimeout(1500)
 await page.screenshot({path:output+'/before-chat.png'})
 const result = await page.evaluate(()=>({
  title:document.title, controls:[...document.querySelectorAll('button')].filter(x=>x.getBoundingClientRect().width>0).map(x=>({label:x.getAttribute('aria-label'),title:x.title,attr:[...x.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value])})),
  frames:[...document.querySelectorAll('[data-dsh-frame]')].map(x=>[...x.attributes].map(a=>[a.name,a.value])),
  groups:!!document.querySelector('.wgRoot'),composer:!!document.querySelector('[data-composer-card]'), fileInputs:[...document.querySelectorAll('input[type=file]')].map(x=>({disabled:x.disabled,accept:x.accept,card:!!x.closest('[data-composer-card]')}))
 }))
 fs.writeFileSync(output+'/before.json',JSON.stringify({...result,errors},null,2))
 if(process.env.MOBILE_EXISTING_SESSION==='1') {
   await page.locator('[data-mobile-nav="fab"]').click()
   const group = page.locator('.wgCategoryRow').first()
   if(await group.count()) { await group.click(); await page.waitForTimeout(150) }
   const workspace = page.locator('.wgWorkspaceRow').first()
   if(await workspace.count()) { await workspace.click(); await page.waitForTimeout(150) }
   const session = page.locator('.wgSessionRow[data-session-id]').first()
   if(await session.count()) await session.click()
   await page.keyboard.press('Escape')
   await page.waitForTimeout(500)
   await page.screenshot({path:output+'/existing-session.png'})
   console.log('Session shortcut bounds',await page.locator('[data-mobile-shortcuts]').first().boundingBox())
   const camera = page.locator('[data-mobile-shortcuts] button').first()
   const chooser = page.waitForEvent('filechooser',{timeout:3000}).catch(()=>null)
   await camera.click()
   console.log('Deployed session camera chooser:',!!(await chooser))
   await page.locator('[data-mobile-shortcuts] button').nth(1).click()
   await page.waitForTimeout(300)
   await page.screenshot({path:output+'/right-panel.png'})
   console.log('Right panel opened',await page.evaluate(()=>({official:document.querySelector('[data-dsh-rightbar]')?.getBoundingClientRect().width,custom:document.querySelector('[data-dsh-panel]')?.getBoundingClientRect().width})))
   console.log(JSON.stringify({errors,output}));
 } else {
 const opener = page.locator('[data-mobile-nav="fab"]').first()
 if(await opener.count()) { await opener.click(); await page.waitForTimeout(350); await page.screenshot({path:output+'/before-groups.png'}); console.log('Drawer width:', await page.locator('.wgRoot').evaluate(x=>x.getBoundingClientRect().width)); if(patched && Number(process.env.MOBILE_WIDTH??390)<768) { await page.locator('.wgMobileFilterToggle').click(); await page.screenshot({path:output+'/filters.png'}); } }
 console.log('Layout bounds',await page.evaluate(()=>({body:document.documentElement.scrollWidth,width:innerWidth,shortcuts:document.querySelector('[data-mobile-shortcuts]')?getComputedStyle(document.querySelector('[data-mobile-shortcuts]')).display:null,filters:document.querySelector('.wgMobileFilterToggle')?getComputedStyle(document.querySelector('.wgMobileFilterToggle')).display:null})))
 if(patched && Number(process.env.MOBILE_WIDTH??390)<768) {
   await page.keyboard.press('Escape')
   const camera = page.locator('[data-mobile-shortcuts] button').first()
   await page.evaluate(()=>{const input=document.querySelector('[data-composer-card] input[type=file]');const old=input.click.bind(input);input.click=()=>{window.__cameraTap={accept:input.accept,capture:input.getAttribute('capture'),multiple:input.multiple};old()}})
   const chooser = page.waitForEvent('filechooser',{timeout:3000}).catch(()=>null)
   await camera.click()
   const picker = await chooser
   console.log('Camera tap:',await page.evaluate(()=>window.__cameraTap??null))
   console.log('Native picker opened', {opened:!!picker,multiple:picker?.isMultiple()})
   console.log('Camera attributes restored', await page.locator('[data-composer-card] input[type=file]').evaluate(x=>({accept:x.accept,capture:x.getAttribute('capture'),multiple:x.multiple})))
 }
 console.log(JSON.stringify({groups:result.groups,composer:result.composer,fileInputs:result.fileInputs,errors,intercepted,output}))
 }
} finally {await browser.close()}
