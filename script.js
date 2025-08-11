const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
let gameRunning = true;
let player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 15,
    health: 100,
    maxHealth: 100,
    speed: 3,
    weapon: 'pistol',
    experience: 0,
    level: 1
};

// Enhanced weapon system with realistic calibers
const weapons = {
    pistol: {
        damage: 25, fireRate: 300, ammo: 15, maxAmmo: 15, spread: 0.05, bulletSpeed: 8,
        color: '#ffff00', caliber: '9mm Parabellum', width: 20, height: 12,
        name: 'Glock 17', recoil: 0.1, range: 250
    },
    shotgun: {
        damage: 60, fireRate: 800, ammo: 8, maxAmmo: 8, spread: 0.4, bulletSpeed: 6,
        color: '#ff6600', caliber: '12 Gauge', width: 35, height: 8,
        name: 'Remington 870', recoil: 0.3, range: 150
    },
    rifle: {
        damage: 45, fireRate: 150, ammo: 30, maxAmmo: 30, spread: 0.02, bulletSpeed: 12,
        color: '#00ffff', caliber: '5.56x45mm NATO', width: 40, height: 6,
        name: 'M4A1', recoil: 0.15, range: 400
    },
    sniper: {
        damage: 100, fireRate: 1200, ammo: 10, maxAmmo: 10, spread: 0.01, bulletSpeed: 15,
        color: '#ff00ff', caliber: '.308 Winchester', width: 50, height: 8,
        name: 'M24 SWS', recoil: 0.4, range: 600
    },
    machinegun: {
        damage: 35, fireRate: 80, ammo: 100, maxAmmo: 100, spread: 0.2, bulletSpeed: 10,
        color: '#ff0066', caliber: '7.62x51mm NATO', width: 45, height: 10,
        name: 'M249 SAW', recoil: 0.2, range: 350
    }
};

let zombies = [];
let bullets = [];
let particles = [];
let powerUps = [];
let explosions = [];
let score = 0;
let wave = 1;
let ammo = weapons[player.weapon].ammo;
let maxAmmo = weapons[player.weapon].maxAmmo;
let zombiesKilled = 0;
let zombiesPerWave = 5;
let lastShot = 0;
let bossSpawned = false;

// Input handling
let keys = {};
let mousePos = { x: 0, y: 0 };
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let touchStartPos = { x: 0, y: 0 };
let touchCurrentPos = { x: 0, y: 0 };
let isTouching = false;
let joystickCenter = { x: 0, y: 0 };
let joystickActive = false;
let aimStartPos = { x: 0, y: 0 };
let aimCurrentPos = { x: 0, y: 0 };
let isAiming = false;
let touchIdentifiers = new Map();
let joystickBase = { x: 80, y: 0 }; // Will be set to bottom left
let joystickKnob = { x: 80, y: 0 };
let joystickVisible = false;

// Device detection
function detectDevice() {
    const userAgent = navigator.userAgent.toLowerCase();
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (isTouchDevice && /android|iphone|ipad|ipod|mobile/i.test(userAgent)) {
        return 'mobile';
    } else if (isTouchDevice && /tablet|ipad/i.test(userAgent)) {
        return 'tablet';
    } else {
        return 'desktop';
    }
}

const deviceType = detectDevice();

// Event listeners
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'r') {
        reload();
    }
    if (e.key.toLowerCase() === 'q') {
        switchWeapon();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mousePos.x = e.clientX - rect.left;
    mousePos.y = e.clientY - rect.top;
});

canvas.addEventListener('click', (e) => {
    if (gameRunning) {
        shoot();
    }
});

// Mobile touch controls
document.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();

    for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        const x = touch.clientX;
        const y = touch.clientY;
        const canvasX = x - rect.left;
        const canvasY = y - rect.top;
        const id = touch.identifier;

        // Check if touch is in joystick area (bottom left)
        const joystickDistance = Math.hypot(x - joystickBase.x, y - joystickBase.y);
        const weaponButtonX = window.innerWidth - 80;
        const weaponButtonY = window.innerHeight - 80;
        const weaponButtonDistance = Math.hypot(x - weaponButtonX, y - weaponButtonY);
        const reloadButtonX = window.innerWidth - 50;
        const reloadButtonY = window.innerHeight / 2;
        const reloadButtonDistance = Math.hypot(x - reloadButtonX, y - reloadButtonY);

        if (joystickDistance <= 60) {
            // Joystick area
            touchIdentifiers.set(id, 'joystick');
            joystickActive = true;
            joystickVisible = true;
            touchStartPos.x = joystickBase.x;
            touchStartPos.y = joystickBase.y;
            touchCurrentPos.x = x;
            touchCurrentPos.y = y;
            joystickKnob.x = x;
            joystickKnob.y = y;
        } else if (weaponButtonDistance <= 45) {
            // Weapon switch button
            touchIdentifiers.set(id, 'weapon');
            switchWeapon();
            return; // Don't continue processing this touch
        } else if (reloadButtonDistance <= 35) {
            // Reload button - don't treat as canvas touch
            touchIdentifiers.set(id, 'reload');
            reload();
            return; // Don't continue processing this touch
        } else if (canvasX >= 0 && canvasX <= canvas.width && canvasY >= 0 && canvasY <= canvas.height) {
            // Canvas touch - aiming and shooting (only if not reload button)
            touchIdentifiers.set(id, 'canvas');
            aimStartPos.x = canvasX;
            aimStartPos.y = canvasY;
            mousePos.x = canvasX;
            mousePos.y = canvasY;
            isAiming = true;

            // Tap to shoot
            if (gameRunning) {
                shoot();
            }
        }
    }
    isTouching = true;
});

document.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();

    for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        const x = touch.clientX;
        const y = touch.clientY;
        const canvasX = x - rect.left;
        const canvasY = y - rect.top;
        const id = touch.identifier;
        const touchType = touchIdentifiers.get(id);

        if (touchType === 'canvas') {
            // Swipe to aim
            aimCurrentPos.x = canvasX;
            aimCurrentPos.y = canvasY;

            // Calculate aim direction from swipe
            const deltaX = canvasX - aimStartPos.x;
            const deltaY = canvasY - aimStartPos.y;
            const distance = Math.hypot(deltaX, deltaY);

            if (distance > 20) { // Minimum swipe distance
                const aimX = player.x + deltaX * 2;
                const aimY = player.y + deltaY * 2;
                mousePos.x = Math.max(0, Math.min(canvas.width, aimX));
                mousePos.y = Math.max(0, Math.min(canvas.height, aimY));
            }
        } else if (touchType === 'joystick') {
            // Movement joystick - constrain to joystick area
            const deltaX = x - joystickBase.x;
            const deltaY = y - joystickBase.y;
            const distance = Math.hypot(deltaX, deltaY);
            const maxDistance = 50;

            if (distance <= maxDistance) {
                touchCurrentPos.x = x;
                touchCurrentPos.y = y;
                joystickKnob.x = x;
                joystickKnob.y = y;
            } else {
                // Constrain to circle boundary
                const angle = Math.atan2(deltaY, deltaX);
                touchCurrentPos.x = joystickBase.x + Math.cos(angle) * maxDistance;
                touchCurrentPos.y = joystickBase.y + Math.sin(angle) * maxDistance;
                joystickKnob.x = touchCurrentPos.x;
                joystickKnob.y = touchCurrentPos.y;
            }
        } else if (touchType === 'reload' || touchType === 'weapon') {
            // Don't process movement for button touches
            continue;
        }
    }
});

document.addEventListener('touchend', (e) => {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const id = touch.identifier;
        const touchType = touchIdentifiers.get(id);

        if (touchType === 'joystick') {
            joystickActive = false;
            joystickVisible = false;
            touchCurrentPos.x = joystickBase.x;
            touchCurrentPos.y = joystickBase.y;
            joystickKnob.x = joystickBase.x;
            joystickKnob.y = joystickBase.y;
        } else if (touchType === 'canvas') {
            isAiming = false;
        }

        touchIdentifiers.delete(id);
    }

    if (e.touches.length === 0) {
        isTouching = false;
        joystickActive = false;
        joystickVisible = false;
        isAiming = false;
    }
});

// Double tap to reload on mobile
let lastTouchTime = 0;
let tapCount = 0;
document.addEventListener('touchstart', (e) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTouchTime;

    if (tapLength < 500 && tapLength > 0) {
        tapCount++;
        if (tapCount === 2) {
            reload();
            tapCount = 0;
        }
    } else {
        tapCount = 1;
    }
    lastTouchTime = currentTime;
});

// Game functions
function spawnZombie() {
    const side = Math.floor(Math.random() * 4);
    let x, y;

    switch(side) {
        case 0: // top
            x = Math.random() * canvas.width;
            y = -20;
            break;
        case 1: // right
            x = canvas.width + 20;
            y = Math.random() * canvas.height;
            break;
        case 2: // bottom
            x = Math.random() * canvas.width;
            y = canvas.height + 20;
            break;
        case 3: // left
            x = -20;
            y = Math.random() * canvas.height;
            break;
    }

    // Boss zombie every 5 waves
    if (wave % 5 === 0 && !bossSpawned) {
        zombies.push({
            x: x,
            y: y,
            radius: 25,
            health: 15 + wave,
            maxHealth: 15 + wave,
            speed: 0.3 + wave * 0.05,
            color: '#8B0000',
            type: 'boss',
            lastAttack: 0
        });
        bossSpawned = true;
    } else {
        // Random zombie types
        const zombieType = Math.random();
        if (zombieType < 0.7) {
            // Normal zombie
            zombies.push({
                x: x,
                y: y,
                radius: 12,
                health: 2 + Math.floor(wave / 3),
                speed: 0.5 + wave * 0.1,
                color: `hsl(${Math.random() * 60}, 70%, 30%)`,
                type: 'normal'
            });
        } else if (zombieType < 0.9) {
            // Fast zombie
            zombies.push({
                x: x,
                y: y,
                radius: 10,
                health: 1,
                speed: 1.2 + wave * 0.15,
                color: '#ff4444',
                type: 'fast'
            });
        } else {
            // Tank zombie
            zombies.push({
                x: x,
                y: y,
                radius: 18,
                health: 5 + Math.floor(wave / 2),
                speed: 0.3 + wave * 0.05,
                color: '#444444',
                type: 'tank'
            });
        }
    }
}

function spawnPowerUp(x, y) {
    const powerUpTypes = ['health', 'ammo', 'weapon', 'speed', 'damage'];
    const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];

    powerUps.push({
        x: x,
        y: y,
        radius: 8,
        type: type,
        life: 600, // 10 seconds at 60fps
        color: type === 'health' ? '#00ff00' :
               type === 'ammo' ? '#ffff00' :
               type === 'weapon' ? '#ff00ff' :
               type === 'speed' ? '#00ffff' : '#ff0000'
    });
}

function shoot() {
    const currentWeapon = weapons[player.weapon];
    const now = Date.now();

    if (ammo <= 0 || now - lastShot < currentWeapon.fireRate) return;

    lastShot = now;
    ammo--;

    const baseAngle = Math.atan2(mousePos.y - player.y, mousePos.x - player.x);
    const bulletsToFire = player.weapon === 'shotgun' ? 5 : 1;

    for (let i = 0; i < bulletsToFire; i++) {
        const spread = (Math.random() - 0.5) * currentWeapon.spread;
        const angle = baseAngle + spread;

        bullets.push({
            x: player.x,
            y: player.y,
            dx: Math.cos(angle) * currentWeapon.bulletSpeed,
            dy: Math.sin(angle) * currentWeapon.bulletSpeed,
            radius: 3,
            damage: currentWeapon.damage,
            color: currentWeapon.color
        });
    }

    // Enhanced muzzle flash
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: player.x + Math.cos(baseAngle) * 20,
            y: player.y + Math.sin(baseAngle) * 20,
            dx: (Math.random() - 0.5) * 6,
            dy: (Math.random() - 0.5) * 6,
            life: 15,
            color: currentWeapon.color
        });
    }
}

function reload() {
    ammo = weapons[player.weapon].maxAmmo;
    maxAmmo = weapons[player.weapon].maxAmmo;
}

function switchWeapon() {
    const weaponNames = Object.keys(weapons);
    const currentIndex = weaponNames.indexOf(player.weapon);
    const nextIndex = (currentIndex + 1) % weaponNames.length;
    player.weapon = weaponNames[nextIndex];

    ammo = Math.min(ammo, weapons[player.weapon].maxAmmo);
    maxAmmo = weapons[player.weapon].maxAmmo;
}

function collectPowerUp(powerUp) {
    switch(powerUp.type) {
        case 'health':
            player.health = Math.min(player.maxHealth, player.health + 30);
            break;
        case 'ammo':
            ammo = weapons[player.weapon].maxAmmo;
            break;
        case 'weapon':
            switchWeapon();
            break;
        case 'speed':
            player.speed = Math.min(5, player.speed + 0.5);
            break;
        case 'damage':
            // Temporary damage boost
            Object.values(weapons).forEach(weapon => weapon.damage += 1);
            setTimeout(() => {
                Object.values(weapons).forEach(weapon => weapon.damage = Math.max(1, weapon.damage - 1));
            }, 10000);
            break;
    }

    // Power-up collection effect
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: powerUp.x,
            y: powerUp.y,
            dx: (Math.random() - 0.5) * 8,
            dy: (Math.random() - 0.5) * 8,
            life: 30,
            color: powerUp.color
        });
    }
}

function createBloodSplash(x, y) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x,
            y: y,
            dx: (Math.random() - 0.5) * 6,
            dy: (Math.random() - 0.5) * 6,
            life: 20,
            color: '#ff0000'
        });
    }
}

function updatePlayer() {
    // Desktop movement
    if (deviceType === 'desktop' || deviceType === 'tablet') {
        if (keys['w'] && player.y > player.radius) player.y -= player.speed;
        if (keys['s'] && player.y < canvas.height - player.radius) player.y += player.speed;
        if (keys['a'] && player.x > player.radius) player.x -= player.speed;
        if (keys['d'] && player.x < canvas.width - player.radius) player.x += player.speed;
    }

    // Mobile joystick movement
    if (deviceType === 'mobile' && joystickActive) {
        const deltaX = touchCurrentPos.x - joystickBase.x;
        const deltaY = touchCurrentPos.y - joystickBase.y;
        const distance = Math.hypot(deltaX, deltaY);
        const maxDistance = 50;

        if (distance > 10) {
            const normalizedX = deltaX / distance;
            const normalizedY = deltaY / distance;
            const intensity = Math.min(distance / maxDistance, 1);

            const moveX = normalizedX * player.speed * intensity;
            const moveY = normalizedY * player.speed * intensity;

            if (player.x + moveX > player.radius && player.x + moveX < canvas.width - player.radius) {
                player.x += moveX;
            }
            if (player.y + moveY > player.radius && player.y + moveY < canvas.height - player.radius) {
                player.y += moveY;
            }
        }
    }
}

function updateZombies() {
    zombies.forEach((zombie, zombieIndex) => {
        // Move towards player
        const angle = Math.atan2(player.y - zombie.y, player.x - zombie.x);
        zombie.x += Math.cos(angle) * zombie.speed;
        zombie.y += Math.sin(angle) * zombie.speed;

        // Boss special attacks
        if (zombie.type === 'boss') {
            const now = Date.now();
            if (now - zombie.lastAttack > 3000) {
                zombie.lastAttack = now;
                // Boss charge attack
                const chargeAngle = Math.atan2(player.y - zombie.y, player.x - zombie.x);
                zombie.x += Math.cos(chargeAngle) * 50;
                zombie.y += Math.sin(chargeAngle) * 50;

                // Spawn explosion at boss location
                explosions.push({
                    x: zombie.x,
                    y: zombie.y,
                    radius: 0,
                    maxRadius: 60,
                    life: 20,
                    damage: 5
                });
            }
        }

        // Check collision with player
        const dist = Math.hypot(player.x - zombie.x, player.y - zombie.y);
        if (dist < player.radius + zombie.radius) {
            const damage = zombie.type === 'boss' ? 8 :
                          zombie.type === 'tank' ? 4 :
                          zombie.type === 'fast' ? 1 : 2;
            player.health -= damage;
            createBloodSplash(player.x, player.y);

            if (player.health <= 0) {
                gameOver();
                return;
            }
        }
    });
}

function updateBullets() {
    bullets.forEach((bullet, bulletIndex) => {
        bullet.x += bullet.dx;
        bullet.y += bullet.dy;

        // Remove bullets that go off screen
        if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
            bullets.splice(bulletIndex, 1);
            return;
        }

        // Check collision with zombies
        zombies.forEach((zombie, zombieIndex) => {
            const dist = Math.hypot(bullet.x - zombie.x, bullet.y - zombie.y);
            if (dist < bullet.radius + zombie.radius) {
                zombie.health -= bullet.damage;
                bullets.splice(bulletIndex, 1);
                createBloodSplash(zombie.x, zombie.y);

                if (zombie.health <= 0) {
                    const points = zombie.type === 'boss' ? 100 :
                                  zombie.type === 'tank' ? 25 :
                                  zombie.type === 'fast' ? 15 : 10;
                    score += points;
                    player.experience += points / 10;

                    // Chance to drop power-up
                    if (Math.random() < 0.15) {
                        spawnPowerUp(zombie.x, zombie.y);
                    }

                    // Boss death explosion
                    if (zombie.type === 'boss') {
                        for (let i = 0; i < 5; i++) {
                            explosions.push({
                                x: zombie.x + (Math.random() - 0.5) * 60,
                                y: zombie.y + (Math.random() - 0.5) * 60,
                                radius: 0,
                                maxRadius: 40,
                                life: 25,
                                damage: 0
                            });
                        }
                        bossSpawned = false;
                    }

                    zombies.splice(zombieIndex, 1);
                    zombiesKilled++;

                    // Check for wave completion
                    if (zombiesKilled >= zombiesPerWave) {
                        wave++;
                        zombiesKilled = 0;
                        zombiesPerWave += 3;
                        player.health = Math.min(player.maxHealth, player.health + 20);
                        ammo = weapons[player.weapon].maxAmmo;
                        maxAmmo = weapons[player.weapon].maxAmmo;
                        bossSpawned = false;
                    }

                    // Level up system
                    if (player.experience >= player.level * 50) {
                        player.level++;
                        player.maxHealth += 10;
                        player.health = player.maxHealth;
                        player.speed += 0.1;
                    }
                }
            }
        });
    });
}

function updateParticles() {
    particles.forEach((particle, index) => {
        particle.x += particle.dx;
        particle.y += particle.dy;
        particle.life--;
        particle.dx *= 0.98;
        particle.dy *= 0.98;

        if (particle.life <= 0) {
            particles.splice(index, 1);
        }
    });
}

function updatePowerUps() {
    powerUps.forEach((powerUp, index) => {
        powerUp.life--;

        // Pulsing effect
        powerUp.radius = 8 + Math.sin(Date.now() * 0.01) * 2;

        // Check collision with player
        const dist = Math.hypot(player.x - powerUp.x, player.y - powerUp.y);
        if (dist < player.radius + powerUp.radius) {
            collectPowerUp(powerUp);
            powerUps.splice(index, 1);
            return;
        }

        if (powerUp.life <= 0) {
            powerUps.splice(index, 1);
        }
    });
}

function updateExplosions() {
    explosions.forEach((explosion, index) => {
        explosion.radius += explosion.maxRadius / explosion.life;
        explosion.life--;

        // Check damage to zombies
        if (explosion.damage > 0) {
            zombies.forEach((zombie, zombieIndex) => {
                const dist = Math.hypot(zombie.x - explosion.x, zombie.y - explosion.y);
                if (dist < explosion.radius) {
                    zombie.health -= explosion.damage;
                    createBloodSplash(zombie.x, zombie.y);
                }
            });
        }

        if (explosion.life <= 0) {
            explosions.splice(index, 1);
        }
    });
}

function render() {
    // Clear canvas
    ctx.fillStyle = '#0d4f3c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid pattern
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Draw particles
    particles.forEach(particle => {
        ctx.globalAlpha = particle.life / 20;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    });

    // Draw player
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw player body details
    ctx.fillStyle = '#004400';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Draw gun model
    const angle = Math.atan2(mousePos.y - player.y, mousePos.x - player.x);
    const currentWeapon = weapons[player.weapon];

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(angle);

    // Gun body
    ctx.fillStyle = '#444444';
    ctx.fillRect(10, -currentWeapon.height/2, currentWeapon.width, currentWeapon.height);

    // Gun barrel
    ctx.fillStyle = '#222222';
    ctx.fillRect(currentWeapon.width + 5, -2, 15, 4);

    // Gun grip
    ctx.fillStyle = '#654321';
    ctx.fillRect(5, -currentWeapon.height/2 - 2, 8, currentWeapon.height + 4);

    // Weapon-specific details
    switch(player.weapon) {
        case 'pistol':
            ctx.fillStyle = '#666666';
            ctx.fillRect(15, -4, 8, 3);
            break;
        case 'shotgun':
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(8, -6, currentWeapon.width - 5, 3);
            ctx.fillRect(8, 3, currentWeapon.width - 5, 3);
            break;
        case 'rifle':
            ctx.fillStyle = '#2F4F2F';
            ctx.fillRect(12, -1, currentWeapon.width - 10, 2);
            ctx.fillRect(30, -3, 5, 6);
            break;
        case 'sniper':
            ctx.fillStyle = '#1C1C1C';
            ctx.fillRect(10, -1, currentWeapon.width - 5, 2);
            // Scope
            ctx.beginPath();
            ctx.arc(25, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'machinegun':
            ctx.fillStyle = '#556B2F';
            ctx.fillRect(15, -6, currentWeapon.width - 15, 12);
            break;
    }

    ctx.restore();

    // Draw crosshair
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mousePos.x - 10, mousePos.y);
    ctx.lineTo(mousePos.x + 10, mousePos.y);
    ctx.moveTo(mousePos.x, mousePos.y - 10);
    ctx.lineTo(mousePos.x, mousePos.y + 10);
    ctx.stroke();

    // Draw health bar
    const healthBarWidth = 40;
    const healthBarHeight = 6;
    const healthPercent = player.health / player.maxHealth;

    ctx.fillStyle = '#ff0000';
    ctx.fillRect(player.x - healthBarWidth/2, player.y - player.radius - 15, healthBarWidth, healthBarHeight);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(player.x - healthBarWidth/2, player.y - player.radius - 15, healthBarWidth * healthPercent, healthBarHeight);

    // Draw zombies
    zombies.forEach(zombie => {
        ctx.fillStyle = zombie.color;
        ctx.beginPath();
        ctx.arc(zombie.x, zombie.y, zombie.radius, 0, Math.PI * 2);
        ctx.fill();

        // Boss glow effect
        if (zombie.type === 'boss') {
            ctx.shadowColor = '#8B0000';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(zombie.x, zombie.y, zombie.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Zombie eyes
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        const eyeOffset = zombie.radius * 0.3;
        ctx.arc(zombie.x - eyeOffset, zombie.y - eyeOffset, 2, 0, Math.PI * 2);
        ctx.arc(zombie.x + eyeOffset, zombie.y - eyeOffset, 2, 0, Math.PI * 2);
        ctx.fill();

        // Health bar for bosses and damaged zombies
        if (zombie.type === 'boss' || (zombie.maxHealth && zombie.health < zombie.maxHealth)) {
            const healthBarWidth = zombie.radius * 2;
            const healthBarHeight = 4;
            const healthPercent = zombie.health / (zombie.maxHealth || zombie.health);

            ctx.fillStyle = '#ff0000';
            ctx.fillRect(zombie.x - healthBarWidth/2, zombie.y - zombie.radius - 10, healthBarWidth, healthBarHeight);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(zombie.x - healthBarWidth/2, zombie.y - zombie.radius - 10, healthBarWidth * healthPercent, healthBarHeight);
        }
    });

    // Draw explosions
    explosions.forEach(explosion => {
        const alpha = explosion.life / 20;
        ctx.globalAlpha = alpha;

        // Outer ring
        ctx.strokeStyle = '#ff4400';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner core
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, explosion.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
    });

    // Draw power-ups
    powerUps.forEach(powerUp => {
        ctx.fillStyle = powerUp.color;
        ctx.beginPath();
        ctx.arc(powerUp.x, powerUp.y, powerUp.radius, 0, Math.PI * 2);
        ctx.fill();

        // Glow effect
        ctx.shadowColor = powerUp.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(powerUp.x, powerUp.y, powerUp.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Power-up icon
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        const icon = powerUp.type === 'health' ? '+' :
                    powerUp.type === 'ammo' ? 'A' :
                    powerUp.type === 'weapon' ? 'W' :
                    powerUp.type === 'speed' ? 'S' : 'D';
        ctx.fillText(icon, powerUp.x, powerUp.y + 4);
    });

    // Draw bullets with weapon colors and enhanced effects
    bullets.forEach(bullet => {
        // Bullet glow
        ctx.shadowColor = bullet.color;
        ctx.shadowBlur = 5;
        ctx.fillStyle = bullet.color;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Bullet trail
        ctx.strokeStyle = bullet.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(bullet.x, bullet.y);
        ctx.lineTo(bullet.x - bullet.dx * 0.5, bullet.y - bullet.dy * 0.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
    });

    // Draw mobile controls
    if (deviceType === 'mobile') {
        // Aim indicator on canvas
        if (isAiming) {
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(player.x, player.y);
            ctx.lineTo(mousePos.x, mousePos.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Aim circle
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(mousePos.x, mousePos.y, 20, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // Draw visible joystick overlay
    if (deviceType === 'mobile') {
        drawJoystickOverlay();
    }
}

function updateUI() {
    document.getElementById('health').textContent = Math.max(0, player.health);
    document.getElementById('score').textContent = score;
    document.getElementById('ammo').textContent = `${ammo}/${maxAmmo}`;
    document.getElementById('wave').textContent = wave;

    // Add enhanced weapon and level display
    const statsDiv = document.getElementById('stats');
    const existingWeapon = document.getElementById('weapon');
    const existingLevel = document.getElementById('level');
    const existingCaliber = document.getElementById('caliber');

    if (!existingWeapon) {
        const weaponDiv = document.createElement('div');
        weaponDiv.id = 'weapon';
        statsDiv.appendChild(weaponDiv);
    }

    if (!existingLevel) {
        const levelDiv = document.createElement('div');
        levelDiv.id = 'level';
        statsDiv.appendChild(levelDiv);
    }

    if (!existingCaliber) {
        const caliberDiv = document.createElement('div');
        caliberDiv.id = 'caliber';
        statsDiv.appendChild(caliberDiv);
    }

    const currentWeapon = weapons[player.weapon];
    document.getElementById('weapon').textContent = `${currentWeapon.name}`;
    document.getElementById('caliber').textContent = `${currentWeapon.caliber}`;
    document.getElementById('level').textContent = `Level: ${player.level}`;
}

function gameOver() {
    gameRunning = false;
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').classList.remove('hidden');
}

function restartGame() {
    // Hide game over screen first
    document.getElementById('gameOver').classList.add('hidden');
    
    // Reset game state
    gameRunning = true;
    player.health = 100;
    player.maxHealth = 100;
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.weapon = 'pistol';
    player.speed = 3;
    player.experience = 0;
    player.level = 1;

    zombies = [];
    bullets = [];
    particles = [];
    powerUps = [];
    explosions = [];
    score = 0;
    wave = 1;
    ammo = weapons[player.weapon].ammo;
    maxAmmo = weapons[player.weapon].maxAmmo;
    zombiesKilled = 0;
    zombiesPerWave = 5;
    lastShot = 0;
    bossSpawned = false;

    // Reset weapon stats to original values
    weapons.pistol.damage = 25;
    weapons.shotgun.damage = 60;
    weapons.rifle.damage = 45;
    weapons.sniper.damage = 100;
    weapons.machinegun.damage = 35;

    // Start the game loop immediately
    requestAnimationFrame(gameLoop);
}

// Spawn zombies periodically
setInterval(() => {
    if (gameRunning && zombies.length < wave * 3 + 5) {
        spawnZombie();
    }
}, 2000 / wave);

function gameLoop() {
    if (!gameRunning) return;

    updatePlayer();
    updateZombies();
    updateBullets();
    updateParticles();
    updatePowerUps();
    updateExplosions();
    render();
    updateUI();

    requestAnimationFrame(gameLoop);
}

function drawJoystickOverlay() {
    // Save current canvas context state
    ctx.save();

    // Set joystick position to bottom left of screen
    joystickBase.x = 80;
    joystickBase.y = window.innerHeight - 80;

    // Draw joystick base (always visible on mobile)
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
    ctx.fillStyle = 'rgba(0, 50, 0, 0.6)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(joystickBase.x, joystickBase.y, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw directional indicators
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    // Top
    ctx.beginPath();
    ctx.moveTo(joystickBase.x, joystickBase.y - 35);
    ctx.lineTo(joystickBase.x, joystickBase.y - 25);
    ctx.stroke();
    // Bottom
    ctx.beginPath();
    ctx.moveTo(joystickBase.x, joystickBase.y + 35);
    ctx.lineTo(joystickBase.x, joystickBase.y + 25);
    ctx.stroke();
    // Left
    ctx.beginPath();
    ctx.moveTo(joystickBase.x - 35, joystickBase.y);
    ctx.lineTo(joystickBase.x - 25, joystickBase.y);
    ctx.stroke();
    // Right
    ctx.beginPath();
    ctx.moveTo(joystickBase.x + 35, joystickBase.y);
    ctx.lineTo(joystickBase.x + 25, joystickBase.y);
    ctx.stroke();

    // Draw joystick knob
    if (joystickActive || joystickVisible) {
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(joystickKnob.x, joystickKnob.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    } else {
        // Default knob position - more visible
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(joystickBase.x, joystickBase.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    // Draw weapon switch button (bottom right)
    const weaponButtonX = window.innerWidth - 80;
    const weaponButtonY = window.innerHeight - 80;

    ctx.globalAlpha = 0.7;
    ctx.fillStyle = 'rgba(100, 0, 100, 0.6)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(weaponButtonX, weaponButtonY, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw weapon icon
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SW', weaponButtonX, weaponButtonY + 5);

    // Draw reload button (right side, middle)
    const reloadButtonX = window.innerWidth - 50;
    const reloadButtonY = window.innerHeight / 2;

    ctx.globalAlpha = 0.7;
    ctx.fillStyle = 'rgba(100, 100, 0, 0.6)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(reloadButtonX, reloadButtonY, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw reload icon
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('R', reloadButtonX, reloadButtonY + 5);

    // Restore canvas context state
    ctx.restore();
}

// Mobile UI setup
function setupMobileUI() {
    // Update control instructions based on device type
    const desktopControls = document.getElementById('desktopControls');
    const mobileControls = document.getElementById('mobileControls');

    if (deviceType === 'mobile') {
        desktopControls.style.display = 'none';
        mobileControls.style.display = 'block';

        // Adjust canvas size for mobile
        canvas.width = Math.min(800, window.innerWidth - 20);
        canvas.height = Math.min(600, window.innerHeight * 0.7);

        // Initialize joystick positions
        joystickBase.x = 80;
        joystickBase.y = window.innerHeight - 80;
        joystickKnob.x = joystickBase.x;
        joystickKnob.y = joystickBase.y;

    } else if (deviceType === 'tablet') {
        desktopControls.textContent = 'Move: WASD or Arrow Keys | Shoot: Click or Tap | Reload: R | Switch Weapon: Q';
        mobileControls.style.display = 'none';
    } else {
        // Desktop/Laptop
        desktopControls.textContent = 'Move: WASD or Arrow Keys | Shoot: Click | Reload: R | Switch Weapon: Q';
        mobileControls.style.display = 'none';
    }

    // Reset player position
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
}



// Window resize handler
window.addEventListener('resize', () => {
    if (deviceType === 'mobile') {
        canvas.width = Math.min(800, window.innerWidth - 20);
        canvas.height = Math.min(600, window.innerHeight * 0.7);
        player.x = canvas.width / 2;
        player.y = canvas.height / 2;

        // Update joystick position
        joystickBase.x = 80;
        joystickBase.y = window.innerHeight - 80;
        if (!joystickActive) {
            joystickKnob.x = joystickBase.x;
            joystickKnob.y = joystickBase.y;
        }
    }
});

// Start the game
setupMobileUI();
gameLoop();