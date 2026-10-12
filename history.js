"use strict";
// Historical evidence stays outside the characters' knowledge. The playable
// encounters use fictional people and the same resource rules for both actors.
const historyRecord=id=>gameData.historyAtlas.records.find(r=>r.id===id);
let atlasTab="places",atlasRecordId="qinghe",atlasReferenceId="detail",atlasQuery="",encounterOpen=false;
function encounterAt(a){return (gameData.historicalEncounters||[]).find(e=>e.node===a.location&&!a.stories.some(s=>s.id===e.id));}
function encounterRecords(e){return e.records.map(historyRecord).filter(Boolean);}
function encounterStory(e,choiceId){const rs=encounterRecords(e);return {id:e.id,title:e.title,category:e.category,fact:rs.map(r=>r.fact).join(" "),scene:`本局选择：${e.choices.find(c=>c.id===choiceId).title}。${e.feedback} 情境人物、报酬与选择分支均为游戏创作。`,historyStatus:["史","游"],sources:[...new Set(rs.flatMap(r=>r.sources))],recordIds:e.records};}
function resolveEncounterFor(a,id,choiceId){
 const e=(gameData.historicalEncounters||[]).find(e=>e.id===id),choice=e?.choices.find(c=>c.id===choiceId);
 if(!e||!choice||e.node!==a.location||a.stories.some(s=>s.id===id)||!canAct(a,e.cost.actions)||a.money<e.cost.money)return null;
 // Validate first. Cancelled, repeated and unaffordable actions never mutate state.
 if(!spend(a,e.cost.actions))return null;
 a.money-=e.cost.money;const supported=choiceId===e.answer,before=a.credit;
 if(supported)resource(a,"credit",e.bonus.credit);
 const story=encounterStory(e,choiceId);addStory(a,story);const creditAdded=a.credit-before;
 log(`${a===state?"你":"阿文"}处理《${e.title}》：${choice.title}。用${e.cost.actions}行动、${e.cost.money}钱筹，收下${e.category}故事${supported?`；按线索办妥，信用+${creditAdded}${creditAdded<e.bonus.credit?"（已达上限）":""}`:"；经街坊指正，未获得额外信用"}。`,a);
 return {supported,creditAdded,story,feedback:e.feedback};
}
function evidenceExcerpt(r){return `<article class="evidence-excerpt"><strong>${esc(r.title)}</strong><blockquote>${esc(r.quote)}</blockquote><p>${esc(r.fact)}</p><small>${esc(r.period)} · ${esc(r.status)}<br>来稿：01史料录入表，第${r.workbookRows.join("、")}行。摘录已按说明校理。</small>${sourceMarkup(r.sources)}</article>`;}
async function investigate(){
 if(encounterOpen||choiceResolver||!state||state.ended)return;const e=encounterAt(state);if(!e)return showToast("这里的街坊难题已经办过，去另一处看看。");
 if(!canAct(state,e.cost.actions)||state.money<e.cost.money)return showToast("处理这件事需要1行动、1钱筹；可以先做工攒钱。");
 encounterOpen=true;
 try{
  const pending=choose(e.title,e.prompt,e.choices.map(c=>({value:c.id,title:c.title}))),panel=$("#choice-evidence");
  panel.hidden=false;panel.open=false;$("#choice-evidence-copy").innerHTML=`<p class="boundary">给玩家的史料线索，可先免费翻阅。每案每人限一次；确认选择用1行动、1钱筹，收一则故事；符合线索另得1信用（上限6）。退出不扣费。</p>${encounterRecords(e).map(evidenceExcerpt).join("")}`;
  const answer=await pending;if(answer===null)return;
  const result=resolveEncounterFor(state,e.id,answer);if(!result)return showToast("条件已变化，这次没有扣费，请重新查看。");
  render();animateActor();showHistory(result.story);
  $("#encounter-result-title").textContent=result.supported?"这件事，办妥了":"街坊帮你订正了线索";
  $("#encounter-result-copy").textContent=result.feedback;
  $("#encounter-result-reward").textContent=`用1行动、1钱筹 · 已收下${e.category}故事${result.supported?` · 信用+${result.creditAdded}${result.creditAdded<1?"（已达上限）":""}`:" · 本次无额外信用"}`;
  $("#encounter-result-evidence").innerHTML=encounterRecords(e).map(evidenceExcerpt).join("");
  $("#encounter-result").showModal();
 }finally{encounterOpen=false;}
}
function renderEncounter(){const e=encounterAt(state),box=$("#encounter-card");box.hidden=!e||!state.tutorialComplete;if(!e)return;$("#encounter-title").textContent=e.title;$("#encounter-brief").textContent=`${e.category}见闻 · 先看线索，再替街坊拿主意`;
 $("#encounter-button").disabled=state.ended||state.actions<e.cost.actions||state.money<e.cost.money;
 $("#encounter-cost").textContent=state.money<1?"需要1钱筹，可以先做工。":"1行动 · 1钱筹 → 故事；按线索办妥另得1信用";
}
function journeyGuide(){
 const id=state.exploreTargetId,n=nodeById(id);if(!n||!state.tutorialComplete)return null;
 if(id===state.location){const e=encounterAt(state),s=storyAtLocation(state);return {step:"坊巷寻踪",title:`到了：${n.name}`,description:e?"用刚才读到的线索，替街坊拿个主意。":"看看此地的故事，或另挑一站。",action:e&&state.money>=1?"investigate":s&&state.money>=experienceCost(state,s)?"experience":"stop-tracking",label:e&&state.money>=1?"处理街坊难题（1行动·1钱）":s&&state.money>=experienceCost(state,s)?"听这里的故事":"结束寻踪",reward:"查看史料和参考图都不扣行动。"};}
 const next=shortestPath(state.location,id)[0];if(!next)return null;
 return {step:"坊巷寻踪",title:`去找${n.name}`,description:`当前在${nodeById(state.location).name}。每次只走一步，沿途仍可接单。`,action:"move",target:next.to,label:`去${nodeById(next.to).name}（${movementQuote(state,next.edge).cost}行动）`,reward:"可直达与费用以游戏图为准，史料没有这些步数。"};
}
function beginJourney(id){if(!state||state.ended||!nodeById(id))return;$("#atlas-dialog").close();if(!state.tutorialComplete){showToast("先跟三步提示交完第一单，再自由寻踪。");return;}state.exploreTargetId=id;state.selectedMissionId=null;state.selectedNodeId=null;setView("map");render();scrollMapToward(state.location);}
function relationGraph(r){
 const nodes=r.nodes.map(nodeById).filter(Boolean);if(!nodes.length)return '';
 const height=nodes.length*92+24;
 const lines=(text,x,y)=>[...text].reduce((a,c,i)=>{if(i%13===0)a.push('');a[a.length-1]+=c;return a;},[]).map((t,i)=>`<tspan x="${x}" y="${y+i*19}">${esc(t)}</tspan>`).join('');
 return `<div class="relation-graph"><svg viewBox="0 0 660 ${height}" role="img" aria-label="${esc(r.title)}相关地点的文献地段关系。此图不表示方向和距离。"><defs><marker id="atlas-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#8d9e86"/></marker></defs>${nodes.map((n,i)=>{const y=20+i*92;return `<rect x="6" y="${y}" width="245" height="64" rx="12" fill="#f3ebd6" stroke="#bfaa82"/><text font-size="17" fill="#273f35">${lines(n.name,20,y+25)}</text><path d="M256 ${y+32}H415" stroke="#8d9e86" stroke-width="2" marker-end="url(#atlas-arrow)"/><text x="335" y="${y+23}" text-anchor="middle" font-size="13" fill="#52664e">文献所列地段</text><rect x="424" y="${y}" width="230" height="64" rx="12" fill="#e4ebda" stroke="#8d9e86"/><text font-size="17" fill="#273f35">${lines(n.zone,438,y+25)}</text>`;}).join('')}</svg><div class="relation-mobile">${nodes.map(n=>`<div><b>${esc(n.name)}</b><span>文献所列地段 ↓</span><em>${esc(n.zone)}</em></div>`).join('')}</div><small>关系示意，不表示距离和方位。街口为游戏汇合点；未列精确门牌。</small></div>`;
}
function renderAtlasPlaces(){
 const all=gameData.historyAtlas.records,query=atlasQuery.trim().toLowerCase(),matches=all.filter(r=>[r.title,r.fact,r.quote,...r.nodes.map(id=>nodeById(id)?.name||'')].join(' ').toLowerCase().includes(query));
 if(!matches.some(r=>r.id===atlasRecordId))atlasRecordId=matches[0]?.id;const r=historyRecord(atlasRecordId);
 $("#atlas-record-list").innerHTML=matches.map(r=>`<button data-record="${r.id}" aria-pressed="${r.id===atlasRecordId}"><strong>${esc(r.title)}</strong><small>${esc(r.period)}</small></button>`).join('')||'<p>没有找到这个词。试试“茶”“桥”或“中瓦”。</p>';
 $("#atlas-record-detail").innerHTML=r?`<span class="story-tag">${esc(r.status)}</span><h3>${esc(r.title)}</h3><p>${esc(r.fact)}</p>${relationGraph(r)}${r.nodes.length?`<div class="atlas-destinations">${r.nodes.map(id=>`<button data-journey="${id}" ${!state||state.ended?'disabled':''}>去找${esc(nodeById(id).name)}</button>`).join('')}</div><p class="small-note">设为目的地后，跟地图提示逐步前往；不会自动移动，也不扣行动。可在地图栏取消寻踪。</p>`:''}<details open><summary>原文与出处</summary>${evidenceExcerpt(r)}</details><p class="boundary">${esc(r.boundary)}</p>`:'<p>换一个词继续找吧。</p>';
}
function renderAtlasReferences(){
 const refs=gameData.historyAtlas.references,r=refs.find(x=>x.id===atlasReferenceId)||refs[0];
 $("#atlas-reference-select").innerHTML=refs.map(x=>`<button data-reference="${x.id}" aria-pressed="${x.id===r.id}">${esc(x.title)}</button>`).join('');
 $("#atlas-reference-description").innerHTML=`<h3>${esc(r.title)}</h3><p>${esc(r.guide)}</p><p class="boundary">${esc(r.note)}</p>`;
 const im=$("#atlas-reference-image");im.src=r.file;im.alt=r.title+'，用户提供，原始制图出处未详';$("#atlas-image-status").textContent='参考图加载中…';$("#atlas-reference-open").href=r.file;$("#atlas-reference-open").textContent='单独打开原图';setReferenceZoom(1);
}
function setReferenceZoom(value){const zoom=Math.min(4,Math.max(1,Number(value)||1));$("#atlas-reference-image").style.width=`${zoom*100}%`;$("#atlas-zoom").value=String(zoom);$("#atlas-zoom-label").textContent=`${Math.round(zoom*100)}%`;}
function openAtlas(tab="places",recordId){if(recordId)atlasRecordId=recordId;atlasTab=tab;atlasQuery='';$("#atlas-search").value='';renderAtlas();if(!$("#atlas-dialog").open)$("#atlas-dialog").showModal();}
function renderAtlas(){
 $$('#atlas-tabs [data-atlas-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.atlasTab===atlasTab)));
 for(const tab of ['places','references','audit'])$(`#atlas-${tab}`).hidden=tab!==atlasTab;
 if(atlasTab==='places')renderAtlasPlaces();
 if(atlasTab==='references')renderAtlasReferences();
 if(atlasTab==='audit')$("#atlas-audit-list").innerHTML=gameData.historyAtlas.audit.map(a=>`<article class="audit-item"><h3>${esc(a.title)}</h3><small>${a.rows.length?`01史料录入表，第${a.rows.join('、')}行`:'三张用户提供图片'}</small><p>${esc(a.issue)}</p><p><b>本版处理：</b>${esc(a.decision)}</p></article>`).join('');
}
function attachHistoryEvents(){
 $("#atlas-button").addEventListener('click',()=>openAtlas());$("#atlas-map-button").addEventListener('click',()=>openAtlas('references'));$("#start-atlas-button").addEventListener('click',()=>openAtlas());
 $("#encounter-button").addEventListener('click',investigate);
 $("#stop-journey").addEventListener('click',()=>{state.exploreTargetId=null;render();});
 $("#atlas-tabs").addEventListener('click',e=>{const b=e.target.closest('[data-atlas-tab]');if(b){atlasTab=b.dataset.atlasTab;renderAtlas();}});
 $("#atlas-search").addEventListener('input',e=>{atlasQuery=e.target.value;renderAtlasPlaces();});
 $("#atlas-dialog").addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.record){atlasRecordId=b.dataset.record;renderAtlasPlaces();$("#atlas-record-detail").scrollIntoView({block:'nearest'});}if(b.dataset.journey)beginJourney(b.dataset.journey);if(b.dataset.reference){atlasReferenceId=b.dataset.reference;renderAtlasReferences();}});
 $("#atlas-zoom").addEventListener('input',e=>setReferenceZoom(e.target.value));$("#atlas-image-fit").addEventListener('click',()=>{setReferenceZoom(1);$("#atlas-image-frame").scrollTo({left:0,top:0});});
 $("#atlas-reference-image").addEventListener('load',()=>{$("#atlas-image-status").textContent='可用滑条放大，再上下左右滚动查看。';});
 $("#atlas-reference-image").addEventListener('error',()=>{$("#atlas-image-status").textContent='图片未加载，请切换后重试，或单独打开原图。';});
}
