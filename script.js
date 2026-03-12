const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// --- গেম কনফিগারেশন ---
const ROCKETS = [
    { id: 0, img: "./rocket/rocket_01.png", price: 0 },
    { id: 1, img: "./rocket/rocket_02.gif", price: 200 },
    { id: 2, img: "./rocket/rocket_03.png", price: 250 },
    { id: 3, img: "./rocket/rocket_04.png", price: 320 }
];

// গেম স্টেট
let score = 0, coins = parseInt(localStorage.getItem("coins")) || 0;
let lives = 3, running = false, isPaused = false, lastSpawn = 0;
let soundOn = localStorage.getItem("soundOn") !== "false";
let selectedRocketId = parseInt(localStorage.getItem("selectedRocketId")) || 0;

// কন্ট্রোল স্টেট (নতুন যোগ করা হয়েছে)
let moveLeft = false;
let moveRight = false;
const playerSpeed = 5; // রকেটের মুভমেন্ট স্পিড

// এসেটস
let player = { x: 0, y: 0, w: 50, h: 50 };
let enemies = [], items = [], stars = [];
const imgP = new Image(); 
const imgC = new Image(); imgC.src = "coin.png";
const imgL = new Image(); imgL.src = "life.png";

// রকেট ইমেজ সেটআপ
function updatePlayerImg() {
    const r = ROCKETS.find(i => i.id === selectedRocketId) || ROCKETS[0];
    imgP.src = r.img;
}
updatePlayerImg();

// সাউন্ড
const sfx = {
    click: new Audio("./sound/click.mp3"),
    crash: new Audio("./sound/crash.mp3"),
    collect: new Audio("./sound/collect.mp3"),
    bonus: new Audio("./sound/bonus.mp3")
};
function play(k) { if(soundOn && sfx[k]) { sfx[k].currentTime=0; sfx[k].play().catch(()=>{}); } }

// --- কাস্টম পপআপ লজিক ---
function showMsg(title, text) {
    document.getElementById("popupTitle").innerText = title;
    document.getElementById("popupText").innerText = text;
    document.getElementById("msgPopup").style.display = "grid";
}

function closePopup(id) { document.getElementById(id).style.display = "none"; }

function askToExit() {
    if(!running) goStart();
    else document.getElementById("confirmPopup").style.display = "grid";
}

// --- ডেইলি বোনাস ---
(function() {
    let last = localStorage.getItem("lastLogin");
    let today = new Date().toDateString();
    if(last !== today) {
        setTimeout(() => {
            coins += 100;
            localStorage.setItem("coins", coins);
            localStorage.setItem("lastLogin", today);
            updateHUD();
            showMsg("DAILY BONUS", "Welcome back! You received 100 Coins 🎁");
            play('bonus');
        }, 1000);
    }
})();

// --- গেম কোর ---
function startGame() {
    score = 0; lives = 3; enemies = []; items = [];
    running = true; isPaused = false;
    lastSpawn = Date.now();
    player.x = canvas.width/2 - 25;
    player.y = canvas.height - 200;
    showPage("gamePage");
    updateHUD();
    gameLoop();
}

function gameLoop() {
    if(!running) return;
    if(!isPaused) { update(); draw(); }
    requestAnimationFrame(gameLoop);
}

function update() {
    let now = Date.now();
    stars.forEach(s => { s.y += s.sp; if(s.y > canvas.height) s.y = -5; });

    // রকেট মুভমেন্ট লজিক (ফিক্সড)
    if (moveLeft && player.x > 0) {
        player.x -= playerSpeed;
    }
    if (moveRight && player.x < canvas.width - player.w) {
        player.x += playerSpeed;
    }

    let gap = Math.max(400, 1000 - (score / 15));
    if(now - lastSpawn > gap) {
        enemies.push({ x: Math.random()*(canvas.width-45), y: -60, w: 45, h: 45, sp: 3 + (score/500) });
        if(Math.random() < 0.15) items.push({ x: Math.random()*(canvas.width-30), y: -60, w: 30, h: 30, type: "coin" });
        if(Math.random() < 0.03) items.push({ x: Math.random()*(canvas.width-30), y: -60, w: 30, h: 30, type: "life" });
        lastSpawn = now;
    }

    enemies.forEach((en, i) => {
        en.y += en.sp;
        if(rectHit(player, en)) { enemies.splice(i,1); lives--; play('crash'); updateHUD(); if(lives <= 0) gameOver(); }
        else if(en.y > canvas.height) { enemies.splice(i,1); score += 10; updateHUD(); }
    });

    items.forEach((it, i) => {
        it.y += 4;
        if(rectHit(player, it)) {
            if(it.type === "coin") { coins++; play('collect'); }
            else { if(lives < 5) lives++; play('bonus'); }
            items.splice(i,1); updateHUD(); localStorage.setItem("coins", coins);
        } else if(it.y > canvas.height) items.splice(i,1);
    });
}

function draw() {
    ctx.clearRect(0,0,canvas.width, canvas.height);
    ctx.fillStyle = "white";
    stars.forEach(s => { ctx.beginPath(); ctx.arc(s.x, s.y, s.sz, 0, Math.PI*2); ctx.fill(); });
    ctx.drawImage(imgP, player.x, player.y, player.w, player.h);
    
    let eImg = new Image(); eImg.src = "./enemy/enemy.png";
    enemies.forEach(en => ctx.drawImage(eImg, en.x, en.y, en.w, en.h));
    items.forEach(it => ctx.drawImage(it.type === "coin" ? imgC : imgL, it.x, it.y, it.w, it.h));
}

function rectHit(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

// --- স্টোর হ্যান্ডলিং ---
function showStore() {
    showPage("storePage");
    let unlocked = JSON.parse(localStorage.getItem("unlocked")) || [0];
    let html = "";
    ROCKETS.forEach(r => {
        let isUnlocked = unlocked.includes(r.id);
        let isSelected = selectedRocketId === r.id;
        html += `
            <div class="rocket-card ${isSelected ? 'selected' : ''}" onclick="handleStoreClick(${r.id}, ${r.price})">
                <img src="${r.img}">
                <p style="margin:5px 0; font-weight:bold;">${isSelected ? 'ACTIVE' : (isUnlocked ? 'SELECT' : r.price + ' 💰')}</p>
                ${(!isUnlocked && coins < r.price) ? `<span class="lock-info">Need ${r.price - coins} more</span>` : ''}
            </div>`;
    });
    document.getElementById("rocketStore").innerHTML = html;
}

function handleStoreClick(id, price) {
    let unlocked = JSON.parse(localStorage.getItem("unlocked")) || [0];
    if(unlocked.includes(id)) {
        selectedRocketId = id;
        localStorage.setItem("selectedRocketId", id);
        updatePlayerImg();
        showStore();
        play('click');
    } else {
        if(coins >= price) {
            coins -= price;
            unlocked.push(id);
            localStorage.setItem("unlocked", JSON.stringify(unlocked));
            localStorage.setItem("coins", coins);
            selectedRocketId = id;
            localStorage.setItem("selectedRocketId", id);
            updatePlayerImg();
            updateHUD();
            showStore();
            showMsg("UNLOCKED!", "New Rocket added to your garage!");
            play('bonus');
        } else {
            showMsg("NOT ENOUGH COINS", `You need ${price - coins} more coins to buy this rocket.`);
        }
    }
}

// --- অন্যান্য ফাংশন ---
function updateHUD() {
    document.getElementById("totalCoins").innerText = coins;
    document.getElementById("currentScore").innerText = score;
    document.getElementById("livesBox").innerHTML = '❤️'.repeat(Math.max(0, lives));
}

function togglePause() { isPaused = !isPaused; document.getElementById("pauseIcon").className = isPaused ? "fas fa-play" : "fas fa-pause"; }

function exitGame() { 
    running = false; 
    closePopup('confirmPopup');
    showPage("startPage"); 
}

function gameOver() {
    running = false;
    document.getElementById("finalScore").innerText = score;
    document.getElementById("gameOverPopup").style.display = "grid";
    play('crash');
}

function saveAndExit() {
    let name = document.getElementById("playerName").value.trim() || "Pilot";
    let high = JSON.parse(localStorage.getItem("highScores") || "[]");
    high.push({name, score});
    high.sort((a,b) => b.score - a.score);
    localStorage.setItem("highScores", JSON.stringify(high.slice(0,10)));
    closePopup('gameOverPopup'); showPage("startPage"); updateHUD();
}

function showLeaderboard() {
    showPage("leaderboardPage");
    let scores = JSON.parse(localStorage.getItem("highScores") || "[]");
    let html = "<ul>" + scores.map((s, i) => `<li><span>#${i+1} ${s.name}</span> <span>${s.score}</span></li>`).join('') + "</ul>";
    document.getElementById("leaderboardList").innerHTML = html || "<p>No records yet</p>";
}

function watchAd() {
    showMsg("VIDEO AD", "Watching ad... (5s)");
    setTimeout(() => {
        coins += 20; localStorage.setItem("coins", coins);
        updateHUD(); closePopup('msgPopup');
        showMsg("REWARD", "You got 20 Coins! 💰");
    }, 5000);
}

// --- নতুন স্মুথ টাচ কন্ট্রোল (ফিক্সড) ---
const handleTouchStart = (e) => {
    if(!running || isPaused) return;
    let touchX = e.touches[0].clientX;
    // স্ক্রিনের বাম অর্ধে টাচ করলে বামে, ডান অর্ধে করলে ডানে
    if (touchX < window.innerWidth / 2) {
        moveLeft = true;
        moveRight = false;
    } else {
        moveRight = true;
        moveLeft = false;
    }
};

const handleTouchEnd = () => {
    moveLeft = false;
    moveRight = false;
};

// ইভেন্ট লিসেনারগুলো আপডেট করা হয়েছে
canvas.addEventListener('touchstart', handleTouchStart, {passive: false});
canvas.addEventListener('touchend', handleTouchEnd);

// পিসি গেমারদের জন্য কী-বোর্ড সাপোর্ট (বোনাস)
window.addEventListener('keydown', (e) => {
    if(e.key === "ArrowLeft") moveLeft = true;
    if(e.key === "ArrowRight") moveRight = true;
});
window.addEventListener('keyup', (e) => {
    if(e.key === "ArrowLeft") moveLeft = false;
    if(e.key === "ArrowRight") moveRight = false;
});

function toggleSound() { soundOn = !soundOn; localStorage.setItem("soundOn", soundOn); document.getElementById("soundToggle").innerHTML = soundOn ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-mute"></i>'; }
function showPage(id) { document.querySelectorAll(".page").forEach(p => p.classList.remove("active")); document.getElementById(id).classList.add("active"); }
function goStart() { showPage("startPage"); updateHUD(); }
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; stars = Array.from({length: 40}, () => ({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, sz: Math.random()*2, sp: Math.random()*2+1 })); }
window.addEventListener('resize', resize);
window.onload = () => { resize(); updateHUD(); };