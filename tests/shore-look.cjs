/* Behavioural check for the 3D shore: look-around, gesture scoping, keyboard, reduced motion.
   Run: PLAYWRIGHT_MODULE=<path to playwright-core> THREE_MODULE=<path to three.module.js> node tests/shore-look.cjs
   (THREE_MODULE is optional; without it the CDN import map is used.) */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const {spawn}=require('node:child_process');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const shotDir=process.env.SHOT_DIR||'/tmp';
(async()=>{
 const server=spawn('python3',['-m','http.server',String(process.env.PORT||4193),'--bind','127.0.0.1'],{cwd:path.resolve(__dirname,'..'),stdio:'ignore'});let browser;const out=[];
 try{
  await new Promise(r=>setTimeout(r,500));
  browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const three=process.env.THREE_MODULE?fs.readFileSync(process.env.THREE_MODULE,'utf8'):null;
  for(const rm of [false,true]) for(const width of [390,1365]){ if(process.env.ONLY&&process.env.ONLY!==`${rm?'rm-':''}${width}`)continue;
   const height=width<500?844:800;
   const ctx=await browser.newContext({viewport:{width,height},reducedMotion:rm?'reduce':'no-preference',hasTouch:false});
   const page=await ctx.newPage();const errs=[];
   page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/ERR_FAILED/.test(m.text()))errs.push(m.text())});
   if(three)await page.route('**/three.module.js',r=>r.fulfill({contentType:'text/javascript',body:three}));
   await page.route('**/fonts.g*/**',r=>r.abort());
   await page.goto('http://127.0.0.1:'+(process.env.PORT||4193));await page.waitForSelector('#veil.gone');
   const view=()=>page.evaluate(()=>({yaw:+document.getElementById('island').dataset.yaw,pitch:+document.getElementById('island').dataset.pitch,chapterDots:[...document.querySelectorAll('.dot')].findIndex(d=>d.classList.contains('active')),has:document.getElementById('island').dataset.yaw!==undefined}));
   const tag=`${rm?'rm-':''}${width}`;const r={tag};
   assert.equal((await view()).has,false,'flat chapters must not report a look view');
   await page.click('.dot[data-scene="2"]');await page.waitForFunction(()=>document.getElementById('island').dataset.yaw!==undefined,null,{timeout:15000});await page.waitForTimeout(1500);
   const v0=await view();assert.equal((await view()).chapterDots,2);r.entry=v0;
   const drag=async(x0,y0,x1,y1,steps=10)=>{await page.mouse.move(x0,y0);await page.mouse.down();for(let i=1;i<=steps;i++){await page.mouse.move(x0+(x1-x0)*i/steps,y0+(y1-y0)*i/steps);await page.waitForTimeout(16)}await page.mouse.up()};
   await drag(width*0.25,height*0.4,width*0.75,height*0.4);await page.waitForTimeout(700);
   const v1=await view();assert(v1.yaw>v0.yaw+0.2,`drag right should turn the view: ${JSON.stringify(v1)}`);r.afterDrag=v1;
   if(rm){const a=(await view()).yaw;await page.waitForTimeout(700);const b=(await view()).yaw;assert.equal(a,b,'reduced motion: no glide after release');r.noGlide=true;}
   await drag(width*0.5,height*0.2,width*0.5,height*0.9,12);const v2=await view();assert(v2.pitch<=0.3201&&v2.pitch>=-0.2601,`pitch stays shallow ${v2.pitch}`);assert(Math.abs(v2.pitch)>0.05,'vertical drag should tilt');r.pitchClamped=v2.pitch;
   let turns=0;for(let i=0;i<14&&Math.abs((await view()).yaw)<7;i++){await drag(width*0.1,height*0.5,width*0.9,height*0.5,8);await page.waitForTimeout(rm?20:40);turns++}
   const v3=await view();assert(Math.abs(v3.yaw)>6.4,`azimuth is unbounded past one full turn: ${v3.yaw}`);r.fullTurn={yaw:v3.yaw,drags:turns};
   await page.mouse.click(width*0.5,height*0.15);await page.waitForTimeout(1500);const dock=await page.locator('#dock').boundingBox();const before=await view();
   await drag(dock.x+dock.width*0.2,dock.y+dock.height/2,dock.x+dock.width*0.2+30,dock.y+dock.height/2,6);await page.waitForTimeout(600);
   const afterDockDrag=await view();assert.equal(afterDockDrag.yaw,before.yaw,'drag that starts on the dock never turns the world');r.dockDragIgnored=true;
   await page.focus('#island');const y1=(await view()).yaw;await page.keyboard.press('ArrowLeft');await page.waitForTimeout(600);const y2=(await view()).yaw;assert(y2>y1+0.1,'arrow key turns the focused world');
   await page.keyboard.press('ArrowRight');await page.waitForTimeout(600);r.keyboard=true;
   await page.focus('.dot.active');const yk=(await view()).yaw;await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.getElementById('island').dataset.yaw===undefined,null,{timeout:15000}).catch(()=>{});
   assert.equal((await view()).has,false,'arrows on the dock change the chapter, and the shore view is left');r.dockArrowsChangeChapter=true;
   await page.screenshot({path:`${shotDir}/shore-after-leave-${tag}.png`});
   await page.mouse.click(width*0.5,height*0.15);await page.waitForTimeout(1200);
   await page.click('.dot[data-scene="2"]');await page.waitForFunction(()=>document.getElementById('island').dataset.yaw!==undefined,null,{timeout:20000});
   const re=await view();assert(Math.abs(re.yaw)<0.001,'the shore defines its own entry view');r.reentry=re.yaw;
   assert.deepEqual(errs,[],errs.join('\n'));
   out.push(r);await ctx.close();
  }
  console.log(JSON.stringify(out,null,1));
 }finally{if(browser)await browser.close();server.kill();await new Promise(r=>server.once('exit',r));}
})().catch(e=>{console.error(e);process.exitCode=1});
