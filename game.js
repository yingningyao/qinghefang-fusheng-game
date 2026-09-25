const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const SAVE_KEY = "qinghefang-fusheng-save-v2";
const TUTORIAL_MISSION_ID = "com_banner_delivery";
const TUTORIAL_EVENT_ID = "event_festival_market";
const TIME_LABELS = ["晨", "午", "昏", "夜", "晨", "午", "昏"];

let gameData = null;
let state = null;
let toastTimer = null;

const soloRoleCopy = {
  role_merchant_apprentice: "每轮首次完成跨区委托，额外获得1钱筹。",
  role_bookshop_assistant: "每轮首次取得文籍故事，体验费用减免1钱筹。",
  role_pharmacy_assistant: "每轮首次取得药业故事，体验费用减免1钱筹。",
  role_teahouse_runner: "在茶肆休整时，额外获得1枚舒心。",
  role_craft_apprentice: "每轮首次做工，额外获得1钱筹。",
  role_wharf_porter: "每轮第一次经过桥河路线，移动少花1次行动。"
};

const eventCopy = {
  event_festival_market: "本轮第一份完成的委托额外获得1钱筹。",
  event_crowded_bridge: "本轮第一次经过桥河路线多花1次行动；可以花1舒心抵消。",
  event_teahouse_rest: "本轮第一次在茶肆休整，可额外收下一张尚未获得的故事。",
  event_fire_watch: "本轮第一次相帮街坊时，额外获得1信用。",
  event_washe_show: "本轮在中瓦体验地点不花钱筹。",
  event_long_rain: "本轮第一次走远行路线多花1次行动；河埠脚夫不受影响。",
  event_rain_clears: "本轮第一次做工后，额外获得1舒心。",
  event_lantern_preparation: "本轮第一次相帮街坊，还会获得一则街坊故事。"
};

const aspirationSoloCopy = {
  asp_stable_living: "办成差事、积攒钱筹，并始终保住自己的信用。",
  asp_many_trades: "接触不同故事、做工，并完成一份跨区委托。",
  asp_trusted_neighbor: "提升信用，主动帮助街坊。",
  asp_walk_the_city: "走访更多地点、远行，并在不同区域留下故事。",
  asp_master_craft: "靠持续做工熟悉市井行当。",
  asp_keep_promises: "按期交付，不让手中的委托逾期。",
  asp_leisure: "积攒舒心，走访茶肆和游艺场所。",
  asp_help_neighbors: "多次相帮街坊，在忙碌中留下人情。"
};

const kindCopy = {
  start: "街口",
  shop: "商铺",
  evidenceSpot: "史料点",
  public: "公共空间",
  oldSite: "旧迹",
  extension: "城市扩展",
  remote: "远行地点"
};

const mapRows = {
  top: ["loc_chaotian_gate", "loc_zhongwa", "loc_prefecture_school", "loc_shuangfeng"],
  coreA: ["loc_ruan_fruit", "loc_yu_crown", "loc_jiang_tea", "loc_gu_cai_bo", "loc_gold_leaf", "loc_lantern_market", "loc_pan_tea", "loc_exchange", "loc_renai_pharmacy", "loc_jinyaojiu_pharmacy"],
  coreB: ["loc_qi_color", "loc_xu_thread", "loc_shu_paper", "loc_tong_candle", "loc_powder_shops", "loc_zhang_books", "loc_peng_lacquer", "loc_qingbi_fan", "loc_guo_medicine"],
  remote: ["loc_fengle", "loc_jujing_garden", "loc_lvtai_temple", "loc_taiping_old", "loc_gaoting"]
};

function displayPosition(id) {
  if (id === "loc_street") return { x: 50, y: 69 };
  const layouts = [
    [mapRows.top, 10, 12, 25],
    [mapRows.coreA, 29, 5, 10],
    [mapRows.coreB, 50, 6, 11],
    [mapRows.remote, 90, 10, 20]
  ];
  for (const [ids, y, start, step] of layouts) {
    const index = ids.indexOf(id);
    if (index >= 0) return { x: start + index * step, y };
  }
  const node = nodeById(id);
  return { x: node.x, y: node.y };
}

function nodeKind(node) { return kindCopy[node.kind] || node.kind; }

function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function nodeById(id) { return gameData.map.nodes.find((node) => node.id === id); }
function missionById(id) { return gameData.commissions.find((mission) => mission.id === id); }
function storyById(id) { return gameData.stories.find((story) => story.id === id); }
function eventById(id) { return gameData.cityEvents.find((event) => event.id === id); }
function roleById(id) { return gameData.roles.find((role) => role.id === id); }
function aspirationById(id) { return gameData.aspirations.find((aspiration) => aspiration.id === id); }
function markText(value) { return Array.isArray(value) ? value.join("·") : (value || "游"); }

function freshRoundFlags() {
  return {
    workedNodes: [], helped: false, rested: false, bridgeCrossed: false,
    remoteCrossed: false, roleBonus: false, festivalBonus: false,
    teahouseEvent: false, fireEvent: false, rainClearEvent: false, lanternEvent: false
  };
}

function initialState(roleId, aspirationId) {
  const missionDeck = shuffled(gameData.commissions.map((mission) => mission.id).filter((id) => id !== TUTORIAL_MISSION_ID));
  const eventDeck = [TUTORIAL_EVENT_ID, ...shuffled(gameData.cityEvents.map((event) => event.id).filter((id) => id !== TUTORIAL_EVENT_ID))];
  return {
    version: 2, started: true, round: 1, actions: 3, roleId, aspirationId,
    location: "loc_street", money: 5, credit: 1, comfort: 1, stories: [],
    activeMissions: [], completedMissionIds: [],
    publicMissionIds: [TUTORIAL_MISSION_ID, ...missionDeck.splice(0, 2)], missionDeck,
    eventDeck, eventIndex: 0, eventId: eventDeck[0], selectedMissionId: TUTORIAL_MISSION_ID,
    selectedNodeId: null, tutorialChoicePending: false, tutorialChoiceResolved: false,
    visited: ["loc_street"], worked: 0, helped: 0, onTime: 0, expired: 0,
    crossRegionCompleted: 0, comfortGained: 0, creditNeverZero: true,
    visitedTea: false, visitedEntertainment: false, roundFlags: freshRoundFlags(),
    ai: {
      roleId: "role_bookshop_assistant", aspirationId: "asp_keep_promises",
      location: "loc_zhongwa", money: 5, credit: 1, comfort: 1, stories: [],
      activeMission: null, completed: 0, onTime: 0, expired: 0, visited: ["loc_zhongwa"]
    },
    log: "顾家伙计正在街口等你：先领取新幌，再送到蒋检阅茶汤铺。"
  };
}

function saveGame() {
  if (state?.started) localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function restoreGame() {
  try {
    const restored = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!restored || restored.version !== 2 || !restored.started) return null;
    restored.roundFlags ||= freshRoundFlags();
    restored.ai ||= initialState(gameData.roles[0].id, gameData.aspirations[0].id).ai;
    restored.selectedNodeId ||= null;
    restored.tutorialChoicePending ||= false;
    restored.tutorialChoiceResolved ||= false;
    return restored;
  } catch {
    return null;
  }
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function log(message) {
  state.log = message;
  $("#log-copy").textContent = message;
}

function fillStartSelections() {
  const roleSelect = $("#role-select");
  const aspirationSelect = $("#aspiration-select");
  roleSelect.innerHTML = gameData.roles.map((role) => `<option value="${role.id}">${role.name}</option>`).join("");
  aspirationSelect.innerHTML = gameData.aspirations.map((aspiration) => `<option value="${aspiration.id}">${aspiration.name}</option>`).join("");
  roleSelect.value = "role_merchant_apprentice";
  aspirationSelect.value = "asp_many_trades";
  syncStartDescriptions();
  $("#continue-button").hidden = !restoreGame();
}

function syncStartDescriptions() {
  const role = roleById($("#role-select").value) || gameData.roles[0];
  const aspiration = aspirationById($("#aspiration-select").value) || gameData.aspirations[0];
  $("#role-description").textContent = soloRoleCopy[role.id] || role.playStyle;
  $("#aspiration-description").textContent = aspirationSoloCopy[aspiration.id] || aspiration.stages.join("；");
}

function edgeBetween(a, b) {
  return gameData.map.edges.find((edge) => (edge.from === a && edge.to === b) || (edge.from === b && edge.to === a));
}

function adjacentNodes(id) {
  return gameData.map.edges.filter((edge) => edge.from === id || edge.to === id)
    .map((edge) => edge.from === id ? edge.to : edge.from);
}

function currentEvent() { return eventById(state.eventId); }
function currentNode() { return nodeById(state.location); }
function activeMissionEntry(id) { return state.activeMissions.find((entry) => entry.id === id); }
function selectedMission() { return missionById(state.selectedMissionId); }
function missionNextStep(entry) { return missionById(entry.id).steps[entry.stepIndex] || null; }

function missionStepTargets(entry, step = missionNextStep(entry)) {
  if (!step) return [];
  if (step.node) return [step.node];
  if (Array.isArray(step.options)) {
    const visited = new Set(entry.visitedOptions || []);
    return step.options.filter((id) => !visited.has(id));
  }
  return [];
}

function pathActionCost(start, target) {
  return shortestPath(start, target).reduce((sum, item) => sum + Number(item.edge.cost || 1), 0);
}

function missionStepTarget(entry) {
  const targets = missionStepTargets(entry);
  if (targets.includes(state.location)) return state.location;
  return targets.sort((a, b) => pathActionCost(state.location, a) - pathActionCost(state.location, b))[0] || null;
}

function missionStepVerb(step) {
  if (!step) return "办理";
  if (step.action === "deliver") return "交付";
  if (step.action === "pickup") return "取货";
  if (step.action === "work") return "做工";
  if (step.action === "inspect") return "验看";
  if (step.action === "trade") return "交易";
  if (step.action === "firePatrol") return "巡火";
  if (step.action === "visitAnyTwo") return "游访";
  return "办理";
}

function missionStepDescription(entry) {
  const step = missionNextStep(entry);
  if (!step) return "已经办完";
  if (step.action === "visitAnyTwo") {
    const count = (entry.visitedOptions || []).length;
    return `在丰乐楼、聚景园外或履泰将军庙游访（${count}/2）`;
  }
  const target = missionStepTarget(entry);
  return `${target ? `到${nodeById(target).name}` : "按委托要求"}${missionStepVerb(step)}`;
}

function missionDestinationLabel(mission) {
  const last = mission.steps[mission.steps.length - 1];
  if (last.node) return nodeById(last.node).name;
  if (Array.isArray(last.options)) return "西湖东南三处选二";
  return "完成全部步骤";
}

function canAdvanceMissionHere(entry) {
  const step = missionNextStep(entry);
  if (!step) return false;
  return missionStepTargets(entry, step).includes(state.location);
}

function storyAtLocation(locationId) {
  return gameData.stories.find((story) => story.unlockNodes.includes(locationId) && !state.stories.some((owned) => owned.id === story.id));
}

function spendActions(count, message) {
  if (count > state.actions) {
    showToast(`还需要${count}次行动，本轮只剩${state.actions}次。`);
    return false;
  }
  state.actions -= count;
  log(message);
  return true;
}

function applyResource(key, amount) {
  if (key === "credit") state.credit = Math.max(0, Math.min(6, state.credit + amount));
  if (key === "comfort") {
    const before = state.comfort;
    state.comfort = Math.max(0, Math.min(3, state.comfort + amount));
    if (amount > 0) state.comfortGained += Math.max(0, state.comfort - before);
  }
  if (key === "money") state.money = Math.max(0, state.money + amount);
  if (state.credit === 0) state.creditNeverZero = false;
}

function refillPublicMissions() {
  while (state.publicMissionIds.length < 3) {
    if (!state.missionDeck.length) {
      const blocked = new Set([
        ...state.publicMissionIds, ...state.activeMissions.map((entry) => entry.id),
        ...state.completedMissionIds, state.ai.activeMission?.id
      ].filter(Boolean));
      state.missionDeck = shuffled(gameData.commissions.map((mission) => mission.id).filter((id) => !blocked.has(id)));
      if (!state.missionDeck.length) break;
    }
    state.publicMissionIds.push(state.missionDeck.shift());
  }
}

function recommendedPublicMission() {
  const selected = selectedMission();
  if (selected && state.publicMissionIds.includes(selected.id)) return selected;
  return state.publicMissionIds.map(missionById)
    .filter((mission) => mission && state.credit >= mission.requiredCredit && canPayFirstStep(mission))
    .sort((a, b) => pathActionCost(state.location, a.startNode) - pathActionCost(state.location, b.startNode))[0] || null;
}

function nextRouteStep(targetId) {
  if (!targetId || targetId === state.location) return null;
  return shortestPath(state.location, targetId)[0] || null;
}

function guideState() {
  if (!state) return null;
  if (state.tutorialChoicePending) {
    return {
      step: "新手 3/3", title: "第一单办成了，选一份额外谢礼",
      description: "钱筹让后续行动更宽裕，信用可以接到门槛更高的委托。",
      reward: "你已经获得钱筹、信用和第一类茶食故事。",
      action: "choice", actionLabel: "选择谢礼"
    };
  }
  if (state.actions <= 0) {
    return {
      step: "本轮完成", title: "三次行动已经用完",
      description: "让邻里行动后，城市进入下一时段；公开委托也可能被对方抢走。",
      reward: "下一轮会补满3次行动，并出现新的市情。",
      action: "end", actionLabel: "让邻里行动"
    };
  }

  if (state.selectedNodeId) {
    const edge = edgeBetween(state.location, state.selectedNodeId);
    if (edge) {
      return {
        step: "你选的路线", title: `准备前往${nodeById(state.selectedNodeId).name}`,
        description: "确认后才会扣除行动。也可以再点另一个金边地点改选。",
        reward: `移动消耗${edge.cost || 1}行动`, action: "move", targetNode: state.selectedNodeId,
        actionLabel: `确认前往（${edge.cost || 1}行动）`
      };
    }
  }

  const tutorial = missionById(TUTORIAL_MISSION_ID);
  const tutorialEntry = activeMissionEntry(TUTORIAL_MISSION_ID);
  const tutorialDone = state.completedMissionIds.includes(TUTORIAL_MISSION_ID);
  if (!tutorialDone && !tutorialEntry && state.publicMissionIds.includes(TUTORIAL_MISSION_ID)) {
    if (state.location === tutorial.startNode) {
      return {
        step: "新手 1/3", title: "先接下街口的第一单",
        description: "顾家伙计把新制彩帛幌交给你，请你送到一街之隔的蒋检阅茶汤铺。",
        reward: "花1行动 · 办成可得3钱筹、1信用和茶食故事",
        action: "take", missionId: TUTORIAL_MISSION_ID, targetNode: state.location,
        actionLabel: "领取《茶汤铺的新幌子》（1行动）"
      };
    }
    const route = nextRouteStep(tutorial.startNode);
    return {
      step: "新手 1/3", title: "先回到清河坊街口接单",
      description: "第一单已经为你保留。跟着地图上的红色“下一步”标记走。",
      reward: "到达后即可领取新幌",
      action: "move", targetNode: route?.to, missionId: TUTORIAL_MISSION_ID,
      actionLabel: route ? `前往${nodeById(route.to).name}（${route.edge.cost || 1}行动）` : "查看第一单"
    };
  }
  if (!tutorialDone && tutorialEntry) {
    const target = missionStepTarget(tutorialEntry);
    if (canAdvanceMissionHere(tutorialEntry)) {
      return {
        step: "新手 3/3", title: "把新幌交给茶汤铺掌柜",
        description: "交付后会立即结算奖励，并揭开真实店名与游戏情节的边界。",
        reward: "花1行动 · 本轮首份委托还会触发市情奖励",
        action: "advance", missionId: TUTORIAL_MISSION_ID, targetNode: state.location,
        actionLabel: "交付新幌（1行动）"
      };
    }
    const route = nextRouteStep(target);
    return {
      step: "新手 2/3", title: `前往${nodeById(target).name}`,
      description: "地图上的红色节点是目标，红色虚线是推荐路线。移动一段会消耗相应行动。",
      reward: `还剩${tutorialEntry.dueRound - state.round + 1}轮 · 送到后获得钱筹、信用和故事`,
      action: "move", targetNode: route?.to, missionId: TUTORIAL_MISSION_ID,
      actionLabel: route ? `前往${nodeById(route.to).name}（${route.edge.cost || 1}行动）` : "查看路线"
    };
  }

  const activeSelected = selectedMission() ? activeMissionEntry(selectedMission().id) : null;
  const activeEntry = activeSelected || state.activeMissions[0];
  if (activeEntry) {
    const mission = missionById(activeEntry.id);
    state.selectedMissionId = mission.id;
    if (canAdvanceMissionHere(activeEntry)) {
      const step = missionNextStep(activeEntry);
      return {
        step: "推荐下一步", title: `${missionStepVerb(step)}《${mission.name}》`,
        description: missionStepDescription(activeEntry), reward: `完成可得 ${rewardText(mission)}`,
        action: "advance", missionId: mission.id, targetNode: state.location,
        actionLabel: `${missionStepVerb(step)}（1行动）`
      };
    }
    const target = missionStepTarget(activeEntry); const route = nextRouteStep(target);
    return {
      step: "推荐下一步", title: `继续《${mission.name}》`,
      description: missionStepDescription(activeEntry), reward: `限第${activeEntry.dueRound}轮结束前`,
      action: "move", missionId: mission.id, targetNode: route?.to,
      actionLabel: route ? `向${nodeById(target).name}前进（${route.edge.cost || 1}行动）` : "查看委托"
    };
  }

  const localStory = storyAtLocation(state.location);
  if (localStory && state.money >= getExperienceCost(localStory)) {
    const cost = getExperienceCost(localStory);
    return {
      step: "发现历史", title: `听听《${localStory.title}》`,
      description: "故事会同时标明史料可知与本局虚构；收齐4类故事才能突破39分上限。",
      reward: `花1行动${cost ? `和${cost}钱筹` : ""} · 获得1则${localStory.category}故事`,
      action: "experience", targetNode: state.location,
      actionLabel: `体验地点（1行动${cost ? ` · ${cost}钱` : ""}）`
    };
  }

  const mission = recommendedPublicMission();
  if (mission) {
    state.selectedMissionId = mission.id;
    if (state.location === mission.startNode) {
      return {
        step: "推荐下一单", title: `领取《${mission.name}》`,
        description: `${nodeById(mission.startNode).name}出发，最后去${missionDestinationLabel(mission)}。`,
        reward: `限${mission.deadlineRounds}轮 · 可得 ${rewardText(mission)}`,
        action: "take", missionId: mission.id, targetNode: state.location,
        actionLabel: "领取委托（1行动）"
      };
    }
    const route = nextRouteStep(mission.startNode);
    return {
      step: "推荐下一单", title: `去${nodeById(mission.startNode).name}接单`,
      description: `《${mission.name}》适合你现在的信用与钱筹。`,
      reward: `办成可得 ${rewardText(mission)}`, action: "move", missionId: mission.id,
      targetNode: route?.to, actionLabel: route ? `沿路线前进（${route.edge.cost || 1}行动）` : "查看委托"
    };
  }

  return {
    step: "稳妥行动", title: "先在当前地点做工",
    description: "没有合适委托时，做工可以补充钱筹，为下一次体验或接单做准备。",
    reward: "花1行动 · 获得2钱筹", action: "work", targetNode: state.location,
    actionLabel: "做工（1行动 → +2钱）"
  };
}

function renderCoach() {
  const guide = guideState();
  if (!guide) return;
  $("#coach-step").textContent = guide.step;
  $("#coach-title").textContent = guide.title;
  $("#coach-description").textContent = guide.description;
  $("#coach-reward").textContent = guide.reward;
  const button = $("#coach-action");
  button.textContent = guide.actionLabel;
  button.dataset.action = guide.action || "";
  button.dataset.target = guide.targetNode || "";
  button.dataset.mission = guide.missionId || "";
  button.disabled = !guide.action;
}

function renderMap() {
  const guide = guideState();
  const guideTarget = guide?.targetNode || null;
  const guidePath = guideTarget && guideTarget !== state.location ? shortestPath(state.location, guideTarget) : [];
  const guideEdges = new Set(guidePath.map((item) => [item.from, item.to].sort().join("|")));
  const reachable = new Set(adjacentNodes(state.location));
  $("#route-layer").innerHTML = gameData.map.edges.map((edge) => {
    const from = displayPosition(edge.from);
    const to = displayPosition(edge.to);
    const active = edge.from === state.location || edge.to === state.location ? "active-route" : "";
    const recommended = guideEdges.has([edge.from, edge.to].sort().join("|")) ? "recommended-route" : "";
    return `<line class="route-line ${edge.kind === "main" ? "main" : ""} ${edge.kind} ${active} ${recommended}" x1="${from.x * 10}" y1="${from.y * 6.6}" x2="${to.x * 10}" y2="${to.y * 6.6}"/>`;
  }).join("");
  const taskNodes = new Set([
    ...state.publicMissionIds.map((id) => missionById(id)?.startNode),
    ...state.activeMissions.map((entry) => missionNextStep(entry)?.node)
  ].filter(Boolean));
  $("#map-nodes").innerHTML = gameData.map.nodes.map((node) => {
    const position = displayPosition(node.id);
    const classes = ["map-node", node.id === state.location ? "current" : "", reachable.has(node.id) ? "reachable" : "", taskNodes.has(node.id) ? "has-task" : "", state.selectedNodeId === node.id ? "selected" : "", guideTarget === node.id && node.id !== state.location ? "recommended" : ""].filter(Boolean).join(" ");
    const humanPawn = node.id === state.location ? '<i class="pawn human">你</i>' : "";
    const aiPawn = node.id === state.ai.location ? '<i class="pawn ai">邻</i>' : "";
    return `<button type="button" class="${classes}" data-node="${node.id}" style="left:${position.x}%;top:${position.y}%" aria-label="${node.name}，${nodeKind(node)}${reachable.has(node.id) ? "，可以移动到这里" : ""}">
      <strong>${node.name}</strong><small>${node.zone} · ${nodeKind(node)}</small><span class="pawn-row">${humanPawn}${aiPawn}</span>
    </button>`;
  }).join("");
}

function uniqueStoryCategories(stories = state.stories) { return [...new Set(stories.map((story) => story.category))]; }

function zonesWithStories() {
  return new Set(state.stories.map((owned) => {
    const original = storyById(owned.id);
    const node = original ? nodeById(original.unlockNodes[0]) : null;
    return node?.zone;
  }).filter(Boolean));
}

function aspirationProgress() {
  const id = state.aspirationId;
  const categories = uniqueStoryCategories().length;
  const zonesVisited = new Set(state.visited.map((value) => nodeById(value)?.zone).filter(Boolean)).size;
  let checks = [false, false, false];
  if (id === "asp_stable_living") checks = [state.completedMissionIds.length >= 3, state.money >= 8, state.creditNeverZero];
  if (id === "asp_many_trades") checks = [categories >= 3, state.worked >= 4, state.crossRegionCompleted >= 1];
  if (id === "asp_trusted_neighbor") checks = [state.credit >= 4, state.completedMissionIds.length >= 1, state.helped >= 2];
  if (id === "asp_walk_the_city") checks = [state.visited.length >= 5, zonesVisited >= 4, zonesWithStories().size >= 3];
  if (id === "asp_master_craft") checks = [state.worked >= 2, state.worked >= 4, state.worked >= 6];
  if (id === "asp_keep_promises") checks = [state.onTime >= 2, state.expired === 0, state.completedMissionIds.length >= 4];
  if (id === "asp_leisure") checks = [state.comfortGained >= 3, state.visitedTea && state.visitedEntertainment, state.comfort >= 2];
  if (id === "asp_help_neighbors") checks = [state.helped >= 1, state.helped >= 2, state.helped >= 3];
  return checks.map((done, index) => done && checks.slice(0, index).every(Boolean));
}

function aspirationProgressDetails() {
  const categories = uniqueStoryCategories().length;
  const zonesVisited = new Set(state.visited.map((value) => nodeById(value)?.zone).filter(Boolean)).size;
  const id = state.aspirationId;
  if (id === "asp_stable_living") return [`${Math.min(state.completedMissionIds.length, 3)}/3`, `${Math.min(state.money, 8)}/8`, state.creditNeverZero ? "保持中" : "已失守"];
  if (id === "asp_many_trades") return [`${Math.min(categories, 3)}/3`, `${Math.min(state.worked, 4)}/4`, `${Math.min(state.crossRegionCompleted, 1)}/1`];
  if (id === "asp_trusted_neighbor") return [`${Math.min(state.credit, 4)}/4`, `${Math.min(state.completedMissionIds.length, 1)}/1`, `${Math.min(state.helped, 2)}/2`];
  if (id === "asp_walk_the_city") return [`${Math.min(state.visited.length, 5)}/5`, `${Math.min(zonesVisited, 4)}/4`, `${Math.min(zonesWithStories().size, 3)}/3`];
  if (id === "asp_master_craft") return [`${Math.min(state.worked, 2)}/2`, `${Math.min(state.worked, 4)}/4`, `${Math.min(state.worked, 6)}/6`];
  if (id === "asp_keep_promises") return [`${Math.min(state.onTime, 2)}/2`, state.expired === 0 ? "保持中" : `${state.expired}次逾期`, `${Math.min(state.completedMissionIds.length, 4)}/4`];
  if (id === "asp_leisure") return [`${Math.min(state.comfortGained, 3)}/3`, `${Number(state.visitedTea) + Number(state.visitedEntertainment)}/2`, `${Math.min(state.comfort, 2)}/2`];
  if (id === "asp_help_neighbors") return [`${Math.min(state.helped, 1)}/1`, `${Math.min(state.helped, 2)}/2`, `${Math.min(state.helped, 3)}/3`];
  return ["0/1", "0/1", "0/1"];
}

function renderAspiration() {
  const aspiration = aspirationById(state.aspirationId);
  const progress = aspirationProgress();
  const details = aspirationProgressDetails();
  $("#aspiration-name").textContent = aspiration.name;
  $("#aspiration-copy").textContent = aspirationSoloCopy[aspiration.id] || aspiration.stages.join("；");
  $("#aspiration-track").innerHTML = aspiration.stages.map((stage, index) => {
    const done = progress[index];
    const current = !done && progress.slice(0, index).every(Boolean);
    return `<div class="stage ${done ? "done" : ""} ${current ? "current" : ""}"><b>${done ? "✓" : index + 1}</b><strong>${stage}</strong><small>${done ? "已完成" : details[index]}</small></div>`;
  }).join("");
}

function rewardText(mission) {
  const rewards = [];
  if (mission.rewards.money) rewards.push(`${mission.rewards.money}钱筹`);
  if (mission.rewards.credit) rewards.push(`${mission.rewards.credit}信用`);
  if (mission.rewards.comfort) rewards.push(`${mission.rewards.comfort}舒心`);
  if (mission.rewards.storyCategory) rewards.push(mission.rewards.storyCategory);
  return rewards.join(" · ");
}

function missionRouteMarkup(mission, entry = null) {
  const steps = [{ label: "接单", done: Boolean(entry), current: !entry }];
  mission.steps.forEach((step, index) => {
    const handledOnTake = index === 0 && step.action === "pickup" && step.node === mission.startNode;
    const targetLabel = step.node ? nodeById(step.node).name.replace(/[“”]/g, "") : "湖山选点";
    steps.push({
      label: handledOnTake ? "取货" : `${missionStepVerb(step)}·${targetLabel}`,
      done: Boolean(entry) && index < entry.stepIndex,
      current: Boolean(entry) && index === entry.stepIndex
    });
  });
  return `<div class="mission-route">${steps.map((step) => `<span class="${step.done ? "done" : ""} ${step.current ? "current" : ""}">${step.done ? "✓ " : ""}${step.label}</span>`).join("")}</div>`;
}

function renderMissions() {
  const owned = state.activeMissions.map((entry) => {
    const mission = missionById(entry.id);
    const selected = state.selectedMissionId === mission.id ? "selected" : "";
    return `<button type="button" class="mission-card owned ${selected}" data-mission="${mission.id}"><span class="mission-badge">手中</span><h3>${mission.name}</h3>
      <p>下一步：${missionStepDescription(entry)}</p>${missionRouteMarkup(mission, entry)}<div class="mission-meta"><span>限第${entry.dueRound}轮结束前</span><span>${rewardText(mission)}</span></div></button>`;
  }).join("");
  const publicCards = state.publicMissionIds.map((id) => {
    const mission = missionById(id);
    const selected = state.selectedMissionId === mission.id ? "selected" : "";
    const recommended = id === TUTORIAL_MISSION_ID && !state.completedMissionIds.includes(TUTORIAL_MISSION_ID) ? "recommended-mission" : "";
    return `<button type="button" class="mission-card ${selected} ${recommended}" data-mission="${mission.id}"><span class="mission-badge public">${recommended ? "新手推荐" : "公开"}</span><h3>${mission.name}</h3>
      <p>${nodeById(mission.startNode).name} → ${missionDestinationLabel(mission)}</p>${missionRouteMarkup(mission)}<div class="mission-meta"><span>领取1行动 · ${mission.deadlineRounds}轮内</span><span>${rewardText(mission)}</span></div></button>`;
  }).join("");
  $("#mission-list").innerHTML = `${owned ? '<div class="stack-label">手中委托</div>' + owned : ""}<div class="stack-label">市面上的差事</div>${publicCards || '<div class="empty-card">暂时没有新的委托</div>'}`;
}

function renderStoryCategories() {
  const categories = new Set(uniqueStoryCategories());
  $("#story-categories").innerHTML = gameData.storyCategories.map((category) => `<div class="story-category ${categories.has(category) ? "found" : ""}" title="${category}">${category.slice(0, 1)}</div>`).join("");
}

function getExperienceCost(story) {
  if (!story) return 1;
  if (currentEvent().id === "event_washe_show" && state.location === "loc_zhongwa") return 0;
  if (state.roleId === "role_bookshop_assistant" && story.category === "文籍" && !state.roundFlags.roleBonus) return 0;
  if (state.roleId === "role_pharmacy_assistant" && story.category === "药业" && !state.roundFlags.roleBonus) return 0;
  return 1;
}

function canPayFirstStep(mission) {
  return state.money >= missionAcceptanceCost(mission);
}

function missionAcceptanceCost(mission) {
  const first = mission.steps[0];
  if (!first || first.action !== "pickup" || first.node !== mission.startNode) return 0;
  return adjustedPurchaseCost(mission, first.cost?.money || 0);
}

function adjustedPurchaseCost(mission, base) {
  if (!base) return 0;
  const category = mission.rewards.storyCategory || "";
  if (state.roleId === "role_pharmacy_assistant" && category === "药业" && !state.roundFlags.roleBonus) return Math.max(0, base - 1);
  if (state.roleId === "role_craft_apprentice" && ["衣饰", "百工"].includes(category) && !state.roundFlags.roleBonus) return Math.max(0, base - 1);
  return base;
}

function renderActions() {
  const selected = selectedMission();
  const publicSelected = selected && state.publicMissionIds.includes(selected.id) ? selected : null;
  const activeSelected = selected ? activeMissionEntry(selected.id) : null;
  const nextStep = activeSelected ? missionNextStep(activeSelected) : null;
  const localStory = storyAtLocation(state.location);
  const experienceCost = getExperienceCost(localStory);
  const missionLimit = state.roleId === "role_bookshop_assistant" ? 3 : 2;
  const takeButton = $("[data-action='take']");
  const deliverButton = $("[data-action='deliver']");
  const experienceButton = $("[data-action='experience']");
  const acceptanceCost = publicSelected ? missionAcceptanceCost(publicSelected) : 0;
  takeButton.textContent = publicSelected ? `领取《${publicSelected.name}》（1行动${acceptanceCost ? ` · ${acceptanceCost}钱` : ""}）` : "先点选一份公开委托";
  takeButton.disabled = !publicSelected || publicSelected.startNode !== state.location || state.activeMissions.length >= missionLimit || state.credit < publicSelected.requiredCredit || !canPayFirstStep(publicSelected) || state.actions < 1;
  takeButton.title = !publicSelected ? "先点选下方公开委托" : publicSelected.startNode !== state.location ? `要到${nodeById(publicSelected.startNode).name}领取` : state.credit < publicSelected.requiredCredit ? "信用还不够" : "花1次行动领取";
  deliverButton.textContent = activeSelected && nextStep ? `${missionStepVerb(nextStep)}《${selected.name}》（1行动${nextStep.cost?.money ? ` · ${nextStep.cost.money}钱` : ""}）` : "先点选手中的委托";
  deliverButton.disabled = !activeSelected || !nextStep || !canAdvanceMissionHere(activeSelected) || state.actions < 1;
  deliverButton.title = activeSelected && nextStep && !canAdvanceMissionHere(activeSelected) ? missionStepDescription(activeSelected) : "花1次行动办理当前步骤";
  experienceButton.textContent = localStory ? `体验《${localStory.title}》（1行动${experienceCost ? ` · ${experienceCost}钱` : ""}）` : "这里的故事已收下";
  experienceButton.disabled = !localStory || state.money < experienceCost || state.actions < 1;
  experienceButton.title = localStory ? `获得1则${localStory.category}故事` : "换一个地点还能发现新故事";
  const workButton = $("[data-action='work']");
  workButton.textContent = "做工（1行动 → +2钱）";
  workButton.disabled = state.roundFlags.workedNodes.includes(state.location) || state.actions < 1;
  const helpButton = $("[data-action='help']");
  helpButton.textContent = "相帮街坊（1行动 · 1钱 → +1信用）";
  helpButton.disabled = state.roundFlags.helped || state.money < 1 || state.credit >= 6 || state.actions < 1;
  const restButton = $("[data-action='rest']");
  restButton.textContent = "休整（1行动 → +1舒心）";
  restButton.disabled = state.roundFlags.rested || state.comfort >= 3 || state.actions < 1;
}

function renderLocation() {
  const node = currentNode();
  const localStory = storyAtLocation(node.id);
  const hasRecordedStory = gameData.stories.some((story) => story.unlockNodes.includes(node.id));
  $("#location-name").textContent = node.name;
  $("#location-copy").textContent = `${node.zone}的${nodeKind(node)}。${localStory ? "这里还有一则故事可以收集。" : hasRecordedStory ? "这里的故事已经读过，仍可做工或办理委托。" : "这里可作为赶路、做工或办理委托的落脚点。"}`;
  $("#player-location").textContent = node.name;
}

function render() {
  if (!state) return;
  $("#round-label").textContent = `第 ${state.round} / 7 轮`;
  $("#time-label").textContent = TIME_LABELS[state.round - 1] || "夜";
  $("#actions-label").textContent = `尚有 ${state.actions} 次行动`;
  $("#player-role").textContent = roleById(state.roleId).name;
  $("#role-ability").textContent = `身份能力：${soloRoleCopy[state.roleId] || roleById(state.roleId).playStyle}`;
  $("#money-value").textContent = state.money;
  $("#credit-value").textContent = state.credit;
  $("#story-value").textContent = `${Math.min(uniqueStoryCategories().length, 4)}/4`;
  $("#ease-value").textContent = state.comfort;
  $("#ai-role").textContent = `${roleById(state.ai.roleId).name} · 电脑玩家`;
  $("#ai-location").textContent = nodeById(state.ai.location).name;
  $("#ai-money").textContent = `钱筹 ${state.ai.money}`;
  $("#ai-credit").textContent = `信用 ${state.ai.credit}`;
  $("#ai-stories").textContent = `故事 ${state.ai.stories.length}`;
  $("#event-name").textContent = currentEvent().name;
  $("#event-copy").textContent = eventCopy[currentEvent().id] || currentEvent().historyNote;
  $("#board-hint").textContent = state.selectedNodeId
    ? `已选择${nodeById(state.selectedNodeId).name}，按下方红色按钮才会移动。`
    : state.actions > 0 ? "先看下方红色推荐卡；金色边框表示相邻地点，点一下只会选中。" : "本轮行动已用完，让邻里行动后进入下一轮。";
  $("#end-turn-button").textContent = state.actions > 0 ? "提前结束本轮" : "让邻里行动";
  $("#log-copy").textContent = state.log;
  renderLocation(); renderAspiration(); renderCoach(); renderMissions(); renderStoryCategories(); renderMap(); renderActions(); saveGame();
  if (state.tutorialChoicePending && !$("#tutorial-choice-dialog").open) {
    setTimeout(() => { if (state?.tutorialChoicePending && !$("#tutorial-choice-dialog").open) $("#tutorial-choice-dialog").showModal(); }, 0);
  }
}

function scrollMapToward(nodeId) {
  const frame = $(".map-frame");
  const canvas = $("#map-canvas");
  const node = displayPosition(nodeId);
  if (!frame || !canvas || !node) return;
  frame.scrollTo({
    left: Math.max(0, canvas.scrollWidth * (node.x / 100) - frame.clientWidth / 2),
    top: Math.max(0, canvas.scrollHeight * (node.y / 100) - frame.clientHeight / 2),
    behavior: "smooth"
  });
}

function showHistory(entity) {
  const status = markText(entity.historyStatus);
  $("#history-mark").textContent = status.split("·")[0];
  $("#history-title").textContent = `${entity.name || entity.title} · ${status}`;
  $("#history-copy").textContent = entity.fact || entity.scene
    ? `史料可知：${entity.fact || entity.historyNote} 本局情境：${entity.scene || "具体行动和数值为游戏设计。"}`
    : entity.historyNote;
  $("#history-drawer").hidden = false;
}

function selectMapNode(targetId) {
  if (!state.started || targetId === state.location) {
    state.selectedNodeId = null;
    showHistory(nodeById(targetId));
    render();
    return;
  }
  const edge = edgeBetween(state.location, targetId);
  if (!edge) {
    state.selectedNodeId = null;
    showHistory(nodeById(targetId));
    showToast("这里不能一步到达。先沿金色相邻路线移动。 ");
    render();
    return;
  }
  state.selectedNodeId = targetId;
  log(`已选择${nodeById(targetId).name}：确认后花${edge.cost || 1}次行动移动。`);
  render();
}

function moveTo(targetId) {
  if (!state.started || targetId === state.location) { showHistory(nodeById(targetId)); return; }
  const edge = edgeBetween(state.location, targetId);
  if (!edge) {
    showHistory(nodeById(targetId));
    showToast("这个地点不与当前位置直接相连，请沿线路逐段移动。");
    return;
  }
  let cost = Number(edge.cost || 1);
  if (state.roleId === "role_wharf_porter" && edge.kind === "bridge" && !state.roundFlags.bridgeCrossed) {
    cost = Math.max(0, cost - 1);
    state.roundFlags.roleBonus = true;
  }
  if (currentEvent().id === "event_crowded_bridge" && edge.kind === "bridge" && !state.roundFlags.bridgeCrossed) {
    if (state.comfort > 0 && window.confirm("桥面拥挤。花1舒心抵消额外行动吗？")) state.comfort -= 1;
    else cost += 1;
  }
  if (currentEvent().id === "event_long_rain" && edge.kind === "remote" && !state.roundFlags.remoteCrossed && state.roleId !== "role_wharf_porter") cost += 1;
  if (!spendActions(cost, `你来到${nodeById(targetId).name}，花了${cost}次行动。`)) return;
  if (edge.kind === "bridge") state.roundFlags.bridgeCrossed = true;
  if (edge.kind === "remote") state.roundFlags.remoteCrossed = true;
  state.location = targetId;
  state.selectedNodeId = null;
  if (!state.visited.includes(targetId)) state.visited.push(targetId);
  const target = nodeById(targetId);
  if (target.name.includes("茶") || target.kind.includes("茶")) state.visitedTea = true;
  if (target.id === "loc_zhongwa" || target.kind.includes("瓦") || target.kind.includes("游")) state.visitedEntertainment = true;
  render(); scrollMapToward(targetId);
}

function takeMission() {
  const mission = selectedMission();
  if (!mission || !state.publicMissionIds.includes(mission.id)) return showToast("请先点选一份公开委托。");
  if (mission.startNode !== state.location) return showToast(`要到${nodeById(mission.startNode).name}领取这份委托。`);
  const limit = state.roleId === "role_bookshop_assistant" ? 3 : 2;
  if (state.activeMissions.length >= limit) return showToast(`手中最多保留${limit}份委托。`);
  if (state.credit < mission.requiredCredit) return showToast("信用还不够，先做工或相帮街坊。");
  const first = mission.steps[0];
  const handlesFirstStep = first?.action === "pickup" && first.node === mission.startNode;
  const cost = missionAcceptanceCost(mission);
  if (state.money < cost) return showToast("钱筹不够领取任务物品。");
  if (!spendActions(1, `你领取了《${mission.name}》。`)) return;
  state.money -= cost;
  if (handlesFirstStep && cost < (first.cost?.money || 0)) state.roundFlags.roleBonus = true;
  const entry = { id: mission.id, stepIndex: handlesFirstStep ? 1 : 0, dueRound: state.round + mission.deadlineRounds - 1, startRound: state.round, visitedOptions: [] };
  state.activeMissions.push(entry);
  state.publicMissionIds = state.publicMissionIds.filter((id) => id !== mission.id);
  state.selectedMissionId = mission.id;
  refillPublicMissions();
  if (entry.stepIndex >= mission.steps.length) completeMission(entry, mission);
  else log(`你领取了《${mission.name}》。下一步：${missionStepDescription(entry)}。`);
  render();
}

function advanceMission() {
  const mission = selectedMission();
  const entry = mission ? activeMissionEntry(mission.id) : null;
  if (!entry) return showToast("请先点选手中的委托。");
  const step = missionNextStep(entry);
  if (!step) return showToast("这份委托已经没有未完成步骤。");
  if (!canAdvanceMissionHere(entry)) return showToast(`下一步：${missionStepDescription(entry)}。`);
  const stepCost = step.cost?.money || 0;
  if (state.money < stepCost) return showToast("钱筹不够完成这一步。");
  if (!spendActions(1, `你在${currentNode().name}办好了《${mission.name}》的一步。`)) return;
  state.money -= stepCost;
  if (step.action === "visitAnyTwo") {
    entry.visitedOptions ||= [];
    if (!entry.visitedOptions.includes(state.location)) entry.visitedOptions.push(state.location);
    if (entry.visitedOptions.length >= 2) entry.stepIndex += 1;
    else log(`《${mission.name}》已游访1处，还要再访丰乐楼、聚景园外或履泰将军庙中的1处。`);
  } else {
    entry.stepIndex += 1;
  }
  if (entry.stepIndex >= mission.steps.length) completeMission(entry, mission);
  render();
}

function addMissionStory(mission, owner = state) {
  if (!mission.rewards.storyCategory) return;
  const id = `mission_${mission.id}`;
  if (owner.stories.some((story) => story.id === id)) return;
  owner.stories.push({ id, title: mission.name, category: mission.rewards.storyCategory, fact: mission.historyNote, scene: "你完成的路线和交付过程属于本局情境。", historyStatus: mission.historyStatus });
}

function completeMission(entry, mission) {
  const origin = nodeById(mission.startNode);
  const finalStep = mission.steps[mission.steps.length - 1];
  const destination = nodeById(finalStep.node || entry.visitedOptions?.at(-1) || finalStep.options?.[0] || state.location);
  const before = { money: state.money, credit: state.credit, comfort: state.comfort, categories: uniqueStoryCategories().length };
  applyResource("money", mission.rewards.money || 0);
  applyResource("credit", mission.rewards.credit || 0);
  applyResource("comfort", mission.rewards.comfort || 0);
  addMissionStory(mission);
  state.completedMissionIds.push(mission.id);
  if (state.round <= entry.dueRound) state.onTime += 1;
  if (origin.zone !== destination.zone) {
    state.crossRegionCompleted += 1;
    if (state.roleId === "role_merchant_apprentice" && !state.roundFlags.roleBonus) { state.money += 1; state.roundFlags.roleBonus = true; }
  }
  if (state.roleId === "role_teahouse_runner" && (destination.name.includes("茶") || destination.kind.includes("茶"))) applyResource("comfort", 1);
  if (currentEvent().id === "event_festival_market" && !state.roundFlags.festivalBonus) { state.money += 1; state.roundFlags.festivalBonus = true; }
  state.activeMissions = state.activeMissions.filter((item) => item !== entry);
  state.selectedMissionId = null;
  state.selectedNodeId = null;
  const gains = [];
  if (state.money > before.money) gains.push(`+${state.money - before.money}钱筹`);
  if (state.credit > before.credit) gains.push(`+${state.credit - before.credit}信用`);
  if (state.comfort > before.comfort) gains.push(`+${state.comfort - before.comfort}舒心`);
  if (uniqueStoryCategories().length > before.categories) gains.push(`新增${mission.rewards.storyCategory}故事`);
  log(`《${mission.name}》按时办成：${gains.join("、") || rewardText(mission)}。`);
  showToast(`办成了！${gains.join(" · ") || "奖励已经收入行囊"}`);
  if (mission.id === TUTORIAL_MISSION_ID && !state.tutorialChoiceResolved) state.tutorialChoicePending = true;
}

function experienceLocation() {
  const story = storyAtLocation(state.location);
  if (!story) return showToast("这里暂时没有新的故事。");
  const cost = getExperienceCost(story);
  if (state.money < cost) return showToast("还需要1钱筹才能在这里停留体验。");
  if (!spendActions(1, `你在${currentNode().name}听到了《${story.title}》。`)) return;
  state.money -= cost;
  if (cost === 0 && ["文籍", "药业"].includes(story.category)) state.roundFlags.roleBonus = true;
  state.stories.push({ ...story });
  showHistory(story); render();
}

function workHere() {
  if (state.roundFlags.workedNodes.includes(state.location)) return showToast("本轮已经在这里做过工了。");
  if (!spendActions(1, `你在${currentNode().name}做了一阵工，得到2钱筹。`)) return;
  state.money += 2; state.worked += 1; state.roundFlags.workedNodes.push(state.location);
  if (state.roleId === "role_craft_apprentice" && !state.roundFlags.roleBonus) {
    state.money += 1; state.roundFlags.roleBonus = true;
    log(`你在${currentNode().name}做工，手艺学徒能力让你共得到3钱筹。`);
  }
  if (currentEvent().id === "event_rain_clears" && !state.roundFlags.rainClearEvent) { applyResource("comfort", 1); state.roundFlags.rainClearEvent = true; }
  render();
}

function helpNeighbors() {
  if (state.roundFlags.helped) return showToast("本轮已经相帮过街坊。");
  if (state.money < 1) return showToast("至少需要1钱筹准备材料或跑腿。");
  if (!spendActions(1, `你在${currentNode().name}相帮街坊，信用增加。`)) return;
  state.money -= 1; applyResource("credit", 1); state.helped += 1; state.roundFlags.helped = true;
  if (currentEvent().id === "event_fire_watch" && !state.roundFlags.fireEvent) { applyResource("credit", 1); state.roundFlags.fireEvent = true; }
  if (currentEvent().id === "event_lantern_preparation" && !state.roundFlags.lanternEvent) {
    state.stories.push({ id:`lantern_${state.round}`, title:"灯市备料的人情", category:"街坊", fact:currentEvent().historyNote, scene:"你参与备料是本局情境。", historyStatus:currentEvent().historyStatus });
    state.roundFlags.lanternEvent = true;
  }
  render();
}

function restHere() {
  if (state.roundFlags.rested) return showToast("本轮已经休整过了。");
  if (!spendActions(1, `你在${currentNode().name}歇了片刻，恢复1舒心。`)) return;
  applyResource("comfort", 1); state.roundFlags.rested = true;
  const isTea = currentNode().name.includes("茶") || currentNode().kind.includes("茶");
  if (state.roleId === "role_teahouse_runner" && isTea) applyResource("comfort", 1);
  if (currentEvent().id === "event_teahouse_rest" && isTea && !state.roundFlags.teahouseEvent) {
    const available = shuffled(gameData.stories.filter((story) => !state.stories.some((owned) => owned.id === story.id)));
    if (available[0]) state.stories.push({ ...available[0] });
    state.roundFlags.teahouseEvent = true;
  }
  render();
}

function expirePlayerMissions() {
  const expired = state.activeMissions.filter((entry) => entry.dueRound <= state.round);
  if (!expired.length) return "";
  state.activeMissions = state.activeMissions.filter((entry) => !expired.includes(entry));
  state.expired += expired.length; applyResource("credit", -expired.length);
  if (expired.some((entry) => entry.id === state.selectedMissionId)) state.selectedMissionId = null;
  return `${expired.length}份委托逾期，信用下降。`;
}

function shortestPath(start, target) {
  if (start === target) return [];
  const distances = new Map([[start, 0]]); const previous = new Map(); const queue = [start];
  while (queue.length) {
    queue.sort((a, b) => distances.get(a) - distances.get(b));
    const current = queue.shift();
    if (current === target) break;
    gameData.map.edges.filter((edge) => edge.from === current || edge.to === current).forEach((edge) => {
      const next = edge.from === current ? edge.to : edge.from;
      const candidate = distances.get(current) + Number(edge.cost || 1);
      if (candidate < (distances.get(next) ?? Infinity)) {
        distances.set(next, candidate); previous.set(next, { node: current, edge });
        if (!queue.includes(next)) queue.push(next);
      }
    });
  }
  if (!previous.has(target)) return [];
  const path = []; let cursor = target;
  while (cursor !== start) {
    const item = previous.get(cursor); path.unshift({ from: item.node, to: cursor, edge: item.edge }); cursor = item.node;
  }
  return path;
}

function chooseAiMission() {
  const candidates = state.publicMissionIds.map(missionById).filter((mission) => {
    const first = mission.steps[0];
    const acceptanceCost = first?.action === "pickup" && first.node === mission.startNode ? (first.cost?.money || 0) : 0;
    return mission.id !== TUTORIAL_MISSION_ID && acceptanceCost <= state.ai.money && mission.requiredCredit <= state.ai.credit;
  });
  candidates.sort((a, b) => shortestPath(state.ai.location, a.startNode).length - shortestPath(state.ai.location, b.startNode).length);
  return candidates[0] || null;
}

function runAiTurn() {
  let actions = 3; const notes = []; let guard = 0;
  const finishAiMission = (mission) => {
    const active = state.ai.activeMission;
    state.ai.money += mission.rewards.money || 0;
    state.ai.credit = Math.min(6, state.ai.credit + (mission.rewards.credit || 0));
    addMissionStory(mission, state.ai); state.ai.completed += 1;
    if (state.round <= active.dueRound) state.ai.onTime += 1;
    notes.push(`办成《${mission.name}》`); state.ai.activeMission = null;
  };
  while (actions > 0 && guard < 12) {
    guard += 1;
    if (state.ai.activeMission) {
      const mission = missionById(state.ai.activeMission.id);
      const step = mission.steps[state.ai.activeMission.stepIndex];
      if (!step) { finishAiMission(mission); continue; }
      const visited = new Set(state.ai.activeMission.visitedOptions || []);
      const targets = step.node ? [step.node] : (step.options || []).filter((id) => !visited.has(id));
      if (targets.includes(state.ai.location)) {
        state.ai.money = Math.max(0, state.ai.money - (step.cost?.money || 0));
        if (step.action === "visitAnyTwo") {
          state.ai.activeMission.visitedOptions ||= [];
          state.ai.activeMission.visitedOptions.push(state.ai.location);
          if (state.ai.activeMission.visitedOptions.length >= 2) state.ai.activeMission.stepIndex += 1;
        } else state.ai.activeMission.stepIndex += 1;
        actions -= 1;
        if (state.ai.activeMission.stepIndex >= mission.steps.length) finishAiMission(mission);
        continue;
      }
      const target = targets.sort((a, b) => pathActionCost(state.ai.location, a) - pathActionCost(state.ai.location, b))[0];
      const next = target ? shortestPath(state.ai.location, target)[0] : null;
      if (next && Number(next.edge.cost || 1) <= actions) {
        const moveCost = Number(next.edge.cost || 1); state.ai.location = next.to;
        if (!state.ai.visited.includes(next.to)) state.ai.visited.push(next.to);
        actions -= moveCost; continue;
      }
    } else {
      const mission = chooseAiMission();
      if (mission) {
        if (state.ai.location === mission.startNode) {
          const first = mission.steps[0];
          const handlesFirstStep = first?.action === "pickup" && first.node === mission.startNode;
          state.ai.money -= handlesFirstStep ? (first.cost?.money || 0) : 0;
          state.ai.activeMission = { id: mission.id, stepIndex: handlesFirstStep ? 1 : 0, dueRound: state.round + mission.deadlineRounds - 1, visitedOptions: [] };
          state.publicMissionIds = state.publicMissionIds.filter((id) => id !== mission.id);
          refillPublicMissions(); actions -= 1; notes.push(`领取《${mission.name}》`); continue;
        }
        const next = shortestPath(state.ai.location, mission.startNode)[0];
        if (next && Number(next.edge.cost || 1) <= actions) {
          const moveCost = Number(next.edge.cost || 1); state.ai.location = next.to;
          if (!state.ai.visited.includes(next.to)) state.ai.visited.push(next.to);
          actions -= moveCost; continue;
        }
      }
    }
    state.ai.money += 2; actions -= 1; notes.push("做工");
  }
  if (state.ai.activeMission?.dueRound <= state.round) {
    state.ai.activeMission = null; state.ai.credit = Math.max(0, state.ai.credit - 1); state.ai.expired += 1; notes.push("有委托逾期");
  }
  return notes.join("、") || "在街巷中歇脚";
}

function endRound() {
  if (state.actions > 0 && !window.confirm(`本轮还有${state.actions}次行动，仍要提前结束吗？`)) return;
  const aiSummary = runAiTurn(); const expiry = expirePlayerMissions();
  if (state.round >= 7) { render(); showResult(); return; }
  state.round += 1; state.actions = 3; state.roundFlags = freshRoundFlags();
  state.selectedNodeId = null;
  state.eventIndex = (state.eventIndex + 1) % state.eventDeck.length; state.eventId = state.eventDeck[state.eventIndex];
  refillPublicMissions();
  log(`邻里本轮${aiSummary}。${expiry ? expiry + " " : ""}第${state.round}轮的市情是“${currentEvent().name}”。`);
  render();
}

function playerScore() {
  const aspiration = aspirationProgress().filter(Boolean).length * 8;
  const story = Math.min(12, state.stories.length * 2);
  const credit = Math.min(12, state.credit * 2);
  const money = Math.min(12, state.money);
  const raw = aspiration + story + credit + money;
  const categories = uniqueStoryCategories().length;
  return { aspiration, story, credit, money, categories, total: categories < 4 ? Math.min(39, raw) : raw };
}

function aiScore() {
  const aspiration = [state.ai.completed >= 1, state.ai.completed >= 3, state.ai.completed >= 5].filter(Boolean).length * 8;
  const story = Math.min(12, state.ai.stories.length * 2);
  const credit = Math.min(12, state.ai.credit * 2);
  const money = Math.min(12, state.ai.money);
  const categories = [...new Set(state.ai.stories.map((item) => item.category))].length;
  const raw = aspiration + story + credit + money;
  return { aspiration, story, credit, money, categories, total: categories < 4 ? Math.min(39, raw) : raw };
}

function showResult() {
  const mine = playerScore(); const ai = aiScore();
  $("#result-title").textContent = mine.total > ai.total ? "你的浮生志向更进一步" : mine.total === ai.total ? "你们各有一段好故事" : "邻里先完成了这一程";
  $("#result-copy").textContent = mine.categories < 4 ? `你收集了${mine.categories}类故事；不足4类，分数按规则封顶为39分。` : `你收集了${mine.categories}类故事，并完成了${aspirationProgress().filter(Boolean).length}段志向。`;
  $("#score-table").innerHTML = [["志向", mine.aspiration, ai.aspiration], ["故事", mine.story, ai.story], ["信用", mine.credit, ai.credit], ["钱筹", mine.money, ai.money], ["总分", mine.total, ai.total]]
    .map(([label, player, neighbor], index) => `<div class="score-row ${index === 4 ? "total" : ""}"><span>${label}</span><span>你 ${player}</span><span>邻里 ${neighbor}</span></div>`).join("");
  localStorage.removeItem(SAVE_KEY); $("#result-dialog").showModal();
}

function renderStoryBook() {
  $("#story-list").innerHTML = state.stories.length ? state.stories.map((story) => `<button type="button" class="story-item" data-story="${story.id}"><span class="story-tag">${story.category} · ${markText(story.historyStatus)}</span><h3>${story.title}</h3><p><strong>史料可知：</strong>${story.fact || story.historyNote}</p><p><strong>本局情境：</strong>${story.scene || "具体行动与数值为游戏创作。"}</p></button>`).join("") : '<div class="empty-card">还没有故事。到有故事的地点选择“体验地点”，或完成带故事奖励的委托。</div>';
}

function openNewGameDialog() {
  fillStartSelections();
  if (!$("#start-dialog").open) $("#start-dialog").showModal();
}

function chooseTutorialReward(choice) {
  if (!state?.tutorialChoicePending) return;
  if (choice === "credit") {
    applyResource("credit", 1);
    log("你留下帮掌柜挂稳新幌，额外获得1信用。现在可以自由选择下一条街巷。 ");
    showToast("选择完成：信用 +1");
  } else {
    applyResource("money", 2);
    log("你趁着早市又跑了一程，额外获得2钱筹。现在可以自由选择下一条街巷。 ");
    showToast("选择完成：钱筹 +2");
  }
  state.tutorialChoicePending = false;
  state.tutorialChoiceResolved = true;
  $("#tutorial-choice-dialog").close();
  render();
}

function attachEvents() {
  $("#role-select").addEventListener("change", syncStartDescriptions);
  $("#aspiration-select").addEventListener("change", syncStartDescriptions);
  $("#start-form").addEventListener("submit", (event) => {
    event.preventDefault(); state = initialState($("#role-select").value, $("#aspiration-select").value);
    $("#start-dialog").close(); render(); scrollMapToward(state.location);
  });
  $("#continue-button").addEventListener("click", () => {
    state = restoreGame(); if (!state) return;
    $("#start-dialog").close(); state.log = `继续第${state.round}轮，当前位置是${nodeById(state.location).name}。`;
    render(); scrollMapToward(state.location);
  });
  $("#map-nodes").addEventListener("click", (event) => {
    const button = event.target.closest("[data-node]"); if (button) selectMapNode(button.dataset.node);
  });
  $("#mission-list").addEventListener("click", (event) => {
    const card = event.target.closest("[data-mission]"); if (!card) return;
    state.selectedMissionId = card.dataset.mission;
    state.selectedNodeId = null;
    const mission = missionById(card.dataset.mission); const entry = activeMissionEntry(mission.id);
    const target = entry ? missionStepTarget(entry) : mission.startNode;
    log(`${entry ? "下一步" : "领取地点"}：${target ? nodeById(target).name : missionDestinationLabel(mission)}。`); render();
    if (target) scrollMapToward(target);
  });
  $("#coach-action").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const action = button.dataset.action;
    if (button.dataset.mission) state.selectedMissionId = button.dataset.mission;
    if (action === "move" && button.dataset.target) moveTo(button.dataset.target);
    if (action === "take") takeMission();
    if (action === "advance") advanceMission();
    if (action === "experience") experienceLocation();
    if (action === "work") workHere();
    if (action === "end") endRound();
    if (action === "choice" && !$("#tutorial-choice-dialog").open) $("#tutorial-choice-dialog").showModal();
  });
  $("#action-buttons").addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "take") takeMission();
    if (action === "deliver") advanceMission();
    if (action === "work") workHere();
    if (action === "experience") experienceLocation();
    if (action === "help") helpNeighbors();
    if (action === "rest") restHere();
  });
  $("#end-turn-button").addEventListener("click", endRound);
  $("#source-button").addEventListener("click", () => showHistory(currentNode()));
  $("#event-name").closest(".event-card").addEventListener("click", () => showHistory(currentEvent()));
  $("#history-close").addEventListener("click", () => $("#history-drawer").hidden = true);
  $("#rules-button").addEventListener("click", () => $("#rules-dialog").showModal());
  $("#story-book-button").addEventListener("click", () => { renderStoryBook(); $("#story-dialog").showModal(); });
  $("#story-list").addEventListener("click", (event) => {
    const item = event.target.closest("[data-story]"); if (!item) return;
    const story = state.stories.find((owned) => owned.id === item.dataset.story); if (story) showHistory(story);
  });
  $$(".close-dialog").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
  $("#restart-button").addEventListener("click", () => {
    if (state?.started && !window.confirm("放弃当前进度，重新选择角色和志向吗？")) return;
    localStorage.removeItem(SAVE_KEY); state = null; openNewGameDialog();
  });
  $("#play-again-button").addEventListener("click", () => { $("#result-dialog").close(); state = null; openNewGameDialog(); });
  $$('[data-tutorial-choice]').forEach((button) => button.addEventListener("click", () => chooseTutorialReward(button.dataset.tutorialChoice)));
}

async function registerWebMCP() {
  if (!document.modelContext?.registerTool) return;
  try {
    await document.modelContext.registerTool({
      name: "read_qinghefang_game_state",
      title: "读取清河坊游戏进度",
      description: "读取《清河坊浮生记》当前回合、位置、资源、委托与故事进度。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async (input) => {
        if (input && Object.keys(input).length) throw new Error("此工具不接受参数");
        return { content: [{ type: "text", text: state ? JSON.stringify({ round:state.round, actions:state.actions, location:nodeById(state.location).name, money:state.money, credit:state.credit, comfort:state.comfort, missions:state.activeMissions.map((entry) => missionById(entry.id).name), stories:state.stories.map((story) => story.title) }) : "尚未开局" }] };
      }
    });
  } catch (error) {
    console.warn("WebMCP tool registration skipped", error);
  }
}

async function init() {
  try {
    const response = await fetch("game-data.json");
    if (!response.ok) throw new Error("游戏资料加载失败");
    gameData = await response.json(); fillStartSelections(); attachEvents(); await registerWebMCP(); $("#start-dialog").showModal();
  } catch (error) {
    document.body.innerHTML = `<main class="load-error"><h1>游戏暂时没有加载完成</h1><p>${error.message}</p><button onclick="location.reload()">重新加载</button></main>`;
  }
}

init();
