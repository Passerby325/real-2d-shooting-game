let animationFrameId; 
// 防止图片被拖拽
window.addEventListener('load', function() {
    const images = document.getElementsByTagName('img');
    for (let i = 0; i < images.length; i++) {
        images[i].addEventListener('dragstart', function(e) {
            e.preventDefault();
        });
        images[i].style.webkitUserSelect = 'none';
        images[i].style.userSelect = 'none';
        images[i].setAttribute('draggable', 'false');
    }
});
let lastPauseTime = 0; // 添加变量来存储最后一次暂停的时间

// 检测页面可见性变化
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        // 页面重新可见时恢复游戏
        if (gameStarted && !gameOver) {
            startTime += Date.now() - lastPauseTime;  // 调整开始时间
            gameLoop();
        }
    } else {
        // 页面变为不可见时暂停游戏
        if (gameStarted && !gameOver) {
            lastPauseTime = Date.now();
            cancelAnimationFrame(animationFrameId);
        }
    }
});

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const timeDisplay = document.getElementById('time');
const killCountDisplay = document.getElementById('killCount');
const playButton = document.getElementById('playButton');
const winConditions = document.getElementById('winConditions');
const replayButton = document.getElementById('replayButton');
const groundColor = 'brown';
let groundHeight = 50;

const playerImg = new Image();
playerImg.src = 'player.png';

const enemyImg = new Image();
enemyImg.src = 'enemy.png';

const player = {
    x: 400,
    y: 0,
    width: 25,
    height: 25,
    baseSpeed: 3.5,
    speed: 3.5,
    speedGrowthRate: 0.01,
    isJumping: false,
    jumpSpeed: 0,
    gravity: 0.5,
    jumpHeight: -10,
    ground: 0,
    direction: 'right',
    shield: null
};

const bullets = [];
const enemies = [];
const shields = [];
const dropHints = [];
let bulletSpeed = 5;
let enemySpeed = 1.75;
let enemySpawnInterval = 1000;
let gameOver = false;
let gameStarted = false;
let startTime = null;
let killCount = 0;

let platform = null;
let platformFlashInterval = null;
let platformTimeout = null;

let enemySpawnTimer;
let platformSpawnTimer;
let shieldSpawnTimer;
let finalSurvivalTime = 0;

// 添加难度配置和游戏状态
const difficultyConfig = {
    enemySpawn: { // 敌人生成设置
        initialMin: 1000,  // 初始最小生成间隔（毫秒）
        initialMax: 1500,  // 初始最大生成间隔（毫秒）
        minLimit: 200,     // 最终最小生成间隔（最快生成速度）
        maxLimit: 600,     // 最终最大生成间隔（最快时的随机范围）
        scaleRate: 5    // 每秒减少的生成间隔（原0.05→现在加快100%）
    },
    enemySpeed: { // 敌人移动速度
        initial: 2.5,    // 初始速度
        maxSpeed: 100,      // 最大速度上限
        scaleRate: 10 // 每秒增加的速度（原0.0015→现在翻倍）
    },
    bulletSpeed: { // 子弹速度
        initial: 5,       // 初始子弹速度
        maxSpeed: 8,      // 最大子弹速度
        scaleRate: 0.002  // 每秒增加的速度（原0.001→现在翻倍）
    },
    playerSpeed: { // 玩家移动速度
        initial: 3.5,     // 初始移动速度
        maxSpeed: 6,      // 最大移动速度
        scaleRate: 0.002  // 每秒增加的速度（原0.001→现在翻倍）
    },
    playerJump: { // 玩家跳跃设置
        initialJumpHeight: -5, // 初始跳跃高度（负值表示向上）
        maxJumpHeight: -10,     // 最大跳跃高度
        initialGravity: 0.5,    // 初始重力值（下落速度）
        maxGravity: 0.65,       // 最大重力值
        scaleRate: 0.001        // 每秒增强的跳跃能力（原0.0005→现在翻倍）
    }};

const gameState = {
    currentEnemySpawnMin: difficultyConfig.enemySpawn.initialMin,
    currentEnemySpawnMax: difficultyConfig.enemySpawn.initialMax,
    currentEnemySpeed: difficultyConfig.enemySpeed.initial,
    currentBulletSpeed: difficultyConfig.bulletSpeed.initial,
    currentPlayerSpeed: difficultyConfig.playerSpeed.initial,
    currentJumpHeight: difficultyConfig.playerJump.initialJumpHeight,
    currentGravity: difficultyConfig.playerJump.initialGravity
};

document.addEventListener('keydown', movePlayer);
document.addEventListener('keyup', stopPlayer);
document.addEventListener('keydown', shootBullet);

document.getElementById('leftButton').addEventListener('touchstart', () => {
    keys['ArrowLeft'] = true;
    player.direction = 'left';
});
document.getElementById('leftButton').addEventListener('touchend', () => keys['ArrowLeft'] = false);
document.getElementById('rightButton').addEventListener('touchstart', () => {
    keys['ArrowRight'] = true;
    player.direction = 'right';
});
document.getElementById('rightButton').addEventListener('touchend', () => keys['ArrowRight'] = false);
document.getElementById('jumpButton').addEventListener('touchstart', () => {
    if (!player.isJumping) {
        player.isJumping = true;
        player.jumpSpeed = player.jumpHeight;
    }
});
document.getElementById('shootButton').addEventListener('touchstart', shootBullet);

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    groundHeight = canvas.height * 0.1;
    player.ground = canvas.height - groundHeight - player.height;
    player.y = player.ground;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let keys = {};

function movePlayer(e) {
    keys[e.key] = true;
    if (e.key === 'ArrowUp' && !player.isJumping) {
        player.isJumping = true;
        player.jumpSpeed = player.jumpHeight;
    } else if (e.key === 'ArrowLeft') {
        player.direction = 'left';
    } else if (e.key === 'ArrowRight') {
        player.direction = 'right';
    }
}

function stopPlayer(e) {
    keys[e.key] = false;
}

function shootBullet(e) {
    if (e.type === 'touchstart' || e.key === ' ') {
        bullets.push({
            x: player.direction === 'left' ? player.x : player.x + player.width,
            y: player.y + player.height / 2 - 2.5,
            width: 10,
            height: 5,
            color: 'red',
            direction: player.direction
        });
    }
}

function spawnEnemy() {
    const spawnFromTop = Math.random() < 0.5;
    let x, y, direction, type;

    if (spawnFromTop) {
        x = Math.random() * (canvas.width - 25);
        y = 0;
        direction = 'down';
        type = 'wd';

        // 添加掉落提示信息
        dropHints.push({
            x: x,
            y: player.ground,
            time: Date.now()
        });
    } else {
        x = Math.random() < 0.5 ? 0 : canvas.width - 25;
        y = player.ground;
        direction = x === 0 ? 'right' : 'left';
        type = 'hj';
    }

    enemies.push({
        x: x,
        y: y,
        width: 25,
        height: 25,
        speed: enemySpeed,
        direction: direction,
        lastDirection: 'right',
        type: type
    });
}

function spawnShield() {
    const x = Math.random() * (canvas.width - 50);
    const y = player.ground - 25;
    shields.push({
        x: x,
        y: y,
        radius: 25,
        active: true
    });
}

function update() {
    if (!gameStarted) return;

    updateDifficulty(); // 新增难度更新

    const currentTime = Date.now();
    const elapsedTime = Math.floor((currentTime - startTime) / 1000);
    timeDisplay.textContent = `Time: ${elapsedTime}s`;

    // 应用当前难度设置
    player.speed = gameState.currentPlayerSpeed;
    player.jumpHeight = gameState.currentJumpHeight;
    player.gravity = gameState.currentGravity;
    bulletSpeed = gameState.currentBulletSpeed;

    if (keys['ArrowLeft'] && player.x > 0) {
        player.x -= player.speed;
    }
    if (keys['ArrowRight'] && player.x < canvas.width - player.width) {
        player.x += player.speed;
    }

    if (player.isJumping) {
        player.y += player.jumpSpeed;
        player.jumpSpeed += player.gravity;
        if (player.y >= player.ground) {
            player.y = player.ground;
            player.isJumping = false;
        }
    }

    bullets.forEach((bullet, index) => {
        if (bullet.direction === 'right') {
            bullet.x += bulletSpeed;
        } else {
            bullet.x -= bulletSpeed;
        }
        if (bullet.x < 0 || bullet.x > canvas.width) {
            bullets.splice(index, 1);
        }
    });

    enemies.forEach((enemy, index) => {
        if (enemy.direction === 'down') {
            enemy.y += enemy.speed;
            if (enemy.y >= player.ground) {
                enemy.y = player.ground;
                enemy.direction = enemy.x < canvas.width / 2 ? 'right' : 'left';
            }
        } else {
            if (enemy.direction === 'right') {
                enemy.x += enemy.speed;
                enemy.lastDirection = 'right';
            } else {
                enemy.x -= enemy.speed;
                enemy.lastDirection = 'left';
            }
        }

        const collisionBuffer = 10;
        if (enemy.x + collisionBuffer < player.x + player.width &&
            enemy.x + enemy.width - collisionBuffer > player.x &&
            enemy.y + collisionBuffer < player.y + player.height &&
            enemy.y + enemy.height - collisionBuffer > player.y) {
            if (player.shield && player.shield.active) {
                player.shield.active = false;
                enemies.splice(index, 1);
            }  else {
        gameOver = true;
        finalSurvivalTime = Math.floor((Date.now() - startTime) / 1000);  // 立即保存最终时间
        document.getElementById('nameInputForm').querySelector('h2').textContent = 
            `Game Over! You survived ${finalSurvivalTime} seconds`;
        showNameInput();
    }
}

	    

        bullets.forEach((bullet, bIndex) => {
            if (bullet.x < enemy.x + enemy.width &&
                bullet.x + bullet.width > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + bullet.height > enemy.y) {
                bullets.splice(bIndex, 1);
                enemies.splice(index, 1);
                killCount++;
                // 更新显示的敌人数量
                killCountDisplay.textContent = `Enemies Killed: ${killCount}`;
            }
        });

        if (enemy.y > canvas.height || enemy.x < -50 || enemy.x > canvas.width + 50) {
            enemies.splice(index, 1);
        }
    });

    // 更新掉落提示信息
    dropHints.forEach((hint, index) => {
        if (currentTime - hint.time >= 500) {
            dropHints.splice(index, 1);
        }
    });

    if (platform) {
        if (player.y + player.height <= platform.y &&
            player.y + player.height + player.jumpSpeed >= platform.y &&
            player.x + player.width > platform.x &&
            player.x < platform.x + platform.width) {
            player.y = platform.y - player.height;
            player.isJumping = false;
        }

        enemies.forEach(enemy => {
            if (enemy.y + enemy.height <= platform.y &&
                enemy.y + enemy.height + enemy.speed >= platform.y &&
                enemy.x + enemy.width > platform.x &&
                enemy.x < platform.x + platform.width) {
                enemy.y = platform.y - enemy.height;
                enemy.direction = enemy.x < player.x ? 'right' : 'left';
            }
        });
    }

    shields.forEach((shield, index) => {
        if (player.x + player.width > shield.x - shield.radius &&
            player.x < shield.x + shield.radius &&
            player.y + player.height > shield.y - shield.radius &&
            player.y < shield.y + shield.radius) {
            player.shield = shield;
            shields.splice(index, 1);
        }
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = groundColor;
    ctx.fillRect(0, canvas.height - groundHeight, canvas.width, groundHeight);

    if (player.direction === 'right') {
        ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
    } else {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(playerImg, -player.x - player.width, player.y, player.width, player.height);
        ctx.restore();
    }

    if (player.shield && player.shield.active) {
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width, 0, Math.PI * 2);
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 5;
        ctx.stroke();
    }

    bullets.forEach(bullet => {
        ctx.fillStyle = bullet.color;
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    });

    enemies.forEach(enemy => {
        if (enemy.lastDirection === 'right') {
            ctx.drawImage(enemyImg, enemy.x, enemy.y, enemy.width, enemy.height);
        } else {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(enemyImg, -enemy.x - enemy.width, enemy.y, enemy.width, enemy.height);
            ctx.restore();
        }
        
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.fillText(enemy.type, enemy.x + enemy.width / 4, enemy.y - 10);
    });

    shields.forEach(shield => {
        ctx.beginPath();
        ctx.arc(shield.x, shield.y, shield.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'blue';
        ctx.fill();
    });

    // 绘制掉落提示信息
    dropHints.forEach(hint => {
        ctx.fillStyle = 'red';
        ctx.fillRect(hint.x, hint.y, 25, 25);
    });

    if (platform) {
        ctx.fillStyle = platform.color;
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    }

if (gameOver) {
    ctx.fillStyle = 'red';
    ctx.font = '48px sans-serif';
    ctx.fillText('Game Over', canvas.width / 2 - 100, canvas.height / 2);

    }
}

function gameLoop() {
    if (!gameOver) {
        update();
        draw();
        animationFrameId = requestAnimationFrame(gameLoop);
    } else {
        replayButton.style.display = 'block';
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
    }
}

function startSpawningEnemies() {
    if (enemySpawnTimer) clearInterval(enemySpawnTimer);
    
    function scheduleNextSpawn() {
        const spawnDelay = Math.random() * 
            (gameState.currentEnemySpawnMax - gameState.currentEnemySpawnMin) + 
            gameState.currentEnemySpawnMin;
        
        enemySpawnTimer = setTimeout(() => {
            spawnEnemy();
            if (!gameOver) scheduleNextSpawn();
        }, spawnDelay);
    }
    
    scheduleNextSpawn();
}


function startSpawningPlatforms() {
    if (platformSpawnTimer) clearInterval(platformSpawnTimer);
    platformSpawnTimer = setInterval(spawnPlatform, 20000);
}

function spawnPlatform() {
    if (platformFlashInterval) {
        clearInterval(platformFlashInterval);
    }
    if (platformTimeout) {
        clearTimeout(platformTimeout);
    }
    platform = {
        x: Math.random() * (canvas.width - 100),
        y: 550,
        width: 100,
        height: 10,
        color: 'yellow',
    };

    platformTimeout = setTimeout(() => {
        let flashCount = 0;
        platformFlashInterval = setInterval(() => {
            platform.color = flashCount % 2 === 0 ? 'yellow' : 'transparent';
            flashCount++;
            if (flashCount >= 6) {
                clearInterval(platformFlashInterval);
                if (player.y + player.height <= platform.y) {
                    player.isJumping = true;
                    player.jumpSpeed = player.gravity;
                }
                platform = null;
            }
        }, 500);
    }, 7000);
}


function startSpawningShields() {
    if (shieldSpawnTimer) clearInterval(shieldSpawnTimer);
    shieldSpawnTimer = setInterval(spawnShield, 10000);
}
function resetGame() {
        if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
document.getElementById('nameInputForm').style.display = 'none';
    // 清除所有定时器
    if (enemySpawnTimer) clearInterval(enemySpawnTimer);
    if (platformSpawnTimer) clearInterval(platformSpawnTimer);
    if (shieldSpawnTimer) clearInterval(shieldSpawnTimer);
    if (platformFlashInterval) clearInterval(platformFlashInterval);
    if (platformTimeout) clearTimeout(platformTimeout);
    // 重置游戏状态
    gameOver = false;
    gameStarted = false;
    startTime = null;
    killCount = 0;
    finalSurvivalTime = 0; 
    
    // 重置玩家位置和状态
    player.x = 400;
    player.y = player.ground;
    player.speed = gameState.currentPlayerSpeed;
    player.isJumping = false;
    player.jumpSpeed = 0;
    player.shield = null;
	
    
    // 清空数组
    bullets.length = 0;
    enemies.length = 0;
    shields.length = 0;
    dropHints.length = 0;
    
    // 重置显示
    timeDisplay.textContent = 'Time: 0s';
    killCountDisplay.textContent = 'Enemies Killed: 0';
    
    // 隐藏 replay 按钮
    replayButton.style.display = 'none';
    
    // 重新启动生成器
    startSpawningEnemies();
    startSpawningPlatforms();
    startSpawningShields();
    
    // 启动游戏
    gameStarted = true;
    startTime = Date.now();
    gameLoop();

    // 添加游戏状态重置
    Object.assign(gameState, {
        currentEnemySpawnMin: difficultyConfig.enemySpawn.initialMin,
        currentEnemySpawnMax: difficultyConfig.enemySpawn.initialMax,
        currentEnemySpeed: difficultyConfig.enemySpeed.initial,
        currentBulletSpeed: difficultyConfig.bulletSpeed.initial,
        currentPlayerSpeed: difficultyConfig.playerSpeed.initial,
        currentJumpHeight: difficultyConfig.playerJump.initialJumpHeight,
        currentGravity: difficultyConfig.playerJump.initialGravity
    });
    
    // 更新玩家属性
    player.speed = gameState.currentPlayerSpeed;
    player.jumpHeight = gameState.currentJumpHeight;
    player.gravity = gameState.currentGravity;
}


playButton.addEventListener('click', () => {
    gameStarted = true;
    startTime = Date.now();
    winConditions.style.display = 'none';
    playButton.style.display = 'none';
    replayButton.style.display = 'none'; // 确保开始新游戏时隐藏 replay 按钮
    startSpawningEnemies();
    startSpawningPlatforms();
    startSpawningShields();
    gameLoop();
});
replayButton.addEventListener('click', resetGame);
replayButton.addEventListener('touchstart', resetGame);

// 禁用长按选择和上下文菜单

document.addEventListener('DOMContentLoaded', (event) => {
    const elements = document.querySelectorAll('body, .button');

    elements.forEach(element => {
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        let touchTimeout;

        element.addEventListener('touchstart', (e) => {
            touchTimeout = setTimeout(() => {
                e.preventDefault();
            }, 50); // 500ms长按
        });

        element.addEventListener('touchend', () => {
            clearTimeout(touchTimeout);
        });
    });
});

// Firebase-related functions

async function submitScore(playerName) {
    const submitButton = document.getElementById('submitScore');
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    try {
        // 确保有最终时间
        if (finalSurvivalTime === undefined || finalSurvivalTime === null) {
            finalSurvivalTime = Math.floor((Date.now() - startTime) / 1000);
        }

        const scoreData = {
            playerName: playerName,
            survivalTime: finalSurvivalTime,
            killCount: killCount,
            timestamp: window.serverTimestamp(),
            result: finalSurvivalTime >= 90 && killCount >= 20 ? "Victory" : "Defeat"
        };
        
        const docRef = await window.addDoc(window.collection(window.db, "scores"), scoreData);
        console.log("Score saved successfully with ID: ", docRef.id);
        document.getElementById('nameInputForm').style.display = 'none';
        document.getElementById('replayButton').style.display = 'block';
    } catch (error) {
        console.error("Error saving score: ", error);
        alert("Error saving score. Please try again.");
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Score';
    }
}


function showNameInput() {
    document.getElementById('finalTime').textContent = finalSurvivalTime;
    document.getElementById('finalKills').textContent = killCount;
    document.getElementById('nameInputForm').style.display = 'block';
    document.getElementById('replayButton').style.display = 'none';
}

// Add event listener for score submission

document.getElementById('submitScore').addEventListener('click', () => {
    const playerName = document.getElementById('playerName').value.trim();
    if (playerName) {
        submitScore(playerName);  // 不需要重新计算时间
    } else {
        alert("Please enter your name!");
    }
});

// 添加排行榜功能
async function fetchLeaderboard() {
    try {
        // 获取排序后的前10名玩家
        const querySnapshot = await window.getDocs(
  window.query(
    window.collection(window.db, "scores"),
    window.orderBy("survivalTime", "desc"), // 按存活时间降序排序
    window.orderBy("killCount", "desc"),     // 时间相同时按击杀数降序排序
    window.limit(10)
  )
);

        const leaderboardBody = document.getElementById('leaderboardBody');
        leaderboardBody.innerHTML = ''; // 清空现有数据

        let rank = 1;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
            row.innerHTML = `
                <td style="padding: 8px; text-align: center;">${rank}</td>
                <td style="padding: 8px;">${data.playerName}</td>
                <td style="padding: 8px; text-align: center;">${data.survivalTime}s</td>
                <td style="padding: 8px; text-align: center;">${data.killCount}</td>
            `;
            leaderboardBody.appendChild(row);
            rank++;
        });

        // 显示排行榜面板
        document.getElementById('leaderboardPanel').style.display = 'block';
    } catch (error) {
        console.error("Error fetching leaderboard: ", error);
        alert("Error loading leaderboard. Please try again.");
    }
}

// 添加事件监听器
document.addEventListener('DOMContentLoaded', () => {
    // 排行榜按钮点击事件
    document.getElementById('leaderboardButton').addEventListener('click', fetchLeaderboard);

    // 关闭排行榜按钮点击事件
    document.getElementById('closeLeaderboard').addEventListener('click', () => {
        document.getElementById('leaderboardPanel').style.display = 'none';
    });
});

// 新增难度更新函数
function updateDifficulty() {
    if (!gameStarted || gameOver) return;
    
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    
    gameState.currentEnemySpawnMin = Math.max(
        difficultyConfig.enemySpawn.minLimit,
        difficultyConfig.enemySpawn.initialMin - (elapsedSeconds * difficultyConfig.enemySpawn.scaleRate)
    );
    gameState.currentEnemySpawnMax = Math.max(
        difficultyConfig.enemySpawn.maxLimit,
        difficultyConfig.enemySpawn.initialMax - (elapsedSeconds * difficultyConfig.enemySpawn.scaleRate)
    );
    
    gameState.currentEnemySpeed = Math.min(
        difficultyConfig.enemySpeed.maxSpeed,
        difficultyConfig.enemySpeed.initial + (elapsedSeconds * difficultyConfig.enemySpeed.scaleRate)
    );
    
    gameState.currentBulletSpeed = Math.min(
        difficultyConfig.bulletSpeed.maxSpeed,
        difficultyConfig.bulletSpeed.initial + (elapsedSeconds * difficultyConfig.bulletSpeed.scaleRate)
    );
    
    gameState.currentPlayerSpeed = Math.min(
        difficultyConfig.playerSpeed.maxSpeed,
        difficultyConfig.playerSpeed.initial + (elapsedSeconds * difficultyConfig.playerSpeed.scaleRate)
    );
    
    gameState.currentJumpHeight = Math.min(
        difficultyConfig.playerJump.maxJumpHeight,
        difficultyConfig.playerJump.initialJumpHeight + (elapsedSeconds * difficultyConfig.playerJump.scaleRate)
    );
    gameState.currentGravity = Math.min(
        difficultyConfig.playerJump.maxGravity,
        difficultyConfig.playerJump.initialGravity + (elapsedSeconds * difficultyConfig.playerJump.scaleRate)
    );
}

 
