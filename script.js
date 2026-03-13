const SAVE_KEY = "bongo-doggo-save-v1";
const COMBO_TIMEOUT_MS = 1600;
const upgrades = [
  {
    id: "squeaky-ball",
    name: "Squeaky Ball",
    baseCost: 20,
    costScale: 1.42,
    apply: (state) => {
      state.treatsPerClick += 1;
    },
    describe: () => "+1 treat per tap"
  },
  {
    id: "treat-jar",
    name: "Treat Jar",
    baseCost: 45,
    costScale: 1.48,
    apply: (state) => {
      state.autoTreatsPerSecond += 0.7;
    },
    describe: () => "+0.7 treats each second"
  },
  {
    id: "training-bell",
    name: "Training Bell",
    baseCost: 95,
    costScale: 1.52,
    apply: (state) => {
      state.comboBoost += 0.08;
    },
    describe: () => "Combo multiplier grows faster"
  },
  {
    id: "dog-walker",
    name: "Dog Walker",
    baseCost: 180,
    costScale: 1.54,
    apply: (state) => {
      state.autoTreatsPerSecond += 2.4;
    },
    describe: () => "+2.4 treats each second"
  },
  {
    id: "cozy-bandana",
    name: "Cozy Bandana",
    baseCost: 320,
    costScale: 1.58,
    apply: (state) => {
      state.treatsPerClick += 4;
      state.comboBoost += 0.03;
    },
    describe: () => "+4 tap power and extra combo style"
  },
  {
    id: "pack-howl",
    name: "Pack Howl",
    baseCost: 640,
    costScale: 1.61,
    apply: (state) => {
      state.autoTreatsPerSecond += 8;
      state.treatsPerClick += 2;
    },
    describe: () => "Big passive gain plus stronger taps"
  }
];

const milestones = [
  { target: 50, name: "Snack Scout", detail: "Earn 50 total treats." },
  { target: 200, name: "Desk Dog", detail: "Keep the groove going through 200 treats." },
  { target: 800, name: "Paw Percussionist", detail: "Reach a serious jam session." },
  { target: 2500, name: "Office Headliner", detail: "Become the loudest pup in the room." }
];

const treatCountEl = document.getElementById("treat-count");
const comboCountEl = document.getElementById("combo-count");
const autoRateEl = document.getElementById("auto-rate");
const bestRunEl = document.getElementById("best-run");
const comboFillEl = document.getElementById("combo-fill");
const statusLineEl = document.getElementById("status-line");
const dogButtonEl = document.getElementById("dog-button");
const sparkLayerEl = document.getElementById("spark-layer");
const upgradeListEl = document.getElementById("upgrade-list");
const milestoneListEl = document.getElementById("milestone-list");
const resetButtonEl = document.getElementById("reset-button");

let saveTimer = null;
let animationTimer = null;
let lastLoopTime = performance.now();
const upgradeCardRefs = new Map();
const milestoneRefs = [];

function createDefaultState(bestRun = 0) {
  return {
    treats: 0,
    totalTreats: 0,
    treatsPerClick: 1,
    autoTreatsPerSecond: 0,
    combo: 0,
    comboBoost: 0,
    comboUntil: 0,
    taps: 0,
    bestRun,
    upgradesOwned: {}
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return createDefaultState();
    }

    const parsed = JSON.parse(raw);
    return {
      ...createDefaultState(parsed.bestRun || 0),
      ...parsed,
      upgradesOwned: parsed.upgradesOwned || {}
    };
  } catch (error) {
    return createDefaultState();
  }
}

const state = loadState();

function scheduleSave() {
  if (saveTimer) {
    return;
  }

  saveTimer = window.setTimeout(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    saveTimer = null;
  }, 250);
}

function formatNumber(value) {
  if (value >= 1000) {
    return Math.floor(value).toLocaleString("en-US");
  }

  if (value >= 100) {
    return value.toFixed(1).replace(".0", "");
  }

  if (value >= 10) {
    return value.toFixed(1).replace(".0", "");
  }

  return value.toFixed(1).replace(".0", "");
}

function formatTreatCost(value) {
  return Math.ceil(value).toLocaleString("en-US");
}

function getUpgradeCost(upgrade) {
  const owned = state.upgradesOwned[upgrade.id] || 0;
  return upgrade.baseCost * Math.pow(upgrade.costScale, owned);
}

function getComboMultiplier() {
  const ramp = Math.min(state.combo, 30) * (0.06 + state.comboBoost);
  return 1 + ramp;
}

function getClickReward() {
  return state.treatsPerClick * getComboMultiplier();
}

function updateBestRun() {
  state.bestRun = Math.max(state.bestRun, Math.floor(state.totalTreats));
}

function updateStatusLine() {
  if (state.combo >= 24) {
    statusLineEl.textContent = "Zoomies mode: the keyboard is barely keeping up.";
    return;
  }

  if (state.combo >= 12) {
    statusLineEl.textContent = "The dog has found the beat. Keep the combo alive.";
    return;
  }

  if (state.autoTreatsPerSecond >= 10) {
    statusLineEl.textContent = "A full snack crew is helping the dog keep time.";
    return;
  }

  if (state.totalTreats >= 200) {
    statusLineEl.textContent = "This desk puppy is becoming a proper headline act.";
    return;
  }

  statusLineEl.textContent = "The dog is ready to jam. Click anywhere on the pup to start.";
}

function updateStats() {
  treatCountEl.textContent = formatNumber(state.treats);
  comboCountEl.textContent = `${state.combo}x`;
  autoRateEl.textContent = formatNumber(state.autoTreatsPerSecond);
  bestRunEl.textContent = Math.floor(state.bestRun).toLocaleString("en-US");

  const comboRemaining = Math.max(0, state.comboUntil - Date.now());
  const comboRatio = Math.min(comboRemaining / COMBO_TIMEOUT_MS, 1);
  comboFillEl.style.width = `${comboRatio * 100}%`;

  updateStatusLine();
}

function renderMilestones() {
  if (milestoneRefs.length > 0) {
    syncMilestones();
    return;
  }

  milestones.forEach((milestone) => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = milestone.name;

    const detail = document.createElement("span");
    detail.textContent = milestone.detail;

    item.append(title, detail);
    milestoneListEl.appendChild(item);
    milestoneRefs.push({ item, milestone });
  });

  syncMilestones();
}

function renderUpgrades() {
  if (upgradeCardRefs.size > 0) {
    syncUpgradeCards();
    return;
  }

  upgrades.forEach((upgrade) => {
    const button = document.createElement("button");
    button.className = "upgrade-card";
    button.type = "button";
    button.dataset.upgradeId = upgrade.id;

    const top = document.createElement("div");
    top.className = "upgrade-card__top";

    const name = document.createElement("span");
    name.className = "upgrade-card__name";
    name.textContent = upgrade.name;

    const costEl = document.createElement("span");
    costEl.className = "upgrade-card__cost";

    const desc = document.createElement("p");
    desc.className = "upgrade-card__desc";
    desc.textContent = upgrade.describe();

    const ownedEl = document.createElement("div");
    ownedEl.className = "upgrade-card__owned";

    top.append(name, costEl);
    button.append(top, desc, ownedEl);
    button.addEventListener("click", () => buyUpgrade(upgrade.id));
    upgradeListEl.appendChild(button);

    upgradeCardRefs.set(upgrade.id, { button, costEl, ownedEl });
  });

  syncUpgradeCards();
}

function syncMilestones() {
  milestoneRefs.forEach(({ item, milestone }) => {
    item.classList.toggle("unlocked", state.totalTreats >= milestone.target);
  });
}

function syncUpgradeCards() {
  upgrades.forEach((upgrade) => {
    const ref = upgradeCardRefs.get(upgrade.id);
    const owned = state.upgradesOwned[upgrade.id] || 0;
    const cost = getUpgradeCost(upgrade);

    ref.button.disabled = state.treats < cost;
    ref.costEl.textContent = `${formatTreatCost(cost)} treats`;
    ref.ownedEl.textContent = `Owned: ${owned}`;
  });
}

function rerenderPanels() {
  renderUpgrades();
  renderMilestones();
  updateStats();
}

function addTreats(amount) {
  state.treats += amount;
  state.totalTreats += amount;
  updateBestRun();
  scheduleSave();
}

function tapDog() {
  const side = state.taps % 2 === 0 ? "left" : "right";
  state.taps += 1;
  state.combo += 1;
  state.comboUntil = Date.now() + COMBO_TIMEOUT_MS;

  const reward = getClickReward();
  addTreats(reward);
  updateBestRun();

  dogButtonEl.classList.remove("hit-left", "hit-right", "hype");
  void dogButtonEl.offsetWidth;
  dogButtonEl.classList.add(`hit-${side}`, "hype");

  if (animationTimer) {
    window.clearTimeout(animationTimer);
  }

  animationTimer = window.setTimeout(() => {
    dogButtonEl.classList.remove("hit-left", "hit-right", "hype");
  }, 170);

  spawnSpark(`+${formatNumber(reward)}`);
  rerenderPanels();
}

function spawnSpark(label) {
  const spark = document.createElement("span");
  spark.className = "spark";
  spark.textContent = label;
  spark.style.left = `${30 + Math.random() * 40}%`;
  spark.style.top = `${36 + Math.random() * 18}%`;
  sparkLayerEl.appendChild(spark);

  spark.addEventListener("animationend", () => {
    spark.remove();
  });
}

function buyUpgrade(id) {
  const upgrade = upgrades.find((item) => item.id === id);
  if (!upgrade) {
    return;
  }

  const cost = getUpgradeCost(upgrade);
  if (state.treats < cost) {
    return;
  }

  state.treats -= cost;
  state.upgradesOwned[id] = (state.upgradesOwned[id] || 0) + 1;
  upgrade.apply(state);
  scheduleSave();
  rerenderPanels();
}

function resetGame() {
  const confirmed = window.confirm("Reset this run and keep your best score?");
  if (!confirmed) {
    return;
  }

  const bestRun = state.bestRun;
  Object.assign(state, createDefaultState(bestRun));
  scheduleSave();
  rerenderPanels();
}

function handleLoop(now) {
  const deltaSeconds = Math.min((now - lastLoopTime) / 1000, 0.25);
  lastLoopTime = now;

  if (state.autoTreatsPerSecond > 0) {
    addTreats(state.autoTreatsPerSecond * deltaSeconds);
  }

  if (state.combo > 0 && Date.now() > state.comboUntil) {
    state.combo = 0;
  }

  updateStats();
  syncUpgradeCards();
  syncMilestones();
  window.requestAnimationFrame(handleLoop);
}

dogButtonEl.addEventListener("click", tapDog);

window.addEventListener("keydown", (event) => {
  if (event.repeat) {
    return;
  }

  if (event.code === "Space" || event.code === "Enter") {
    event.preventDefault();
    tapDog();
  }
});

resetButtonEl.addEventListener("click", resetGame);

rerenderPanels();
window.requestAnimationFrame(handleLoop);
