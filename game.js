// ---------- tiny helper ----------
var $ = (sel) => document.querySelector(sel);
var TOTAL = 0;
var TRASH = [];

// ---------- content per level ----------
const BOARD_DATA = [
  {
    depthName: "Oppervlak (0–200 m)",
    wasteInfo: "Plastic drijvers, visserijmateriaal en microplastics.",
    lifespan: [
      "Plastic tas — ~20 jaar",
      "Plastic rietje — ~200 jaar",
      "6-pack ringen — ~400 jaar",
    ],
    animals: ["Zeemeeuw", "Zeepaardje", "Schildpad (oppervlak)"],
    animalsInfo: "Dieren raken hier snel verstrikt of eten plastic.",
    types: ["bottle", "straw", "bag", "rings"],
  },
  {
    depthName: "Waterkolom (200–1000 m)",
    wasteInfo: "Zinkend plastic, textielvezels, “marine snow” + microplastics.",
    lifespan: ["Plastic beker — ~450 jaar", "Koffiecup — ~500 jaar"],
    animals: ["Makreel", "Kwal", "Inktvis"],
    animalsInfo: "Ze filteren voedsel en nemen microplastics op.",
    types: ["bottle", "textile", "metal", "bag"],
  },
  {
    depthName: "Diepe zee (1000–4000 m)",
    wasteInfo: "Metaal en glas, plastic zakken, verroeste visnetten.",
    lifespan: ["Plastic fles — ~450 jaar", "Rubber — 100+ jaar"],
    animals: ["Diepzeevissen", "Zeekomkommer"],
    animalsInfo: "Weinig licht; afval blijft heel lang liggen.",
    types: ["bottle", "bag", "net", "rubber"],
  },
  {
    depthName: "Abyssale vlaktes (4000–11.000 m)",
    wasteInfo: "Plastic zakken + microplastics, oud industrieel afval.",
    lifespan: ["Wegwerpluier — ~500 jaar", "Tandenborstel — ~500 jaar"],
    animals: ["Spons", "Kreeftachtigen"],
    animalsInfo: "Bijna geen afbraak → afval stapelt zich op.",
    types: ["bag", "metal", "micro", "rings"],
  },
];

const TYPE_META = {
  bottle: { label: "Fles", icon: "🧴" },
  straw: { label: "Rietje", icon: "🥤" },
  bag: { label: "Plastic zak", icon: "🛍️" },
  rings: { label: "6-pack ringen", icon: "⭕" },
  metal: { label: "Metaal/glas", icon: "🔩" },
  textile: { label: "Textiel", icon: "🧵" },
  net: { label: "Visnet", icon: "🪢" },
  rubber: { label: "Rubber/band", icon: "🛞" },
  micro: { label: "Microplastics", icon: "•" },
};

// ---------- simple drift (keep, but not used) ----------
AFRAME.registerComponent("simple-drift", {
  schema: { speed: { default: 0 } },
  tick: function (t, dt) {
    if (!dt || !this.data.speed) return;
    const obj = this.el.object3D;
    const f = new THREE.Vector3(0, 0, -1);
    obj.getWorldDirection(f);
    f.multiplyScalar((dt / 1000) * this.data.speed);
    obj.position.add(f);
  },
});

// ---------- net collector ----------
AFRAME.registerComponent("net-collector", {
  schema: { radius: { default: 0.65 }, score3D: { type: "selector" } },
  init: function () {
    this.score = 0;
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
    this.sync();
  },
  sync: function () {
    if (this.data.score3D) {
      this.data.score3D.setAttribute("text", "value", "Trash: " + this.score);
    }
    const lbl = $("#totalScoreLabel");
    if (lbl) lbl.textContent = "Total collected: " + TOTAL;
  },
  tick: function () {
    const netPos = this.el.object3D.getWorldPosition(this.tmp);
    for (let i = TRASH.length - 1; i >= 0; i--) {
      const e = TRASH[i];
      if (!e.parentNode) {
        TRASH.splice(i, 1);
        continue;
      }
      const p = e.object3D.getWorldPosition(this.tmp2);
      if (p.distanceTo(netPos) < this.data.radius) {
        const t = e.getAttribute("data-type") || "unknown";
        this.el.sceneEl.emit("trashcollected", { type: t }, true);

        e.parentNode.removeChild(e);
        TRASH.splice(i, 1);
        this.score++;
        TOTAL++;
        this.sync();

        const rightHand = $("#rightHand");
        if (rightHand) {
          rightHand.removeAttribute("animation__swing");
          rightHand.setAttribute(
            "animation__swing",
            "property: rotation; from: 0 0 0; to: -25 0 0; dur: 120; dir: alternate; easing: easeInOutSine; loop: 2"
          );
        }
      }
    }
  },
});

// ---------- boost (desktop) ----------
AFRAME.registerComponent("net-boost", {
  schema: { base: { default: 0.65 }, boosted: { default: 0.95 } },
  init: function () {
    const net = this.el.components["net-collector"];
    if (!net) return;
    const setBase = () => (net.data.radius = this.data.base);
    const setBoost = () => (net.data.radius = this.data.boosted);
    window.addEventListener("mousedown", setBoost);
    window.addEventListener("mouseup", setBase);
    window.addEventListener("blur", setBase);
  },
});

// ---------- turtle ----------
AFRAME.registerComponent("turtle-guide", {
  schema: { offset: { default: "-0.4 0 -1.2" }, follow: { default: false } },
  init: function () {
    const o = this.data.offset.split(" ").map(parseFloat);
    this.off = new THREE.Vector3(o[0], o[1], o[2]);
    this.t = 0;
  },
  tick: function (t, dt) {
    this.t += dt / 1000;
    if (!this.data.follow) return;
    const rig = $("#rig").object3D;
    const f = new THREE.Vector3(0, 0, -1);
    rig.getWorldDirection(f);
    const base = rig.position.clone().add(f.multiplyScalar(2.3));
    base.y += 0.2 * Math.sin(this.t * 1.2);
    this.el.object3D.position.copy(base.add(this.off));
    this.el.object3D.lookAt(
      rig.position.x,
      rig.position.y + 0.2,
      rig.position.z
    );
  },
});

// ---------- trash spawner (close + only up/down) ----------
AFRAME.registerComponent("simple-trash-spawner", {
  schema: {
    count: { default: 25 },
    types: { default: "bottle,straw,bag,rings" },
  },
  init: function () {
    const typeList = this.data.types
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    for (let i = 0; i < this.data.count; i++) {
      const e = document.createElement("a-entity");
      e.className = "trash";
      const t = typeList[Math.floor(Math.random() * typeList.length)];
      e.setAttribute("data-type", t);

      // shape
      const shapes = ["box", "sphere", "cylinder"];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      if (shape === "box")
        e.setAttribute(
          "geometry",
          "primitive: box; depth:0.25; height:0.1; width:0.18"
        );
      if (shape === "sphere")
        e.setAttribute("geometry", "primitive: sphere; radius:0.12");
      if (shape === "cylinder")
        e.setAttribute(
          "geometry",
          "primitive: cylinder; radius:0.08; height:0.22"
        );

      const colors = ["#c9e7ff", "#ffcc66", "#ff8888", "#a0ffb3", "#ffd1dc"];
      e.setAttribute(
        "material",
        "color:" + colors[Math.floor(Math.random() * colors.length)]
      );

      // spawn in a small bubble around player (0,1.6, -1.2 ish)
      const x = (Math.random() * 2 - 1) * 2.1; // -2.1..2.1
      const z = -1.5 + (Math.random() * 2 - 1) * 2.1; // around -1.5
      const y = 0.8 + Math.random() * 1.7; // 0.8..2.5
      e.setAttribute("position", `${x} ${y} ${z}`);

      // only up/down float
      const toY = y + 0.5 + Math.random() * 0.6;
      e.setAttribute(
        "animation__float",
        `property: position; dir: alternate; loop: true; dur: ${
          2500 + Math.random() * 2000
        }; to: ${x} ${toY} ${z}`
      );

      this.el.appendChild(e);
      TRASH.push(e);
    }
  },
});

// ---------- hand-vr-sync ----------
AFRAME.registerComponent("hand-vr-sync", {
  init: function () {
    this.scene = this.el.sceneEl;
    this.rig = this.el;
    this.leftRigHand = $("#leftHand");
    this.rightRigHand = $("#rightHand");
    this.net = $("#net");
    this.leftCtrl = $("#leftController");
    this.rightCtrl = $("#rightController");
    this.scene.addEventListener("enter-vr", () => this.toVR());
    this.scene.addEventListener("exit-vr", () => this.toDesktop());
  },
  toVR: function () {
    if (this.leftCtrl && this.leftRigHand) {
      this.leftCtrl.appendChild(this.leftRigHand);
      this.leftRigHand.setAttribute("visible", true);
      this.leftRigHand.object3D.position.set(0.02, -0.03, -0.13);
    }
    if (this.rightCtrl && this.rightRigHand) {
      this.rightCtrl.appendChild(this.rightRigHand);
      this.rightRigHand.setAttribute("visible", true);
      this.rightRigHand.object3D.position.set(0.02, -0.03, -0.13);
    }
    if (this.net && this.rightRigHand) {
      this.rightRigHand.appendChild(this.net);
      this.net.object3D.position.set(0, -0.02, -0.18);
    }
  },
  toDesktop: function () {
    if (this.rig && this.leftRigHand) {
      this.rig.appendChild(this.leftRigHand);
      this.leftRigHand.setAttribute("visible", true);
      this.leftRigHand.object3D.position.set(-0.25, -0.15, -0.5);
    }
    if (this.rig && this.rightRigHand) {
      this.rig.appendChild(this.rightRigHand);
      this.rightRigHand.setAttribute("visible", true);
      this.rightRigHand.object3D.position.set(0.25, -0.15, -0.5);
    }
  },
});

// ---------- start-panel (3D) ----------
AFRAME.registerComponent("start-panel", {
  init: function () {
    this.el.addEventListener("click", () => {
      this.el.setAttribute("visible", false);
      const gm = document.querySelector("[game-manager]");
      if (gm && gm.components["game-manager"]) {
        gm.components["game-manager"].startTransition();
      }
    });
  },
});

// ---------- controller debug ----------
AFRAME.registerComponent("controller-debug", {
  init: function () {
    const s = document.createElement("a-sphere");
    s.setAttribute("radius", 0.03);
    s.setAttribute("color", "#ff0");
    s.setAttribute("position", "0 0 -0.1");
    this.el.appendChild(s);

    this.el.addEventListener("triggerdown", () => {
      s.setAttribute(
        "animation__pulse",
        "property: scale; to: 1.6 1.6 1.6; dur: 120; dir: alternate; loop: 2"
      );
      console.log("triggerdown from controller");
    });
  },
});

// ---------- GAME MANAGER ----------
AFRAME.registerComponent("game-manager", {
  init: function () {
    this.dialog = $("#dialog");
    this.dialogBtn = $("#dialogBtn");
    this.info = $("#info");
    this.infoBtn = $("#infoBtn");
    this.infoText = $("#infoText");
    this.levelTitle = $("#levelTitle");
    this.timerLabel = $("#timerLabel");

    this.scene = $("#scene");
    this.sky = $("#sky");
    this.beach = $("#beachEnv");
    this.under = $("#underwaterEnv");
    this.rig = $("#rig");
    this.turtle = $("#turtle");
    this.spawner = $("#spawner");

    this.levels = [
      { name: "Level 1 – Oppervlak", time: 90 },
      { name: "Level 2 – Waterkolom", time: 60 },
      { name: "Level 3 – Diepe zee", time: 45 },
      { name: "Level 4 – Abyssale vlaktes", time: 30 },
    ];
    this.i = -1;
    this.timer = 0;
    this.stats = {};
    this.skyColors = ["#6cacbb", "#2e7991", "#0b4960", "#052e42"];

    this.scene.addEventListener("trashcollected", (ev) => {
      const t = (ev.detail && ev.detail.type) || "unknown";
      this.stats[t] = (this.stats[t] || 0) + 1;
    });

    if (this.dialogBtn) this.dialogBtn.onclick = () => this.startTransition();
    if (this.dialog)
      this.dialog.addEventListener("click", (e) => {
        if (e.target.id === "dialog") this.startTransition();
      });
    window.addEventListener("keydown", (e) => {
      if ((e.code === "Enter" || e.code === "Space") && this.i < 0) {
        this.startTransition();
      }
    });
  },

  startTransition: function () {
    if (this.dialog) this.dialog.classList.add("hidden");
    const obj = this.rig.object3D;
    const startZ = obj.position.z,
      startY = obj.position.y;
    const targetZ = -1.2,
      targetY = 1.6;
    let t0 = null;
    const step = (ts) => {
      if (!t0) t0 = ts;
      const k = Math.min(1, (ts - t0) / 1200);
      obj.position.z = THREE.MathUtils.lerp(startZ, targetZ, k);
      obj.position.y = THREE.MathUtils.lerp(startY, targetY, k);
      if (k < 1) requestAnimationFrame(step);
      else this.startLevel(0);
    };
    requestAnimationFrame(step);
  },

  startLevel: function (idx) {
    this.i = idx;
    const L = this.levels[idx];
    const content = BOARD_DATA[idx];

    if (this.infoBtn) this.infoBtn.style.display = "";
    this.stats = {};

    this.beach.setAttribute("visible", false);
    this.under.setAttribute("visible", true);

    // fog = always same
    this.scene.setAttribute(
      "fog",
      "type: exponential; color: #0a3d62; density: 0.045"
    );

    // sky darker
    if (this.sky) this.sky.setAttribute("color", this.skyColors[idx]);

    // lights stable
    const lights = this.under.querySelectorAll("[light]");
    for (let j = 0; j < lights.length; j++) {
      const el = lights[j];
      const conf = el.getAttribute("light") || {};
      if (conf.type === "ambient") {
        el.setAttribute("light", {
          type: "ambient",
          intensity: 0.45,
          color: "#7fd0ff",
        });
      } else if (conf.type === "directional") {
        el.setAttribute("light", {
          type: "directional",
          intensity: 0.65,
          color: "#bfe9ff",
        });
      }
    }

    $("#leftHand").setAttribute("visible", true);
    $("#rightHand").setAttribute("visible", true);
    this.turtle.setAttribute("turtle-guide", "follow:true");

    // spawn close trash
    this.spawner.innerHTML = "";
    TRASH.length = 0;
    const sp = document.createElement("a-entity");
    sp.setAttribute(
      "simple-trash-spawner",
      "count: 25; types: " + content.types.join(",")
    );
    this.spawner.appendChild(sp);

    const net = $("#net").components["net-collector"];
    if (net) {
      net.score = 0;
      net.sync();
    }

    if (this.levelTitle) this.levelTitle.textContent = L.name;
    this.timer = L.time;
    this.updateTimer();
  },

  buildBoardHTML: function () {
    const content = BOARD_DATA[this.i] || {};
    const keys = Object.keys(this.stats);
    let listHTML = "";
    if (keys.length === 0) {
      listHTML = "<li>—</li>";
    } else {
      listHTML = keys
        .map((k) => {
          const meta = TYPE_META[k] || { label: k, icon: "▪︎" };
          const n = this.stats[k] || 0;
          return `<li><span class="badge">${n}</span><span class="icon">${meta.icon}</span> ${meta.label}</li>`;
        })
        .join("");
    }
    const animalsHTML =
      (content.animals || []).map((a) => `<li>${a}</li>`).join("") ||
      "<li>—</li>";
    const lifeHTML =
      (content.lifespan || []).map((s) => `<li>${s}</li>`).join("") ||
      "<li>—</li>";

    return `
      <div class="board">
        <div class="panelbox">
          <h3>Opbrengst afval</h3>
          <div class="kv">
            <div class="icon">🧹</div><div><small>Diepte:</small><br><strong>${
              content.depthName || ""
            }</strong></div>
          </div>
          <ul>${listHTML}</ul>
          <h3>Info over afval op deze diepte</h3>
          <p>${content.wasteInfo || ""}</p>
          <h3>Levensduur (voorbeeld)</h3>
          <ul>${lifeHTML}</ul>
        </div>
        <div class="panelbox">
          <h3>Geredde dieren</h3>
          <ul>${animalsHTML}</ul>
          <h3>Info over dieren op deze diepte</h3>
          <p>${content.animalsInfo || ""}</p>
        </div>
      </div>
    `;
  },

  endLevel: function () {
    if (this._ending) return;
    this._ending = true;

    const net = $("#net").components["net-collector"];
    const caught = net ? net.score : 0;
    const names = ["Oppervlak", "Waterkolom", "Diepe zee", "Abyssale vlaktes"];
    const board = this.buildBoardHTML();

    this.infoText.innerHTML =
      `<strong>Einde level ${this.i + 1}: ${names[this.i]}</strong><br><br>` +
      `Gevangen plastic dit level: <strong>${caught}</strong><br>` +
      `Totaal gevangen: <strong>${TOTAL}</strong><br><br>` +
      board;
    this.info.classList.remove("hidden");
    this.infoBtn.style.display = "";

    this.infoBtn.onclick = () => {
      this.info.classList.add("hidden");
      this._ending = false;
      if (this.i < this.levels.length - 1) this.startLevel(this.i + 1);
      else this.finish();
    };
  },

  finish: function () {
    const boardHTML = this.buildBoardHTML();
    const total = TOTAL;

    this.infoText.innerHTML =
      `<strong>Einde level 4: Abyssale vlaktes</strong><br><br>` +
      `Totaal gevangen: <strong>${total}</strong><br><br>` +
      boardHTML +
      `<p style="text-align:center; opacity:.7; margin-top:8px;">Sluit automatisch in 30 seconden...</p>`;
    this.info.classList.remove("hidden");
    this.infoBtn.style.display = "none";

    setTimeout(() => {
      this.info.classList.add("hidden");
      this.showThankYouScene(total);
    }, 30000);
  },

  showThankYouScene: function (total) {
    const dlg = $("#dialog");
    const btn = $("#dialogBtn");
    dlg.querySelector(
      "#dialogText"
    ).innerHTML = `🐢 Thanks for cleaning!<br>You collected <strong>${total}</strong> pieces.<br>Play again?`;
    btn.textContent = "Restart";
    dlg.classList.remove("hidden");
    btn.onclick = () => location.reload();
  },

  updateTimer: function () {
    const m = Math.floor(this.timer / 60);
    const s = ("0" + Math.floor(this.timer % 60)).slice(-2);
    this.timerLabel.textContent = m + ":" + s;
  },

  tick: function (t, dt) {
    if (this.i < 0) return;
    if (TRASH.length === 0) {
      this.updateTimer();
      this.endLevel();
      return;
    }
    this.timer -= dt / 1000;
    if (this.timer <= 0) {
      this.timer = 0;
      this.updateTimer();
      this.endLevel();
    } else {
      this.updateTimer();
    }
  },
});
