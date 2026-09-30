// Isolated native profile-patch and leaf lifecycle test. Never opens a DSH server.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
const dir=path.resolve(process.argv[2]),runtime=createRequire(path.resolve(process.argv[3],'package.json'))
const {Context}=await import(runtime.resolve('@deepseek-ai/cordis'))
const {default:Loader}=await import(runtime.resolve('@deepseek-ai/cordis-plugin-loader'))
const {applyEntryPatches}=await import(runtime.resolve('@deepseek-ai/cordis-plugin-include'))
const {default:Sessions}=await import(runtime.resolve('@deepseek-ai/dsh-session'))
const {default:Projections}=await import(runtime.resolve('@deepseek-ai/dsh-session-projection'))
const {default:Titles}=await import(runtime.resolve('@deepseek-ai/dsh-session-title'))
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sidebar-leaf-'))
fs.symlinkSync(path.resolve(process.argv[3],'node_modules'),path.join(temp,'node_modules'))
fs.writeFileSync(path.join(temp,'package.json'),'{"type":"module"}')
fs.copyFileSync(path.join(dir,'lib/index.js'),path.join(temp,'icons.mjs'))
fs.cpSync(path.resolve('packages/periodic-titles/lib'),path.join(temp,'titles'),{recursive:true})
const ctx=new Context(),routes=new Map()
ctx.provide('webServer',{register(route){assert(!routes.has(route.path),`duplicate ${route.path}`);routes.set(route.path,route);return()=>routes.delete(route.path)}})
ctx.provide('connection',{requestRejection:()=>undefined})
ctx.provide('llm',{async *stream(){throw Error('No live model in isolated verification')}})
await ctx.plugin(Sessions);await ctx.plugin(Projections);await ctx.plugin(Titles,{fallbackMaxWords:5,fallbackMaxBytes:40,maxTitleBytes:80})
await ctx.plugin(Loader,{baseUrl:pathToFileURL(path.join(temp,'entry.mjs')).href})
const prior=[{id:'workspace-groups',name:pathToFileURL(path.resolve(process.argv[4],'lib/index.js')).href,config:{filter:{status:'all',recency:'all',color:null}}},{id:'session-title-llm',name:runtime.resolve('@deepseek-ai/dsh-session-title-first-prompt-llm'),config:{targetWords:5,targetCjkCharacters:10,maxInputBytes:4096,maxOutputTokens:64,timeoutMs:60000}}]
const replacement=[{id:'workspace-groups-sidebar',name:pathToFileURL(path.join(temp,'icons.mjs')).href,config:{filter:{status:'all',recency:'all',color:null,workspaceId:''}}},{id:'periodic-session-titles',name:pathToFileURL(path.join(temp,'titles/index.js')).href,config:{everyMessages:5,targetWords:5,targetCjkCharacters:12,maxInputBytes:16384,maxOutputTokens:128,timeoutMs:60000,provider:'ninitux',model:'gemini-flash-high-latest'}}]
const patches=[{id:'workspace-groups',disabled:true},{id:'session-title-llm',disabled:true},{insert:replacement}]
try {
 const session=ctx.sessions.create(),storeUid=ctx.sessions.ctx.fiber.uid,titleUid=ctx.sessionTitle.ctx.fiber.uid
 for(const row of prior)await ctx.loader.create(row)
 await ctx.loader.await();assert.equal(routes.size,3)
 const warnings=[];const next=applyEntryPatches(prior,patches,(...args)=>warnings.push(args));assert.deepEqual(warnings,[]);assert.equal(next.length,4)
 // The real Include group synchronizes disabled leaves before inserting the new rows.
 await ctx.loader.root.update(next);await ctx.loader.await()
 assert.equal(routes.size,3);assert.equal(ctx.sessions.ctx.fiber.uid,storeUid);assert.equal(ctx.sessionTitle.ctx.fiber.uid,titleUid);assert.equal(ctx.sessions.get(session.id),session)
 for(const row of replacement)assert.equal(ctx.loader.resolve(row.id).fiber.state,2)
 console.log('PASS: native applyEntryPatches insert + Loader group update retain session/store/title-service fibers and dispose routes/projection cleanly')
}finally{await ctx.fiber.dispose();fs.rmSync(temp,{recursive:true,force:true})}
