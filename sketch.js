/* TEA SHOP — Multi-scene:
   - Welcome in... (Drawn Tea Shop)
   - Lobby (image on first visit from Welcome → auto to Tea Bar; sketched after Dessert)
   - Tea Bar (interactive)
   - Dessert Bar (interactive)
*/

let uiFont, spoonImg;
let drawnImg, lobbyImg;
let song;

let scene = "drawnShop";   // START on Welcome in...
let lastScene = null;
let textSizeVal = 48;

let currentButtons = [];
let hoveredAny = false;

/* ===== TEA BAR state & layout ===== */
const teas = [
  { key: "Lavender", rgb: [184, 152, 220] },
  { key: "Green",    rgb: [170, 210, 120] },
  { key: "Black",    rgb: [92, 58, 38]    },
  { key: "Chai",     rgb: [202, 165, 110] }
];

let shelfYPos, tableYPos, tableH;  // Tea Bar backdrop metrics
let cup, draggingCup = false, dragDx = 0, dragDy = 0;
let kettle, pouring = false;
let jars = [];
let selectedTea = null;
let hasLeaves = false;
let leavesFx = [];     // leaf particles (Tea Bar)
let steamFx = [];      // steam puffs (Tea + Dessert + Lobby)
let cupFill = 0;       // 0..1

// Tea completion -> auto-send to Dessert Bar
let teaCompleted = false;
let teaCompleteAt = 0;

/* ===== DESSERT BAR state & layout ===== */
const pastryDefs = [
  { key: "Croissant",     label: "Chocolate Croissants", color: "#c9a06e" },
  { key: "Muffin",        label: "Muffins",              color: "#8b5e3c" },
  { key: "BananaBread",   label: "Banana Bread",         color: "#a67c52" },
  { key: "CinnamonRoll",  label: "Cinnamon Rolls",       color: "#cf9f78" },
];

let dTableY, dTableH;
let caseRect, pastrySlots = [];  // 2x2 grid
let ovenRect, ovenBtn, ovenHeating = false, ovenProgress = 0;
let plateCenter, plateR;
let heldPastry = null; // {type,color,x,y,w,h,heated,inOven,onPlate,drag}

/* ===== LOBBY (image first, sketch after dessert) ===== */
let lobbyAutoActive = false;   // auto-forward to Tea Bar (when entering from Welcome)
let lobbyEnterAt = 0;

// Sketched lobby layout (after Dessert)
let shelfRows = [];            // book shelf y positions
let couchRect, tableRect;
let sitting = false;

// static books data (precomputed so they don't move)
let bookShelves = []; // Array of arrays: [{x,y,w,h,color},...]

// carry-over items for lobby placement
let lobbyCup = null;           // {x,y,r,teaKey,placed}
let lobbyDessert = null;       // {type,color,x,y,w,h,placed}
let draggingLobbyItem = null;  // "cup" | "dessert"
let zoomActive = false;        // zoom to table after placing both & sitting
let zoomStart = 0;

/* ---------- Assets ---------- */
function preload() {
  spoonImg  = loadImage("spoon.png");
  drawnImg  = loadImage("DrawnTeaShop.jpg");
  lobbyImg  = loadImage("Lobby.jpg");
  uiFont    = loadFont("Charity.otf");

  soundFormats("mp3", "wav");
  song = loadSound("chill.mp3");
}

/* ---------- Setup ---------- */
function setup() {
  const c = createCanvas(windowWidth, windowHeight);
  c.parent("sketch");

  layoutTeaBar();
  layoutDessertBar();
  layoutLobbySketch(true); // true => (re)generate static books

  // p5 helper: prevent the page from scrolling on touch-drag
function touchMoved() { return false; }

// iOS Safari: block pinch zoom & rubber-band scrolling
document.addEventListener('touchmove', (e) => {
  e.preventDefault();
}, { passive: false });

document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

// (Optional) block double-tap zoom
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
// Controls
  const btn = document.getElementById("toggle-sound");
  const vol = document.getElementById("vol");
  const volVal = document.getElementById("volVal");
  const txt = document.getElementById("text-size");
  const txtVal = document.getElementById("textSizeVal");

  if (btn) btn.addEventListener("click", () => song.isPlaying() ? song.pause() : song.loop());
  if (vol && volVal) {
    vol.addEventListener("input", () => {
      const v = parseFloat(vol.value);
      song.setVolume(v);
      volVal.textContent = v.toFixed(2);
    });
    song.setVolume(parseFloat(vol.value || "0.5"));
  }
  if (txt && txtVal) {
    txt.addEventListener("input", () => {
      textSizeVal = parseInt(txt.value || "48", 10);
      txtVal.textContent = textSizeVal;
    });
  }
}

/* ---------- Draw ---------- */
function draw() {
  clear();
  beginButtons();

  if (scene === "drawnShop")      drawWelcome();
  else if (scene === "lobby")     drawLobby();
  else if (scene === "teaBar")    drawTeaBar();
  else if (scene === "dessertBar")drawDessertBar();

  // spoon cursor
  imageMode(CENTER);
  image(spoonImg, mouseX, mouseY, 70, 70);
  imageMode(CORNER);

  cursor(hoveredAny ? HAND : ARROW);
}

/* ---------- Scene: Welcome (Drawn Tea Shop) ---------- */
function drawWelcome() {
  if (drawnImg) image(drawnImg, 0, 0, width, height);

  // Entrance (white outline) on left-center
  const w = 180, h = 52, x = 24, y = height / 2 - h / 2;
  buttonOutline(x, y, w, h, "Entrance", () => setScene("lobby"));

  // Title
  textFont(uiFont);
  textAlign(LEFT, TOP);
  stroke(0, 120); strokeWeight(3);
  fill(255);
  textSize(textSizeVal);
  text("Welcome in...", 24, 16);
}

/* ---------- Scene: Lobby (image first; sketch after Dessert) ---------- */
function drawLobby() {
  if (lobbyAutoActive) {
    // FIRST lobby scene: original image + auto-redirect
    if (lobbyImg) image(lobbyImg, 0, 0, width, height);
    titleOverlayBlack("Lobby"); // black in image lobby
    const elapsed = millis() - lobbyEnterAt;
    const remaining = max(0, 3000 - elapsed);
    toastOverlay(`Taking you to Tea Bar in ${ceil(remaining / 1000)}…`);
    if (elapsed >= 3000) {
      lobbyAutoActive = false;
      setScene("teaBar");
    }
    return;
  }

  // After Dessert: sketched interactive lobby
  if (zoomActive) {
    const t = constrain((millis() - zoomStart) / 1200, 0, 1);
    const s = lerp(1, 2.0, t);
    const cx = tableRect.x + tableRect.w / 2;
    const cy = tableRect.y + tableRect.h / 2;
    push();
    translate(width/2 - cx * s, height/2 - cy * s);
    scale(s);
    drawLobbySketchScene();
    pop();

    toastOverlay("Have a brew-tiful day! Come Again :)");

    if (t >= 1) {
      if (millis() - (zoomStart + 3600) > 800) {
        resetAll();
        setScene("drawnShop");
      }
    }
    return;
  }

  // Normal sketched lobby
  drawLobbySketchScene();
  titleOverlayBlack("Lobby"); // black in sketched lobby
  // Instruction UNDER the table at 1.5× size
  lobbyInstruction("Sit on the couch, then place your tea and dessert on the table", 1.5);

  // start zoom when both placed and sitting
  if (lobbyCup?.placed && lobbyDessert?.placed && sitting && !zoomActive) {
    zoomActive = true; zoomStart = millis();
  }
}

/* ========= Sketched Lobby helpers ========= */
function layoutLobbySketch(regenBooks = false) {
  // Bookshelves rows (3 rows)
  shelfRows = [
    height * 0.18,
    height * 0.34,
    height * 0.50
  ];

  // Couch (left-ish)
  const cw = width * 0.36, ch = height * 0.16;
  couchRect = {
    x: width * 0.10, y: height * 0.66 - ch,
    w: cw, h: ch
  };

  // Coffee table (center/front)
  const tw = width * 0.36, th = height * 0.10;
  tableRect = {
    x: width/2 - tw/2, y: height * 0.78,
    w: tw, h: th
  };

  // Build static books once or when resizing
  if (regenBooks) {
    bookShelves = [];
    // deterministic seed per layout pass so they don't change per frame
    randomSeed(12345);
    for (const y of shelfRows) {
      const books = [];
      let x = 20;
      while (x < width - 20) {
        const w = random(16, 30);
        const h = random(40, 90);
        const colors = ["#8b6b4a","#f0e5d4","#a9b9a4","#cbb8dc"]; // brown, cream, sage, lavender
        const clr = random(colors);
        books.push({ x, y, w, h, clr });
        x += w + random(8, 18);
      }
      bookShelves.push(books);
    }
  }
}

function drawLobbySketchScene() {
  // wall
  noStroke();
  for (let y = 0; y < height; y++) {
    const c = lerpColor(color("#f1ece3"), color("#eae1d4"), y / height);
    stroke(c); line(0, y, width, y);
  }
  noStroke();

  // shelves + STATIC books
  for (let i = 0; i < shelfRows.length; i++) {
    const shelfY = shelfRows[i];
    fill("#8c7a63"); rect(0, shelfY, width, 10);
    const books = bookShelves[i] || [];
    for (const b of books) {
      fill(b.clr);
      rect(b.x, shelfY - b.h, b.w, b.h);
      stroke(0, 20); line(b.x + 3, shelfY - b.h + 4, b.x + 3, shelfY - 6);
      noStroke();
    }
  }

  // couch
  drawCouch();

  // coffee table
  drawCoffeeTable();

  // draw lobby items (cup/dessert) if available
  if (lobbyCup) drawLobbyCup();

  // Plate for dessert in last lobby scene (under dessert)
  if (lobbyDessert) drawLobbyDessertPlate(lobbyDessert);
  if (lobbyDessert) drawPastry(lobbyDessert, true);

  // steam if hot tea is placed
  if (lobbyCup?.placed && selectedTea && cupFill > 0.95 && frameCount % 8 === 0) {
    spawnSteam(lobbyCup.x + random(-6,6), lobbyCup.y - lobbyCup.r);
  }
  updateSteamFx();
}

function drawCouch() {
  // base
  noStroke();
  fill(255); // white couch
  rect(couchRect.x, couchRect.y, couchRect.w, couchRect.h, 18);
  // cushions
  fill(255); rect(couchRect.x + 12, couchRect.y + 10, couchRect.w/2 - 18, couchRect.h - 20, 12);
  rect(couchRect.x + couchRect.w/2 + 6, couchRect.y + 10, couchRect.w/2 - 18, couchRect.h - 20, 12);
  // legs
  fill(180); rect(couchRect.x + 16, couchRect.y + couchRect.h, 10, 12, 4);
  rect(couchRect.x + couchRect.w - 26, couchRect.y + couchRect.h, 10, 12, 4);

  // sit indicator
  const hover = pointInRect(mouseX, mouseY, couchRect);
  if (hover || sitting) {
    noFill(); stroke(sitting ? "#2ecc71" : "#444"); strokeWeight(3);
    rect(couchRect.x - 4, couchRect.y - 4, couchRect.w + 8, couchRect.h + 8, 22);
  }
}

function drawCoffeeTable() {
  // tabletop and legs
  fill("#a76c3c"); rect(tableRect.x, tableRect.y, tableRect.w, tableRect.h, 10);
  fill("#8b5e3c");
  rect(tableRect.x + 18, tableRect.y + tableRect.h, 10, 22, 4);
  rect(tableRect.x + tableRect.w - 28, tableRect.y + tableRect.h, 10, 22, 4);

  // subtle highlight
  fill(255, 40); rect(tableRect.x, tableRect.y, tableRect.w, 6, 6);
}

function drawLobbyCup() {
  const c = lobbyCup;
  // saucer
  noStroke(); fill(230, 220);
  ellipse(c.x, c.y + c.r * 0.55, c.r * 2.0, c.r * 0.45);
  // cup
  fill(250); stroke(60, 80); strokeWeight(2);
  rect(c.x - c.r * 0.8, c.y - c.r * 0.6, c.r * 1.6, c.r * 0.9, 12);
  noFill(); stroke(60, 80); strokeWeight(5);
  arc(c.x + c.r * 0.9, c.y - c.r * 0.15, c.r * 0.8, c.r * 0.6, -PI/2, PI/2);
  // tea fill
  if (selectedTea) {
    const tea = color(...teas.find(t => t.key === selectedTea).rgb);
    tea.setAlpha(220);
    noStroke(); fill(tea);
    const h = c.r * 0.75; const y = c.y + c.r * 0.25 - h;
    rect(c.x - c.r * 0.7, y, c.r * 1.4, h, 10);
  }
}

function drawLobbyDessertPlate(p) {
  // simple plate under dessert (follows dessert position)
  const w = p.w ? p.w * 1.6 : 140;
  const h = (p.w ? p.w : 90) * 0.5;
  noStroke(); fill(240);
  ellipse(p.x, p.y + 14, w, h);
  fill(255); ellipse(p.x, p.y + 10, w * 0.95, h * 0.9);
  noFill(); stroke(0, 40); strokeWeight(2);
  ellipse(p.x, p.y + 10, w * 0.75, h * 0.55);
}

function lobbyInstruction(t, scale=1.5) {
  textFont(uiFont); textAlign(CENTER, TOP);
  noStroke(); fill(0);
  textSize(18 * scale);
  const y = tableRect.y + tableRect.h + 24;
  text(t, width/2, y);
}

/* ---------- Scene: Tea Bar ---------- */
function layoutTeaBar() {
  shelfYPos = height * 0.34;
  tableYPos = height * 0.76;
  tableH    = height * 0.16;

  // Jars on a shelf (fixed size jars)
  const jarW = 110, jarH = 140;
  const xs = [0.20, 0.38, 0.56, 0.74].map(f => width * f);
  jars = teas.map((t, i) => ({
    key: t.key,
    rgb: t.rgb,
    x: xs[i] - jarW / 2,
    y: shelfYPos - 70,
    w: jarW,
    h: jarH
  }));

  // Cup on the tabletop, centered
  cup = {
    x: width * 0.50,
    y: tableYPos - 10,
    r: min(width, height) * 0.07
  };

  // Kettle: as tall as jars; keep same gap as jars from the last jar
  const kH = jars[0].h;
  const kW = jars[0].w * 0.5;
  const last = jars[jars.length - 1];
  const jarSpacing = (jars[1].x - jars[0].x); // spacing between left edges
  let kx = last.x + jarSpacing + 20;               // same gap as jars
  // keep within canvas
  if (kx + kW > width - 15) kx = width - 15 - kW;
  kettle = {
    w: kW,
    h: kH,
    x: kx,
    y: last.y + last.h - kH - 6  // bottom aligned to shelf plank
  };
}

function drawTeaBar() {
  drawTeaBarBackdrop();

  // Title above jars (black)
  titleOverlayTeaBarAboveJars("Tea Bar");

  // Instructions (original size)
  instructionBar("Drag the cup under kettle • Click a jar • Hold kettle to pour water • ", 1.5);

  // Jars & kettle
  for (const j of jars) drawJar(j);
  drawKettle();

  // Cup on the table
  drawCup();

  // Particles
  updateLeavesFx();
  updateSteamFx();

  // Reset
  button(20, height - 60, 140, 42, "Reset Cup", resetCup);

  // Completion -> Dessert
  if (!teaCompleted && selectedTea && cupFill >= 0.98) {
    teaCompleted = true;
    teaCompleteAt = millis();
  }
  if (teaCompleted) {
    toastOverlay("Tea ready! Heading to Dessert Bar…");
    if (millis() - teaCompleteAt > 1200) setScene("dessertBar");
  }
}

function drawTeaBarBackdrop() {
  // wall gradient
  noStroke();
  for (let y = 0; y < height; y++) {
    const c = lerpColor(color("#f5f0e6"), color("#efe8da"), y / height);
    stroke(c); line(0, y, width, y);
  }
  noStroke();
  // subtle specks
  for (let i = 0; i < 180; i++) {
    fill(255, 18);
    const x = noise(i * 7.1, frameCount * 0.002) * width;
    const y = noise(i * 3.3, frameCount * 0.003) * height;
    circle(x, y, random(0.6, 1.4));
  }

  // shelf under jars
  const plankY = (jars && jars.length) ? (jars[0].y + jars[0].h - 6) : shelfYPos + 70;
  fill("#5f6a55"); rect(0, plankY, width, 16);
  fill(0, 35);
  rect(width * 0.08, plankY - 46, 10, 46);
  rect(width * 0.92 - 10, plankY - 46, 10, 46);

  // tabletop
  fill("#a76c3c"); rect(0, tableYPos, width, tableH, 8);
  fill(255, 35); rect(0, tableYPos, width, 6, 6);
  noFill(); stroke(0, 20);
  for (let i = 0; i < 8; i++) {
    const y = tableYPos + 18 + i * (tableH - 26) / 8;
    bezier(10, y, width * 0.25, y + sin(i * 0.6) * 6, width * 0.55, y + cos(i * 0.5) * 8, width - 10, y + sin(i * 0.3) * 6);
  }
}

function drawJar(j) {
  const hover = overRect(j);
  noStroke();
  fill(255, hover ? 190 : 160);
  rect(j.x, j.y, j.w, j.h, 10);
  // tea color
  const c = color(...j.rgb);
  c.setAlpha(190);
  fill(c);
  rect(j.x + 10, j.y + 40, j.w - 20, j.h - 70, 8);
  // lid
  fill(60, 50, 40, 200);
  rect(j.x + 8, j.y + 4, j.w - 16, 22, 6);
  // label
  fill(30, 150);
  rect(j.x + 22, j.y + 70, j.w - 44, 34, 6);
  fill(255);
  textFont(uiFont); textSize(18); textAlign(CENTER, CENTER);
  text(j.key, j.x + j.w / 2, j.y + 87);

  if (selectedTea === j.key) {
    noFill(); stroke(255); strokeWeight(3);
    rect(j.x - 4, j.y - 4, j.w + 8, j.h + 8, 12);
  }
}

function drawKettle() {
  const k = kettle;
  const spoutX = k.x + k.w * 0.48;
  const spoutY = k.y + k.h * 0.20;

  // WHITE kettle with BLACK outline
  stroke(0); strokeWeight(2); fill(255);
  rect(k.x, k.y, k.w, k.h, 14);           // body

  fill(240); rect(k.x + k.w * 0.2, k.y - 10, k.w * 0.6, 16, 6); // lid (outlined from stroke above)


  // water stream
  if (pouring && cupUnderSpout()) {
    noStroke(); fill(180, 210);
    const dx = cup.x - spoutX, dy = (cup.y - cup.r * 0.45) - (spoutY + 8);
    for (let t = 0; t <= 1; t += 0.08) {
      const px = spoutX + dx * t + random(-0.6, 0.6);
      const py = spoutY + 8 + dy * t + t * 12;
      circle(px, py, 6);
    }
    cupFill = constrain(cupFill + 0.006, 0, 1);
    if (frameCount % 4 === 0) spawnSteam(cup.x + random(-8, 8), cup.y - cup.r * 0.55);
  }
}

function cupUnderSpout() {
  const spoutX = kettle.x + kettle.w * 0.48;
  const spoutY = kettle.y + kettle.h * 0.20;
  const closeX = abs(cup.x - spoutX) < kettle.w * 0.45;
  const below  = cup.y - cup.r * 0.55 > spoutY + 10;
  return closeX && below;
}

function drawCup() {
  // saucer
  noStroke(); fill(230, 220);
  ellipse(cup.x, cup.y + cup.r * 0.55, cup.r * 2.0, cup.r * 0.45);
  // cup body
  fill(250); stroke(60, 80); strokeWeight(2);
  rect(cup.x - cup.r * 0.8, cup.y - cup.r * 0.6, cup.r * 1.6, cup.r * 0.9, 16);
  // handle
  noFill(); stroke(60, 80); strokeWeight(6);
  arc(cup.x + cup.r * 0.9, cup.y - cup.r * 0.15, cup.r * 0.8, cup.r * 0.6, -PI/2, PI/2);
  // tea
  if (cupFill > 0 && selectedTea) {
    const tea = color(...teas.find(t => t.key === selectedTea).rgb);
    tea.setAlpha(220);
    noStroke(); fill(tea);
    const h = cup.r * 0.75 * cupFill;
    const y = cup.y + cup.r * 0.25 - h;
    rect(cup.x - cup.r * 0.7, y, cup.r * 1.4, h, 10);
  }
  // dry leaves if chosen but not poured
  if (hasLeaves && cupFill === 0) {
    for (let i = 0; i < 3; i++) {
      const theta = random(TWO_PI), rr = random(2, 4);
      fill(40, 160); noStroke();
      ellipse(cup.x + cos(theta) * rr * 6, cup.y - rr * 2, rr, rr * 1.6);
    }
  }
}

/* ---------- Scene: Dessert Bar ---------- */
function layoutDessertBar() {
  dTableY = height * 0.76;
  dTableH = height * 0.16;

  // Display case resting on tabletop (left)
  const caseW = width * 0.46;
  const caseH = height * 0.30;
  caseRect = {
    x: width * 0.10,
    w: caseW,
    h: caseH,
    y: dTableY - caseH // rests on table
  };

  // 2 rows x 2 columns pastry grid inside the case
  pastrySlots = [];
  const rows = 2, cols = 2;
  const padX = 24, padY = 24;
  const innerX = caseRect.x + padX;
  const innerY = caseRect.y + padY;
  const innerW = caseRect.w - padX * 2;
  const innerH = caseRect.h - padY * 2;

  const cellW = innerW / cols;
  const cellH = innerH / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const def = pastryDefs[idx];
      const x = innerX + c * cellW;
      const y = innerY + r * cellH;
      pastrySlots.push({
        key: def.key, label: def.label, color: def.color,
        x: x + 10, y: y + 10, w: cellW - 20, h: cellH - 20
      });
    }
  }

  // Toaster oven resting on tabletop (right)
  const oW = width * 0.26;
  const oH = height * 0.18;
  ovenRect = {
    x: width * 0.68,
    y: dTableY - oH,  // rests on table
    w: oW, h: oH
  };
  ovenBtn = { x: ovenRect.x + ovenRect.w - 28, y: ovenRect.y + 14, r: 10 };

  // Plate (on table, centered)
  plateCenter = { x: width * 0.42, y: dTableY + dTableH * 0.45 };
  plateR = min(width, height) * 0.065;

  // reset pastry
  heldPastry = null;
  ovenHeating = false;
  ovenProgress = 0;
}

function drawDessertBar() {
  drawDessertBackdrop();

  // Title — HIGHER
  titleOverlayDessert("Dessert Bar"); // y raised in function

  // Instructions (original size)
  instructionBar("Click a dessert • Drag into oven • Press button to heat • Place on plate", 1.4);

  // Case & pastries
  drawPastryCase();

  // Oven + Plate
  drawOven();
  drawPlate();

  // Held pastry on top
  if (heldPastry) drawPastry(heldPastry, true);

  // Steam FX
  updateSteamFx();

  // Reset
  button(20, height - 60, 160, 42, "Reset Dessert", resetDessert);

  // completion -> auto to lobby (interactive sketched mode)
  if (heldPastry?.onPlate) {
    toastOverlay("Dessert ready! Heading to Lobby…");
    // prepare lobby carry-over items once
    if (!lobbyCup) {
      lobbyCup = { x: width * 0.72, y: dTableY + dTableH * 0.45, r: min(width, height) * 0.05, teaKey: selectedTea, placed: false };
    }
    if (!lobbyDessert) {
      lobbyDessert = {
        type: heldPastry.type, color: heldPastry.color,
        x: width * 0.18, y: dTableY + dTableH * 0.45,
        w: 90, h: 54, heated: true, placed: false
      };
    }
    // small delay then go to lobby
    if (!toastUntil) toastUntil = millis() + 1000;
    if (millis() > toastUntil) {
      toastUntil = 0;
      setScene("lobby");
    }
  }
}

function drawDessertBackdrop() {
  // wall
  noStroke();
  for (let y = 0; y < height; y++) {
    const c = lerpColor(color("#f3efe6"), color("#ebe3d5"), y / height);
    stroke(c); line(0, y, width, y);
  }
  noStroke();
  for (let i = 0; i < 160; i++) {
    fill(255, 15);
    const x = noise(i * 5.9, frameCount * 0.002) * width;
    const y = noise(i * 4.1, frameCount * 0.003) * height;
    circle(x, y, random(0.6, 1.2));
  }

  // tabletop
  fill("#a76c3c"); rect(0, dTableY, width, dTableH, 8);
  fill(255, 35); rect(0, dTableY, width, 6, 6);
  noFill(); stroke(0, 20);
  for (let i = 0; i < 7; i++) {
    const y = dTableY + 18 + i * (dTableH - 26) / 7;
    bezier(10, y, width * 0.25, y + sin(i * 0.6) * 5, width * 0.55, y + cos(i * 0.5) * 7, width - 10, y + sin(i * 0.3) * 5);
  }
}

function drawPastryCase() {
  // glass box sits on table
  noStroke(); fill(255, 120);
  rect(caseRect.x, caseRect.y, caseRect.w, caseRect.h, 12);
  noFill(); stroke(90, 70); strokeWeight(3);
  rect(caseRect.x, caseRect.y, caseRect.w, caseRect.h, 12);

  // middle divider between the 2 rows
  stroke(120, 120); strokeWeight(3);
  const midY = caseRect.y + caseRect.h / 2;
  line(caseRect.x + 10, midY, caseRect.x + caseRect.w - 10, midY);

  // pastry slots (2x2)
  for (const slot of pastrySlots) drawPastrySlot(slot);
}

function drawPastrySlot(slot) {
  const hover = pointInRect(mouseX, mouseY, slot);
  // label plaque at bottom of slot
  noStroke(); fill(0, hover ? 90 : 60);
  rect(slot.x, slot.y + slot.h - 22, slot.w, 20, 6);
  fill(255); textFont(uiFont); textSize(16); textAlign(CENTER, CENTER);
  text(slot.label, slot.x + slot.w / 2, slot.y + slot.h - 12);

  // pastry illustration centered
  const p = { type: slot.key, color: slot.color, x: slot.x + slot.w/2, y: slot.y + slot.h/2 - 16, w: 90, h: 54 };
  drawPastry(p, false, hover);
}

function drawOven() {
  const o = ovenRect;

  // body
  noStroke(); fill(40, 40, 45, 240);
  rect(o.x, o.y, o.w, o.h, 10);

  // glass window
  fill(180, 200); rect(o.x + 10, o.y + 32, o.w - 20, o.h - 50, 8);

  // rack lines
  stroke(90, 160); strokeWeight(2);
  for (let i = 0; i < 3; i++) {
    const y = o.y + 42 + i * ((o.h - 72) / 2);
    line(o.x + 18, y, o.x + o.w - 18, y);
  }

  // power button (ORANGE while heating)
  noStroke(); fill(ovenHeating ? "#f39c12" : "#2ecc71");
  circle(ovenBtn.x, ovenBtn.y, ovenBtn.r * 2);

  // progress bar
  noStroke(); fill(255, 180);
  rect(o.x + 14, o.y + 10, o.w - 50, 10, 4);
  fill(ovenHeating ? "#f39c12" : "#888");
  const progW = (o.w - 50) * constrain(ovenProgress, 0, 1);
  rect(o.x + 14, o.y + 10, progW, 10, 4);

  // show pastry inside if dropped in
  if (heldPastry?.inOven) {
    const px = o.x + o.w / 2;
    const py = o.y + o.h / 2 + 8;
    heldPastry.x = px; heldPastry.y = py;
    drawPastry(heldPastry, true);
    if (ovenHeating) {
      ovenProgress = constrain(ovenProgress + 0.01, 0, 1);
      if (frameCount % 6 === 0) spawnSteam(px + random(-8, 8), py - 20);
      if (ovenProgress >= 1) {
        heldPastry.heated = true; ovenHeating = false;
        toast("Heated! Move it to the plate.", 1300);
      }
    }
  }
}

function drawPlate() {
  // plate base
  noStroke(); fill(240);
  ellipse(plateCenter.x, plateCenter.y + 8, plateR * 2.1, plateR * 0.5);
  fill(255); ellipse(plateCenter.x, plateCenter.y, plateR * 2, plateR * 0.6);
  noFill(); stroke(0, 40); strokeWeight(2);
  ellipse(plateCenter.x, plateCenter.y, plateR * 1.6, plateR * 0.5);

  // if pastry on plate, draw on top
  if (heldPastry?.onPlate) {
    heldPastry.x = plateCenter.x;
    heldPastry.y = plateCenter.y - 6;
    drawPastry(heldPastry, true);
  }
}

/* ---------- Pastry drawing (full croissant) ---------- */
function drawPastry(p, filled, hover = false) {
  push();
  translate(p.x, p.y);

  if (p.type === "Croissant") {
    noStroke();
    const outer = color(p.color || "#caa07a"); outer.setAlpha(255);
    const innerClr = color("#f3d9b1");
    fill(outer);
    arc(0, 0, p.w * 1.2, p.h, PI * 0.15, PI * 0.85, OPEN);
    fill(innerClr);
    arc(0, 0, p.w * 0.8, p.h * 0.6, PI * 0.2, PI * 0.8, OPEN);
    // chocolate stripes
    stroke("#5a3a27"); strokeWeight(3);
    for (let a = -0.4; a <= 0.4; a += 0.2) {
      const xx = a * p.w * 0.45;
      line(xx, -p.h * 0.18, xx, p.h * 0.18);
    }
    noStroke();
  } else if (p.type === "Muffin") {
    noStroke();
    const col = color(p.color || "#8b5e3c");
    fill(col); ellipse(0, -p.h * 0.1, p.w * 0.9, p.h * 0.8);
    fill(col); rect(-p.w * 0.3, -p.h * 0.05, p.w * 0.6, p.h * 0.6, 6);
  } else if (p.type === "BananaBread") {
    noStroke();
    fill(p.color || "#a67c52");
    rect(-p.w * 0.45, -p.h * 0.35, p.w * 0.9, p.h * 0.7, 6);
    fill(255, 150); rect(-p.w * 0.45, -p.h * 0.1, p.w * 0.9, p.h * 0.08, 4);
  } else if (p.type === "CinnamonRoll") {
    noStroke(); fill(p.color || "#cf9f78");
    ellipse(0, 0, p.w * 0.95, p.h * 0.85);
    noFill(); stroke(110, 70); strokeWeight(3);
    for (let a = 0; a < 1; a += 0.2)
      arc(0, 0, p.w * (0.95 - a), p.h * (0.85 - a * 0.9), 0, TWO_PI * (0.75 - a * 0.3));
    noStroke(); fill(255, 180);
    ellipse(0, 0, p.w * 0.7, p.h * 0.4);
  } else {
    noStroke(); fill(p.color || "#caa07a");
    rect(-p.w * 0.4, -p.h * 0.3, p.w * 0.8, p.h * 0.6, 6);
  }

  if (hover) {
    noFill(); stroke(255); strokeWeight(2);
    rect(-p.w * 0.6, -p.h * 0.6, p.w * 1.2, p.h * 1.2, 8);
  }

  if (p.heated) {
    noStroke(); fill(255, 220, 120, 60);
    ellipse(0, 0, p.w * 1.3, p.h * 1.2);
  }
  pop();
}

/* ---------- Interaction ---------- */
function mousePressed() {
  // buttons first
  for (const b of currentButtons) {
    if (overRect(b)) { b.onClick?.(); return; }
  }

  let handled = false;

  if (scene === "teaBar") {
    // drag cup?
    const overCup = dist(mouseX, mouseY, cup.x, cup.y) < cup.r * 0.9;
    if (overCup) {
      draggingCup = true; dragDx = mouseX - cup.x; dragDy = mouseY - cup.y;
      handled = true;
    }
    // pick tea?
    for (const j of jars) if (overRect(j)) { selectedTea = j.key; hasLeaves = true; spawnLeaves(j.x + j.w/2, j.y + j.h*0.6, j.rgb); handled = true; }
    // kettle?
    if (overRect(kettle)) { pouring = true; handled = true; }
  }

  if (scene === "dessertBar") {
    // oven button
    if (pointInCircle(mouseX, mouseY, ovenBtn.x, ovenBtn.y, ovenBtn.r)) {
      if (heldPastry?.inOven) {
        ovenHeating = !ovenHeating;
        if (ovenHeating && ovenProgress >= 1) ovenProgress = 0;
      } else {
        toast("Put a dessert inside first.", 1200);
      }
      handled = true;
    }

    // pick from case
    if (!handled && (!heldPastry || (!heldPastry.drag && !heldPastry.inOven && !heldPastry.onPlate))) {
      for (const slot of pastrySlots) {
        if (pointInRect(mouseX, mouseY, slot)) {
          heldPastry = {
            type: slot.key, color: slot.color,
            x: mouseX, y: mouseY, w: 90, h: 54,
            heated: false, inOven: false, onPlate: false, drag: true
          };
          handled = true; break;
        }
      }
    }

    // pick existing pastry
    if (!handled && heldPastry) {
      if (dist(mouseX, mouseY, heldPastry.x, heldPastry.y) < 60) {
        heldPastry.drag = true; heldPastry.inOven = false; heldPastry.onPlate = false;
        handled = true;
      }
    }
  }

  if (scene === "lobby" && !lobbyAutoActive && !zoomActive) {
    // sit on couch
    if (pointInRect(mouseX, mouseY, couchRect)) {
      sitting = !sitting;
      handled = true;
    }

    // pick up lobby cup/dessert
    if (!handled && lobbyCup) {
      if (dist(mouseX, mouseY, lobbyCup.x, lobbyCup.y) < lobbyCup.r * 1.1) {
        draggingLobbyItem = "cup";
        handled = true;
      }
    }
    if (!handled && lobbyDessert) {
      if (dist(mouseX, mouseY, lobbyDessert.x, lobbyDessert.y) < 60) {
        draggingLobbyItem = "dessert";
        handled = true;
      }
    }
  }

  // toggle music if nothing else
  if (!handled) song.isPlaying() ? song.pause() : song.loop();
}

function mouseDragged() {
  if (scene === "teaBar" && draggingCup) {
    cup.x = constrain(mouseX - dragDx, cup.r * 0.8 + 6, width - cup.r * 0.8 - 6);
    cup.y = constrain(mouseY - dragDy, cup.r * 0.6 + 6, height - cup.r * 0.2 - 6);
  }
  if (scene === "dessertBar" && heldPastry?.drag) {
    heldPastry.x = mouseX; heldPastry.y = mouseY;
  }
  if (scene === "lobby" && draggingLobbyItem && !zoomActive) {
    if (draggingLobbyItem === "cup" && lobbyCup) { lobbyCup.x = mouseX; lobbyCup.y = mouseY; }
    if (draggingLobbyItem === "dessert" && lobbyDessert) { lobbyDessert.x = mouseX; lobbyDessert.y = mouseY; }
  }
}

function mouseReleased() {
  draggingCup = false; pouring = false;

  if (scene === "dessertBar" && heldPastry?.drag) {
    heldPastry.drag = false;

    // into oven?
    if (pointInRect(mouseX, mouseY, ovenRect)) { heldPastry.inOven = true; return; }

    // onto plate (must be heated)
    const onPlate = dist(mouseX, mouseY, plateCenter.x, plateCenter.y) < plateR;
    if (onPlate) {
      if (heldPastry.heated) {
        heldPastry.onPlate = true; heldPastry.inOven = false;
      } else {
        toast("Heat it first!", 1200);
      }
    }
  }

  if (scene === "lobby" && draggingLobbyItem) {
    // drop on table?
    if (pointInRect(mouseX, mouseY, tableRect)) {
      if (draggingLobbyItem === "cup" && lobbyCup) lobbyCup.placed = true;
      if (draggingLobbyItem === "dessert" && lobbyDessert) lobbyDessert.placed = true;
    }
    draggingLobbyItem = null;
  }
}

function resetCup() {
  cupFill = 0; hasLeaves = false; selectedTea = null;
  leavesFx = []; steamFx = []; teaCompleted = false; teaCompleteAt = 0;
}

function resetDessert() {
  heldPastry = null; ovenHeating = false; ovenProgress = 0; toastMsg = ""; toastUntil = 0;
}

function resetAll() {
  // Reset everything for a fresh loop
  resetCup();
  resetDessert();
  lobbyAutoActive = false; sitting = false; zoomActive = false; zoomStart = 0;
  lobbyCup = null; lobbyDessert = null;
}

/* ---------- Particles (shared) ---------- */
function spawnLeaves(fromX, fromY, rgb) {
  for (let i = 0; i < 20; i++) {
    leavesFx.push({
      x: fromX + random(-10, 10),
      y: fromY + random(-10, 10),
      vx: random(-1, 1),
      vy: random(-0.5, -1.2),
      rgb: rgb.slice ? rgb.slice() : rgb,
      life: 90
    });
  }
}
function updateLeavesFx() {
  for (let i = leavesFx.length - 1; i >= 0; i--) {
    const p = leavesFx[i];
    const toCupX = cup.x - p.x, toCupY = (cup.y - cup.r * 0.2) - p.y;
    p.vx += toCupX * 0.0007; p.vy += toCupY * 0.0007;
    p.x += p.vx; p.y += p.vy; p.life--;
    const c = color(...(Array.isArray(p.rgb) ? p.rgb : [180, 150, 100])); c.setAlpha(map(p.life, 0, 90, 0, 220));
    noStroke(); fill(c);
    ellipse(p.x, p.y, 4, 6);
    if (p.life <= 0) leavesFx.splice(i, 1);
  }
}
function spawnSteam(x, y) { steamFx.push({ x, y, r: random(10, 18), vy: random(0.6, 1.2), a: 180 }); }
function updateSteamFx() {
  for (let i = steamFx.length - 1; i >= 0; i--) {
    const s = steamFx[i];
    s.y -= s.vy; s.r += 0.12; s.a -= 2.2;
    noStroke(); fill(255, s.a);
    circle(s.x + random(-0.3, 0.3), s.y, s.r);
    if (s.a <= 0) steamFx.splice(i, 1);
  }
}

/* ---------- UI helpers ---------- */
function titleOverlay(t) {
  textFont(uiFont); textAlign(CENTER, TOP);
  fill(255); stroke(0, 120); strokeWeight(3);
  textSize(textSizeVal);
  text(t, width / 2, 14);
}

function titleOverlayBlack(t) {
  textFont(uiFont); textAlign(CENTER, TOP);
  noStroke(); fill(0);
  textSize(textSizeVal);
  text(t, width / 2, 14);
}

function titleOverlayTeaBarAboveJars(t) {
  const jarTop = (jars && jars.length) ? jars[0].y : shelfYPos - 70;
  const y = max(10, jarTop - 60);
  textFont(uiFont); textAlign(CENTER, TOP);
  noStroke(); fill(0);
  textSize(textSizeVal);
  text(t, width / 2, y);
}

function titleOverlayDessert(t) {
  // raise higher than before (more negative offset)
  const y = max(10, caseRect.y - 120);
  textFont(uiFont); textAlign(CENTER, TOP);
  noStroke(); fill(0);
textSize(textSizeVal * 1.5);
  text(t, width / 2, y);
}

function instructionBar(t, scaleFactor = 1) {
  const H = 40 * scaleFactor * 1.2;
  fill(0, 120); noStroke();
  rect(0, 0, width, H);
  fill(255); textFont(uiFont); textSize(18 * scaleFactor); // original size at scaleFactor=1
  textAlign(CENTER, CENTER);
  text(t, width / 2, H / 2 + 2);
}

function toast(msg, ms) { toastMsg = msg; toastUntil = millis() + (ms || 1000); }
function toastOverlay(t) {
  const bottomY = (scene === "teaBar") ? tableYPos : (scene === "dessertBar") ? dTableY : height * 0.82;
  const w = min(520, width * 0.84);
  const h = 56;
  const x = width / 2 - w / 2;
  const y = bottomY - h - 12;
  noStroke();
  fill(0, 170);
  rect(x, y, w, h, 10);
  fill(255);
  textFont(uiFont);
  textSize(30);
  textAlign(CENTER, CENTER);
  text(t, x + w / 2, y + h / 2 + 2);
}

/* Buttons */
function beginButtons() { currentButtons = []; hoveredAny = false; }
function button(x, y, w, h, label, onClick) {
  const box = { x, y, w, h, onClick };
  const isHover = overRect(box);
  hoveredAny = hoveredAny || isHover;

  noStroke(); fill(0, isHover ? 150 : 110);
  rect(x, y, w, h, 10);
  fill(255); textFont(uiFont); textAlign(CENTER, CENTER); textSize(20);
  text(label, x + w / 2, y + h / 2 + 1);

  currentButtons.push(box);
}
function buttonOutline(x, y, w, h, label, onClick) {
  const box = { x, y, w, h, onClick, outline: true };
  const isHover = overRect(box);
  hoveredAny = hoveredAny || isHover;

  noFill(); stroke(255); strokeWeight(isHover ? 3 : 2);
  rect(x, y, w, h, 10);
  noStroke(); fill(255); textFont(uiFont); textAlign(CENTER, CENTER); textSize(20);
  text(label, x + w / 2, y + h / 2 + 1);

  currentButtons.push(box);
}

function overRect(r) { return pointInRect(mouseX, mouseY, r); }
function pointInRect(px, py, r) { return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; }
function pointInCircle(px, py, cx, cy, cr) { return dist(px, py, cx, cy) <= cr; }

/* ---------- Scene switching ---------- */
function setScene(s) {
  lastScene = scene;
  scene = s;

  if (s === "lobby") {
    // Auto-forward only if coming from Welcome
    lobbyAutoActive = (lastScene === "drawnShop");
    lobbyEnterAt = millis();
    // layout lobby freshly (recompute static books on resize only)
    layoutLobbySketch(false);
    // arriving from Dessert? prepare objects if missing
    if (lastScene === "dessertBar") {
      if (!lobbyCup) lobbyCup = { x: width * 0.72, y: dTableY + dTableH * 0.45, r: min(width, height) * 0.05, teaKey: selectedTea, placed: false };
      if (!lobbyDessert && heldPastry) lobbyDessert = { type: heldPastry.type, color: heldPastry.color, x: width * 0.18, y: dTableY + dTableH * 0.45, w: 90, h: 54, heated: true, placed: false };
    }
  }

  if (s === "teaBar") layoutTeaBar();
  if (s === "dessertBar") layoutDessertBar();
}

/* ---------- Resize ---------- */
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  layoutTeaBar();
  layoutDessertBar();
  layoutLobbySketch(true); // regenerate books when resizing to keep layout neat
}
