const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// --- গেম কনফিগারেশন ---
const ROCKETS = [
    { id: 0, img: "./rocket/rocket_01.png", price: 0 },
    { id: 1, img: "./rocket/rocket_02.gif", price: 200 },
    { id: 2, img: "./rocket/rocket_03.png", price: 500 },
    { id: 3, img: "./rocket/rocket_04.png", price: 1000 }
];

/**
 * এনিমি লিস্ট: আপনি এখানে ইচ্ছা মতো আরও ইমেজ অ্যাড করতে পারেন।
 * লজিক: ৫০০ পয়েন্ট পরপর একটি করে ইমেজ পরিবর্তন হবে।
 * অ্যারের শেষ ইমেজটি (এক্ষেত্রে boss.gif) ১৫০০ পয়েন্টের পর আজীবন থাকবে।
 */
const ENEMY_IMAGES = [
    "./enemy/enemy.png", // 0 - 500
    "./enemy/enemy_02.png", // 501 - 1000
    "./enemy/enemy_03.png", // 1001 - 1500
    
];

// গেম স্টেট
let score = 0, coins = parseInt(localStorage.getItem("coins")) || 0;
let lives = 3, running = false, isPaused = false, lastSpawn = 0;
let soundOn = localStorage.getItem("soundOn") !== "false";
let selectedRocketId = parseInt(localStorage.getItem("selectedRocketId")) || 0;

// কন্ট্রোল (স্মুথ মুভমেন্টের জন্য)
let moveLeft = false, moveRight = false;
const playerSpeed = 5; 

// এসেটস লোডিং
let player = { x: 0, y: 0, w: 45, h: 65 }; // স্ট্রেচ ফিক্স করার জন্য সাইজ অ্যাডজাস্টেড
let enemies = [], items = [], stars = [];
const imgP = new Image(); 
const imgC = new Image(); imgC.src = "coin.png";
const imgL = new Image(); imgL.src = "life.png";

function updatePlayerImg() {
    const r = ROCKETS.find(i => i.id === selectedRocketId) || ROCKETS[0];
    imgP.src = r.img;
}
updatePlayerImg();

// সাউন্ড ইফেক্টস
const sfx = {
    click: new Audio("./sound/click.mp3"),
    crash: new Audio("./sound/crash.mp3"),
    collect: new Audio("./sound/collect.mp3"),
    bonus: new Audio("./sound/bonus.mp3")
};
function play(k) { if(soundOn && sfx[k]) { sfx[k].currentTime=0; sfx[k].play().catch(()=>{}); } }

// --- পপআপ ও HUD ফাংশন ---
function showMsg(title, text) {
    document.getElementById("popupTitle").innerText = title;
    document.getElementById("popupText").innerText = text;
    document.getElementById("msgPopup").style.display = "grid";
}
function closePopup(id) { document.getElementById(id).style.display = "none"; }
function updateHUD() {
    document.getElementById("totalCoins").innerText = coins;
    document.getElementById("currentScore").innerText = score;
    document.getElementById("livesBox").innerHTML = '❤️'.repeat(Math.max(0, lives));
}

// --- ডেইলি বোনাস চেক ---
(function() {
    let last = localStorage.getItem("lastLogin");
    let today = new Date().toDateString();
    if(last !== today) {
        setTimeout(() => {
            coins += 100;
            localStorage.setItem("coins", coins);
            localStorage.setItem("lastLogin", today);
            updateHUD();
            showMsg("DAILY BONUS", "Welcome back! 100 Coins Received 🎁");
            play('bonus');
        }, 1000);
    }
})();

// --- গেম ইঞ্জিন ---
function startGame() {
    score = 0; lives = 3; enemies = []; items = [];
    running = true; isPaused = false;
    lastSpawn = Date.now();
    player.x = canvas.width/2 - player.w/2;
    player.y = canvas.height - 200; // রকেট পজিশন কিছুটা উপরে
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

    // মুভমেন্ট হ্যান্ডলিং
    if (moveLeft && player.x > 0) player.x -= playerSpeed;
    if (moveRight && player.x < canvas.width - player.w) player.x += playerSpeed;

    // এনিমি ও আইটেম স্পন
    let gap = Math.max(400, 1000 - (score / 15));
    if(now - lastSpawn > gap) {
        // ডাইনামিক এনিমি ইমেজ সিলেকশন লজিক (প্রতি ৫০০ পয়েন্টে)
        let enemyIndex = Math.floor(score / 500);
        // যদি ইনডেক্স অ্যারের সাইজের চেয়ে বেশি হয়ে যায়, তবে শেষ ইমেজটি নেবে
        if (enemyIndex >= ENEMY_IMAGES.length) {
            enemyIndex = ENEMY_IMAGES.length - 1;
        }
        
        enemies.push({ 
            x: Math.random()*(canvas.width-40), 
            y: -70, 
            w: 40, 
            h: 55, // ইমেজ চ্যাপ্টা হওয়া রোধ করতে হাইট সেট করা
            sp: 3 + (score/500),
            imgSrc: ENEMY_IMAGES[enemyIndex]
        });

        // কয়েন ও লাইফ স্পন
        if(Math.random() < 0.15) items.push({ x: Math.random()*(canvas.width-30), y: -60, w: 30, h: 30, type: "coin" });
        if(Math.random() < 0.03) items.push({ x: Math.random()*(canvas.width-30), y: -60, w: 30, h: 30, type: "life" });
        lastSpawn = now;
    }

    // এনিমি আপডেট ও কলিশন
    enemies.forEach((en, i) => {
        en.y += en.sp;
        if(rectHit(player, en)) { 
            enemies.splice(i,1); 
            lives--; 
            play('crash'); 
            updateHUD(); 
            if(lives <= 0) gameOver(); 
        }
        else if(en.y > canvas.height) { 
            enemies.splice(i,1); 
            score += 10; 
            updateHUD(); 
        }
    });

    // আইটেম কালেকশন
    items.forEach((it, i) => {
        it.y += 4;
        if(rectHit(player, it)) {
            if(it.type === "coin") { coins++; play('collect'); }
            else { if(lives < 5) lives++; play('bonus'); }
            items.splice(i,1); 
            updateHUD(); 
            localStorage.setItem("coins", coins);
        } else if(it.y > canvas.height) items.splice(i,1);
    });
}

function draw() {
    ctx.clearRect(0,0,canvas.width, canvas.height);
    ctx.fillStyle = "white";
    stars.forEach(s => { ctx.beginPath(); ctx.arc(s.x, s.y, s.sz, 0, Math.PI*2); ctx.fill(); });
    
    // রকেট ড্র
    ctx.drawImage(imgP, player.x, player.y, player.w, player.h);
    
    // এনিমি ড্র (ডাইনামিক ইমেজ সহ)
    enemies.forEach(en => {
        let eImg = new Image();
        eImg.src = en.imgSrc;
        ctx.drawImage(eImg, en.x, en.y, en.w, en.h);
    });
    
    // আইটেম ড্র
    items.forEach(it => ctx.drawImage(it.type === "coin" ? imgC : imgL, it.x, it.y, it.w, it.h));
}

function rectHit(a, b) { 
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; 
}

// --- স্টোর ম্যানেজমেন্ট ---
function showStore() {
    showPage("storePage");
    let unlocked = JSON.parse(localStorage.getItem("unlocked")) || [0];
    let html = "";
    ROCKETS.forEach(r => {
        let isUnlocked = unlocked.includes(r.id);
        let isSelected = selectedRocketId === r.id;
        html += `<div class="rocket-card ${isSelected ? 'selected' : ''}" onclick="handleStoreClick(${r.id}, ${r.price})">
            <img src="${r.img}" style="width:40px; height:60px; object-fit: contain;">
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
            showMsg("LOCKED", `You need ${price - coins} more coins.`);
        }
    }
}

// --- সিস্টেম ফাংশন ---
function togglePause() { 
    isPaused = !isPaused; 
    document.getElementById("pauseIcon").className = isPaused ? "fas fa-play" : "fas fa-pause"; 
}
function showPage(id) { 
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active")); 
    document.getElementById(id).classList.add("active"); 
}
function goStart() { showPage("startPage"); updateHUD(); }
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

// টাচ কন্ট্রোল লজিক
canvas.addEventListener('touchstart', (e) => {
    if(!running || isPaused) return;
    if (e.touches[0].clientX < window.innerWidth / 2) { moveLeft = true; moveRight = false; }
    else { moveRight = true; moveLeft = false; }
}, {passive: false});
canvas.addEventListener('touchend', () => { moveLeft = false; moveRight = false; });

function toggleSound() { 
    soundOn = !soundOn; 
    localStorage.setItem("soundOn", soundOn); 
    document.getElementById("soundToggle").innerHTML = soundOn ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-mute"></i>'; 
}

function resize() { 
    canvas.width = window.innerWidth; 
    canvas.height = window.innerHeight; 
    stars = Array.from({length: 40}, () => ({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, sz: Math.random()*2, sp: Math.random()*2+1 })); 
}
window.addEventListener('resize', resize);
window.onload = () => { resize(); updateHUD(); };