// Device detection - initialize first before anything else
const deviceType = (function detectDevice() {
    const userAgent = navigator.userAgent.toLowerCase();
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (isTouchDevice && /android|iphone|ipad|ipod|mobile/i.test(userAgent)) {
        return 'mobile';
    } else if (isTouchDevice && /tablet|ipad/i.test(userAgent)) {
        return 'tablet';
    } else {
        return 'desktop';
    }
})();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set proper canvas size based on device
function setCanvasSize() {
    if (deviceType === 'mobile') {
        canvas.width = Math.min(1200, window.innerWidth);
        canvas.height = Math.min(800, window.innerHeight * 0.85);
    } else {
        canvas.width = 1200;
        canvas.height = 800;
    }
}

// Initialize canvas size
setCanvasSize();

// Game state
let gameRunning = true;
let gameTime = 0;
let isDayTime = true;
let player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 15,
    health: 100,
    maxHealth: 100,
    speed: 3,
    weapon: 'pistol',
    meleeWeapon: 'knife',
    experience: 0,
    level: 1,
    stamina: 100,
    maxStamina: 100,
    hunger: 100,
    thirst: 100,
    skills: {
        marksmanship: 0,
        athletics: 0,
        survival: 0
    },
    killStreak: 0,
    lastMeleeAttack: 0
};

// Enhanced weapon system with realistic calibers
const weapons = {
    pistol: {
        damage: 25, fireRate: 300, ammo: 15, maxAmmo: 15, spread: 0.05, bulletSpeed: 8,
        color: '#ffff00', caliber: '9mm Parabellum', width: 20, height: 12,
        name: 'Glock 17', recoil: 0.1, range: 250, durability: 100, maxDurability: 100
    },
    shotgun: {
        damage: 60, fireRate: 800, ammo: 8, maxAmmo: 8, spread: 0.4, bulletSpeed: 6,
        color: '#ff6600', caliber: '12 Gauge', width: 35, height: 8,
        name: 'Remington 870', recoil: 0.3, range: 150, durability: 100, maxDurability: 100
    },
    rifle: {
        damage: 45, fireRate: 150, ammo: 30, maxAmmo: 30, spread: 0.02, bulletSpeed: 12,
        color: '#00ffff', caliber: '5.56x45mm NATO', width: 40, height: 6,
        name: 'M4A1', recoil: 0.15, range: 400, durability: 100, maxDurability: 100
    },
    sniper: {
        damage: 100, fireRate: 1200, ammo: 10, maxAmmo: 10, spread: 0.01, bulletSpeed: 15,
        color: '#ff00ff', caliber: '.308 Winchester', width: 50, height: 8,
        name: 'M24 SWS', recoil: 0.4, range: 600, durability: 100, maxDurability: 100
    },
    machinegun: {
        damage: 35, fireRate: 80, ammo: 100, maxAmmo: 100, spread: 0.2, bulletSpeed: 10,
        color: '#ff0066', caliber: '7.62x51mm NATO', width: 45, height: 10,
        name: 'M249 SAW', recoil: 0.2, range: 350, durability: 100, maxDurability: 100
    }
};

// Melee weapons system
const meleeWeapons = {
    knife: {
        damage: 40, range: 25, attackSpeed: 200, durability: 80, maxDurability: 80,
        name: 'Combat Knife', color: '#C0C0C0', critChance: 0.15
    },
    bat: {
        damage: 60, range: 35, attackSpeed: 400, durability: 60, maxDurability: 60,
        name: 'Baseball Bat', color: '#8B4513', critChance: 0.1
    },
    katana: {
        damage: 80, range: 40, attackSpeed: 300, durability: 50, maxDurability: 50,
        name: 'Katana', color: '#FFD700', critChance: 0.25
    },
    axe: {
        damage: 75, range: 30, attackSpeed: 500, durability: 70, maxDurability: 70,
        name: 'Fire Axe', color: '#8B0000', critChance: 0.2
    }
};

let zombies = [];
let bullets = [];
let particles = [];
let powerUps = [];
let explosions = [];
let traps = [];
let environmentObjects = [];
let score = 0;
let wave = 1;
let ammo = weapons[player.weapon].ammo;
let maxAmmo = weapons[player.weapon].maxAmmo;
let zombiesKilled = 0;
let zombiesPerWave = 5;
let lastShot = 0;
let bossSpawned = false;
let achievementsUnlocked = [];
let weather = 'clear';
let temperature = 70;

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

// Event listeners
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'r') {
        reload();
    }
    if (e.key.toLowerCase() === 'q') {
        switchWeapon();
    }
    if (e.key.toLowerCase() === 'e') {
        switchMeleeWeapon();
    }
    if (e.key.toLowerCase() === 'f') {
        meleeAttack();
    }
    if (e.key.toLowerCase() === 'g') {
        throwGrenade();
    }
    if (e.key.toLowerCase() === 'b') {
        placeTrap();
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

// Mobile touch controls - single handler to prevent conflicts
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();

    for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        const canvasX = touch.clientX - rect.left;
        const canvasY = touch.clientY - rect.top;
        const id = touch.identifier;

        // Check if touch is in joystick area (bottom left of canvas)
        const joystickDistance = Math.hypot(canvasX - 80, canvasY - (canvas.height - 80));
        
        // Button positions relative to canvas (updated positions and sizes)
        const weaponButtonX = canvas.width - 60;
        const weaponButtonY = canvas.height - 60;
        const weaponButtonDistance = Math.hypot(canvasX - weaponButtonX, canvasY - weaponButtonY);
        
        const reloadButtonX = canvas.width - 40;
        const reloadButtonY = canvas.height / 2;
        const reloadButtonDistance = Math.hypot(canvasX - reloadButtonX, canvasY - reloadButtonY);
        
        const meleeButtonX = canvas.width - 60;
        const meleeButtonY = 60;
        const meleeButtonDistance = Math.hypot(canvasX - meleeButtonX, canvasY - meleeButtonY);
        
        const grenadeButtonX = 40;
        const grenadeButtonY = canvas.height / 2;
        const grenadeButtonDistance = Math.hypot(canvasX - grenadeButtonX, canvasY - grenadeButtonY);

        const trapButtonX = 60;
        const trapButtonY = canvas.height - 140;
        const trapButtonDistance = Math.hypot(canvasX - trapButtonX, canvasY - trapButtonY);

        if (joystickDistance <= 60) {
            // Joystick area
            touchIdentifiers.set(id, 'joystick');
            joystickActive = true;
            joystickVisible = true;
            joystickKnob.x = canvasX;
            joystickKnob.y = canvasY;
        } else if (weaponButtonDistance <= 35) {
            switchWeapon();
            return;
        } else if (reloadButtonDistance <= 25) {
            reload();
            return;
        } else if (meleeButtonDistance <= 35) {
            meleeAttack();
            return;
        } else if (grenadeButtonDistance <= 25) {
            throwGrenade();
            return;
        } else if (trapButtonDistance <= 25) {
            placeTrap();
            return;
        } else {
            // Canvas touch - aiming and shooting
            touchIdentifiers.set(id, 'canvas');
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
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();

    for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        const canvasX = touch.clientX - rect.left;
        const canvasY = touch.clientY - rect.top;
        const id = touch.identifier;
        const touchType = touchIdentifiers.get(id);

        if (touchType === 'canvas') {
            // Update aim position
            mousePos.x = canvasX;
            mousePos.y = canvasY;
        } else if (touchType === 'joystick') {
            // Movement joystick - constrain to joystick area
            const canvasJoystickBaseX = 80;
            const canvasJoystickBaseY = canvas.height - 80;
            
            const deltaX = canvasX - canvasJoystickBaseX;
            const deltaY = canvasY - canvasJoystickBaseY;
            const distance = Math.hypot(deltaX, deltaY);
            const maxDistance = 50;

            if (distance <= maxDistance) {
                joystickKnob.x = canvasX;
                joystickKnob.y = canvasY;
            } else {
                // Constrain to circle boundary
                const angle = Math.atan2(deltaY, deltaX);
                joystickKnob.x = canvasJoystickBaseX + Math.cos(angle) * maxDistance;
                joystickKnob.y = canvasJoystickBaseY + Math.sin(angle) * maxDistance;
            }
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const id = touch.identifier;
        const touchType = touchIdentifiers.get(id);

        if (touchType === 'joystick') {
            joystickActive = false;
            joystickVisible = false;
            joystickKnob.x = 80;
            joystickKnob.y = canvas.height - 80;
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
}, { passive: false });



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
            x: x, y: y, radius: 25, health: 15 + wave, maxHealth: 15 + wave,
            speed: 0.3 + wave * 0.05, color: '#8B0000', type: 'boss',
            lastAttack: 0, armor: 3, regeneration: 0.1
        });
        bossSpawned = true;
    } else {
        // Enhanced zombie variety
        const zombieType = Math.random();
        if (zombieType < 0.4) {
            // Normal zombie
            zombies.push({
                x: x, y: y, radius: 12, health: 2 + Math.floor(wave / 3),
                speed: 0.5 + wave * 0.1, color: `hsl(${Math.random() * 60}, 70%, 30%)`,
                type: 'normal', armor: 0
            });
        } else if (zombieType < 0.6) {
            // Fast zombie (Runner)
            zombies.push({
                x: x, y: y, radius: 10, health: 1, speed: 1.8 + wave * 0.15,
                color: '#ff4444', type: 'runner', armor: 0
            });
        } else if (zombieType < 0.75) {
            // Tank zombie
            zombies.push({
                x: x, y: y, radius: 18, health: 5 + Math.floor(wave / 2),
                speed: 0.3 + wave * 0.05, color: '#444444', type: 'tank', armor: 2
            });
        } else if (zombieType < 0.85) {
            // Spitter zombie (ranged acid)
            zombies.push({
                x: x, y: y, radius: 11, health: 3, speed: 0.4 + wave * 0.08,
                color: '#90EE90', type: 'spitter', lastSpit: 0, armor: 0
            });
        } else if (zombieType < 0.93) {
            // Crawler zombie (low profile, fast)
            zombies.push({
                x: x, y: y, radius: 8, health: 2, speed: 1.0 + wave * 0.12,
                color: '#8B4513', type: 'crawler', armor: 0
            });
        } else if (zombieType < 0.98) {
            // Bloater zombie (explodes on death)
            zombies.push({
                x: x, y: y, radius: 16, health: 4 + Math.floor(wave / 3),
                speed: 0.2 + wave * 0.05, color: '#9ACD32', type: 'bloater', armor: 1
            });
        } else {
            // Mutant zombie (evolves over time)
            zombies.push({
                x: x, y: y, radius: 14, health: 4, speed: 0.6 + wave * 0.1,
                color: '#FF69B4', type: 'mutant', mutationLevel: 0, lastMutation: Date.now(), armor: 0
            });
        }
    }
}

function spawnPowerUp(x, y) {
    const powerUpTypes = ['health', 'ammo', 'weapon', 'speed', 'damage', 'food', 'water', 'grenade', 'trap', 'medkit'];
    const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];

    powerUps.push({
        x: x, y: y, radius: 8, type: type, life: 600,
        color: type === 'health' ? '#00ff00' : type === 'ammo' ? '#ffff00' :
               type === 'weapon' ? '#ff00ff' : type === 'speed' ? '#00ffff' :
               type === 'damage' ? '#ff0000' : type === 'food' ? '#FFA500' :
               type === 'water' ? '#87CEEB' : type === 'grenade' ? '#696969' :
               type === 'trap' ? '#8B4513' : '#FF1493'
    });
}

function meleeAttack() {
    const currentMelee = meleeWeapons[player.meleeWeapon];
    const now = Date.now();
    
    if (now - player.lastMeleeAttack < currentMelee.attackSpeed || player.stamina < 15) return;
    
    player.lastMeleeAttack = now;
    player.stamina -= 15;
    
    // Damage weapons with use
    currentMelee.durability = Math.max(0, currentMelee.durability - 0.5);
    
    // Check for zombies in melee range
    zombies.forEach((zombie, index) => {
        const dist = Math.hypot(player.x - zombie.x, player.y - zombie.y);
        if (dist < player.radius + currentMelee.range) {
            let damage = currentMelee.damage;
            
            // Critical hit chance
            if (Math.random() < currentMelee.critChance) {
                damage *= 2;
                // Critical hit effect
                for (let i = 0; i < 10; i++) {
                    particles.push({
                        x: zombie.x, y: zombie.y,
                        dx: (Math.random() - 0.5) * 8,
                        dy: (Math.random() - 0.5) * 8,
                        life: 25, color: '#FFD700'
                    });
                }
            }
            
            zombie.health -= damage;
            createBloodSplash(zombie.x, zombie.y);
            
            // Melee attack effect
            for (let i = 0; i < 5; i++) {
                particles.push({
                    x: zombie.x, y: zombie.y,
                    dx: (Math.random() - 0.5) * 6,
                    dy: (Math.random() - 0.5) * 6,
                    life: 15, color: currentMelee.color
                });
            }
        }
    });
}

function switchMeleeWeapon() {
    const meleeNames = Object.keys(meleeWeapons);
    const currentIndex = meleeNames.indexOf(player.meleeWeapon);
    const nextIndex = (currentIndex + 1) % meleeNames.length;
    player.meleeWeapon = meleeNames[nextIndex];
}

function throwGrenade() {
    if (player.grenades <= 0 || player.stamina < 25) return;
    
    player.grenades--;
    player.stamina -= 25;
    
    const angle = Math.atan2(mousePos.y - player.y, mousePos.x - player.x);
    const grenadeSpeed = 8;
    
    explosions.push({
        x: player.x + Math.cos(angle) * grenadeSpeed * 30,
        y: player.y + Math.sin(angle) * grenadeSpeed * 30,
        radius: 0, maxRadius: 80, life: 30, damage: 80,
        type: 'grenade', timer: 90 // 1.5 seconds delay
    });
}

function placeTrap() {
    if (player.traps <= 0 || player.stamina < 20) return;
    
    player.traps--;
    player.stamina -= 20;
    
    traps.push({
        x: player.x, y: player.y, radius: 15, damage: 50,
        armed: false, armTimer: 60, life: 1800, // 30 seconds
        color: '#8B4513', triggered: false
    });
}

function updateSurvivalStats() {
    // Hunger and thirst decay
    player.hunger = Math.max(0, player.hunger - 0.02);
    player.thirst = Math.max(0, player.thirst - 0.03);
    
    // Stamina regeneration
    if (player.stamina < player.maxStamina) {
        let regenRate = 0.5;
        if (player.hunger < 30) regenRate *= 0.5;
        if (player.thirst < 20) regenRate *= 0.3;
        player.stamina = Math.min(player.maxStamina, player.stamina + regenRate);
    }
    
    // Health effects from hunger/thirst
    if (player.hunger <= 0 || player.thirst <= 0) {
        player.health -= 0.1;
    }
    
    // Temperature effects
    if (temperature < 32 || temperature > 100) {
        player.health -= 0.05;
        player.stamina -= 0.2;
    }
}

function updateWeather() {
    gameTime++;
    
    // Day/night cycle (10 minutes = 600 seconds = 36000 frames at 60fps)
    isDayTime = (gameTime % 36000) < 18000;
    
    // Weather changes
    if (Math.random() < 0.001) { // Very rare weather change
        const weatherTypes = ['clear', 'rain', 'snow', 'fog'];
        weather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
        
        // Temperature adjustments
        if (weather === 'snow') temperature = Math.max(20, temperature - 30);
        if (weather === 'rain') temperature = Math.max(40, temperature - 15);
    }
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
            Object.values(weapons).forEach(weapon => weapon.damage += 1);
            setTimeout(() => {
                Object.values(weapons).forEach(weapon => weapon.damage = Math.max(1, weapon.damage - 1));
            }, 10000);
            break;
        case 'food':
            player.hunger = Math.min(100, player.hunger + 40);
            break;
        case 'water':
            player.thirst = Math.min(100, player.thirst + 50);
            break;
        case 'grenade':
            player.grenades = (player.grenades || 0) + 2;
            break;
        case 'trap':
            player.traps = (player.traps || 0) + 3;
            break;
        case 'medkit':
            player.health = player.maxHealth;
            player.hunger = Math.min(100, player.hunger + 20);
            player.thirst = Math.min(100, player.thirst + 20);
            break;
    }

    // Power-up collection effect
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: powerUp.x, y: powerUp.y,
            dx: (Math.random() - 0.5) * 8,
            dy: (Math.random() - 0.5) * 8,
            life: 30, color: powerUp.color
        });
    }
    
    // Skill progression
    player.skills.survival += 1;
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
        const canvasJoystickBaseX = 80;
        const canvasJoystickBaseY = canvas.height - 80;
        
        const deltaX = joystickKnob.x - canvasJoystickBaseX;
        const deltaY = joystickKnob.y - canvasJoystickBaseY;
        const distance = Math.hypot(deltaX, deltaY);

        if (distance > 5) {
            const normalizedX = deltaX / distance;
            const normalizedY = deltaY / distance;
            const intensity = Math.min(distance / 50, 1);

            const moveX = normalizedX * player.speed * intensity;
            const moveY = normalizedY * player.speed * intensity;

            // Apply movement with bounds checking
            const newX = player.x + moveX;
            const newY = player.y + moveY;
            
            if (newX >= player.radius && newX <= canvas.width - player.radius) {
                player.x = newX;
            }
            if (newY >= player.radius && newY <= canvas.height - player.radius) {
                player.y = newY;
            }
        }
    }
}

function updateZombies() {
    zombies.forEach((zombie, zombieIndex) => {
        // Special zombie behaviors
        if (zombie.type === 'spitter') {
            const now = Date.now();
            const distToPlayer = Math.hypot(player.x - zombie.x, player.y - zombie.y);
            
            if (distToPlayer > 150 && distToPlayer < 300 && now - zombie.lastSpit > 2000) {
                zombie.lastSpit = now;
                // Spit acid at player
                const angle = Math.atan2(player.y - zombie.y, player.x - zombie.x);
                bullets.push({
                    x: zombie.x, y: zombie.y,
                    dx: Math.cos(angle) * 4, dy: Math.sin(angle) * 4,
                    radius: 4, damage: 15, color: '#90EE90',
                    isAcid: true, life: 100
                });
            }
            // Keep distance from player
            if (distToPlayer < 100) {
                const angle = Math.atan2(zombie.y - player.y, zombie.x - player.x);
                zombie.x += Math.cos(angle) * zombie.speed * 0.5;
                zombie.y += Math.sin(angle) * zombie.speed * 0.5;
            }
        } else if (zombie.type === 'mutant') {
            // Mutation progression
            if (Date.now() - zombie.lastMutation > 10000 && zombie.mutationLevel < 3) {
                zombie.mutationLevel++;
                zombie.lastMutation = Date.now();
                zombie.health += 2;
                zombie.damage = (zombie.damage || 2) + 1;
                zombie.speed += 0.1;
                zombie.radius += 1;
            }
        }
        
        // Standard movement for most zombies
        if (zombie.type !== 'spitter' || Math.hypot(player.x - zombie.x, player.y - zombie.y) < 150) {
            const angle = Math.atan2(player.y - zombie.y, player.x - zombie.x);
            let moveSpeed = zombie.speed;
            
            // Weather effects
            if (weather === 'snow') moveSpeed *= 0.7;
            if (weather === 'rain') moveSpeed *= 0.9;
            if (!isDayTime) moveSpeed *= 1.2; // Zombies faster at night
            
            zombie.x += Math.cos(angle) * moveSpeed;
            zombie.y += Math.sin(angle) * moveSpeed;
        }

        // Boss special attacks
        if (zombie.type === 'boss') {
            const now = Date.now();
            if (now - zombie.lastAttack > 3000) {
                zombie.lastAttack = now;
                const chargeAngle = Math.atan2(player.y - zombie.y, player.x - zombie.x);
                zombie.x += Math.cos(chargeAngle) * 50;
                zombie.y += Math.sin(chargeAngle) * 50;

                explosions.push({
                    x: zombie.x, y: zombie.y, radius: 0, maxRadius: 60,
                    life: 20, damage: 5
                });
            }
            
            // Boss regeneration
            if (zombie.regeneration && zombie.health < zombie.maxHealth) {
                zombie.health = Math.min(zombie.maxHealth, zombie.health + zombie.regeneration);
            }
        }

        // Check collision with player
        const dist = Math.hypot(player.x - zombie.x, player.y - zombie.y);
        if (dist < player.radius + zombie.radius) {
            let damage = zombie.type === 'boss' ? 8 :
                        zombie.type === 'tank' ? 4 :
                        zombie.type === 'runner' ? 1 :
                        zombie.type === 'bloater' ? 6 :
                        zombie.type === 'crawler' ? 2 :
                        zombie.type === 'spitter' ? 3 :
                        zombie.type === 'mutant' ? (2 + zombie.mutationLevel) : 2;
                        
            // Apply armor reduction
            damage = Math.max(1, damage - (player.skills.survival * 0.1));
            
            player.health -= damage;
            player.stamina -= damage * 2;
            createBloodSplash(player.x, player.y);

            // Bloater explosion on contact
            if (zombie.type === 'bloater') {
                explosions.push({
                    x: zombie.x, y: zombie.y, radius: 0, maxRadius: 50,
                    life: 15, damage: 25
                });
                zombies.splice(zombieIndex, 1);
                return;
            }

            if (player.health <= 0) {
                gameOver();
                return;
            }
        }
        
        // Check trap collisions
        traps.forEach((trap, trapIndex) => {
            if (trap.armed && !trap.triggered) {
                const trapDist = Math.hypot(zombie.x - trap.x, zombie.y - trap.y);
                if (trapDist < zombie.radius + trap.radius) {
                    trap.triggered = true;
                    zombie.health -= trap.damage;
                    explosions.push({
                        x: trap.x, y: trap.y, radius: 0, maxRadius: 30,
                        life: 10, damage: 0
                    });
                    traps.splice(trapIndex, 1);
                    createBloodSplash(zombie.x, zombie.y);
                }
            }
        });
    });
}

function updateBullets() {
    bullets.forEach((bullet, bulletIndex) => {
        bullet.x += bullet.dx;
        bullet.y += bullet.dy;
        
        // Bullet lifetime for acid spit
        if (bullet.life !== undefined) {
            bullet.life--;
            if (bullet.life <= 0) {
                bullets.splice(bulletIndex, 1);
                return;
            }
        }

        // Remove bullets that go off screen
        if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
            bullets.splice(bulletIndex, 1);
            return;
        }

        // Acid bullets damage player
        if (bullet.isAcid) {
            const distToPlayer = Math.hypot(bullet.x - player.x, bullet.y - player.y);
            if (distToPlayer < bullet.radius + player.radius) {
                player.health -= bullet.damage;
                bullets.splice(bulletIndex, 1);
                createBloodSplash(player.x, player.y);
                return;
            }
        } else {
            // Check collision with zombies (player bullets)
            zombies.forEach((zombie, zombieIndex) => {
                const dist = Math.hypot(bullet.x - zombie.x, bullet.y - zombie.y);
                if (dist < bullet.radius + zombie.radius) {
                    let damage = bullet.damage;
                    
                    // Apply armor reduction
                    damage = Math.max(1, damage - (zombie.armor || 0));
                    
                    zombie.health -= damage;
                    bullets.splice(bulletIndex, 1);
                    createBloodSplash(zombie.x, zombie.y);
                    
                    // Skill progression
                    player.skills.marksmanship += 0.1;

                    if (zombie.health <= 0) {
                        const points = zombie.type === 'boss' ? 100 :
                                      zombie.type === 'tank' ? 25 :
                                      zombie.type === 'runner' ? 15 :
                                      zombie.type === 'spitter' ? 20 :
                                      zombie.type === 'crawler' ? 12 :
                                      zombie.type === 'bloater' ? 30 :
                                      zombie.type === 'mutant' ? (15 + zombie.mutationLevel * 5) : 10;
                        score += points;
                        player.experience += points / 10;
                        player.killStreak++;

                        // Bloater explosion
                        if (zombie.type === 'bloater') {
                            explosions.push({
                                x: zombie.x, y: zombie.y, radius: 0, maxRadius: 60,
                                life: 20, damage: 40
                            });
                        }

                        // Chance to drop power-up (higher chance for special zombies)
                        const dropChance = zombie.type === 'boss' ? 0.8 :
                                          zombie.type === 'bloater' ? 0.4 :
                                          zombie.type === 'mutant' ? 0.3 : 0.15;
                        if (Math.random() < dropChance) {
                            spawnPowerUp(zombie.x, zombie.y);
                        }

                        // Boss death explosion
                        if (zombie.type === 'boss') {
                            for (let i = 0; i < 5; i++) {
                                explosions.push({
                                    x: zombie.x + (Math.random() - 0.5) * 60,
                                    y: zombie.y + (Math.random() - 0.5) * 60,
                                    radius: 0, maxRadius: 40, life: 25, damage: 0
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
                            player.stamina = player.maxStamina;
                            ammo = weapons[player.weapon].maxAmmo;
                            maxAmmo = weapons[player.weapon].maxAmmo;
                            bossSpawned = false;
                            
                            // Wave completion rewards
                            player.grenades = (player.grenades || 0) + 1;
                            player.traps = (player.traps || 0) + 2;
                        }

                        // Level up system
                        if (player.experience >= player.level * 50) {
                            player.level++;
                            player.maxHealth += 10;
                            player.health = player.maxHealth;
                            player.maxStamina += 10;
                            player.stamina = player.maxStamina;
                            player.speed += 0.05;
                            
                            // Skill points
                            if (player.level % 3 === 0) {
                                player.skills.athletics += 1;
                            }
                        }
                    }
                }
            });
        }
    });
}

function updateTraps() {
    traps.forEach((trap, index) => {
        trap.life--;
        
        // Arm trap after delay
        if (!trap.armed && trap.armTimer > 0) {
            trap.armTimer--;
            if (trap.armTimer <= 0) {
                trap.armed = true;
            }
        }
        
        // Remove expired traps
        if (trap.life <= 0) {
            traps.splice(index, 1);
        }
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
    // Dynamic background based on time and weather
    let bgColor = isDayTime ? '#0d4f3c' : '#1a1a2e';
    if (weather === 'snow') bgColor = isDayTime ? '#e6f3ff' : '#2d3436';
    if (weather === 'rain') bgColor = isDayTime ? '#2d3436' : '#0d1421';
    
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Weather effects
    if (weather === 'rain') {
        ctx.strokeStyle = 'rgba(173, 216, 230, 0.6)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * canvas.width;
            const y = (gameTime * 5 + i * 12) % canvas.height;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 2, y + 10);
            ctx.stroke();
        }
    }
    
    if (weather === 'snow') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (let i = 0; i < 30; i++) {
            const x = (Math.sin(gameTime * 0.01 + i) * 20 + gameTime * 0.5 + i * 15) % canvas.width;
            const y = (gameTime * 2 + i * 20) % canvas.height;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    if (weather === 'fog') {
        ctx.fillStyle = 'rgba(169, 169, 169, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Grid pattern (dimmer at night)
    const gridAlpha = isDayTime ? 0.1 : 0.05;
    ctx.strokeStyle = `rgba(0, 255, 0, ${gridAlpha})`;
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

    // Draw player with stamina-based effects
    let playerColor = '#00ff00';
    if (player.stamina < 30) playerColor = '#ffaa00';
    if (player.health < 30) playerColor = '#ff6600';
    
    ctx.fillStyle = playerColor;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw player body details
    ctx.fillStyle = '#004400';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius * 0.7, 0, Math.PI * 2);
    ctx.fill();
    
    // Night vision effect
    if (!isDayTime) {
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

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

    // Draw melee weapon on back/side
    const meleeAngle = angle + Math.PI / 2;
    const currentMelee = meleeWeapons[player.meleeWeapon];
    
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(meleeAngle);
    
    ctx.strokeStyle = currentMelee.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    switch(player.meleeWeapon) {
        case 'knife':
            ctx.moveTo(-15, 0);
            ctx.lineTo(-25, 0);
            ctx.moveTo(-25, 0);
            ctx.lineTo(-27, -2);
            ctx.moveTo(-25, 0);
            ctx.lineTo(-27, 2);
            break;
        case 'bat':
            ctx.moveTo(-15, 0);
            ctx.lineTo(-35, 0);
            ctx.arc(-35, 0, 3, 0, Math.PI * 2);
            break;
        case 'katana':
            ctx.moveTo(-15, 0);
            ctx.lineTo(-40, 0);
            ctx.moveTo(-40, 0);
            ctx.lineTo(-42, -1);
            break;
        case 'axe':
            ctx.moveTo(-15, 0);
            ctx.lineTo(-30, 0);
            ctx.moveTo(-30, -3);
            ctx.lineTo(-35, 0);
            ctx.lineTo(-30, 3);
            break;
    }
    
    ctx.stroke();
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
    const healthBarHeight = 4;
    const healthPercent = player.health / player.maxHealth;

    ctx.fillStyle = '#ff0000';
    ctx.fillRect(player.x - healthBarWidth/2, player.y - player.radius - 20, healthBarWidth, healthBarHeight);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(player.x - healthBarWidth/2, player.y - player.radius - 20, healthBarWidth * healthPercent, healthBarHeight);

    // Draw stamina bar
    const staminaPercent = player.stamina / player.maxStamina;
    ctx.fillStyle = '#666666';
    ctx.fillRect(player.x - healthBarWidth/2, player.y - player.radius - 15, healthBarWidth, healthBarHeight);
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(player.x - healthBarWidth/2, player.y - player.radius - 15, healthBarWidth * staminaPercent, healthBarHeight);

    // Draw hunger/thirst indicators (small dots)
    if (player.hunger < 50) {
        ctx.fillStyle = '#FFA500';
        ctx.beginPath();
        ctx.arc(player.x - 15, player.y - player.radius - 25, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    if (player.thirst < 50) {
        ctx.fillStyle = '#87CEEB';
        ctx.beginPath();
        ctx.arc(player.x + 15, player.y - player.radius - 25, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw traps
    traps.forEach(trap => {
        if (trap.armed && !trap.triggered) {
            ctx.fillStyle = 'rgba(139, 69, 19, 0.7)';
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(trap.x, trap.y, trap.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Danger indicator
            ctx.fillStyle = '#ff0000';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('!', trap.x, trap.y - trap.radius - 5);
        } else if (!trap.armed) {
            // Unarmed trap (visible to player)
            ctx.strokeStyle = 'rgba(139, 69, 19, 0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(trap.x, trap.y, trap.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    });

    // Draw zombies
    zombies.forEach(zombie => {
        ctx.fillStyle = zombie.color;
        ctx.beginPath();
        ctx.arc(zombie.x, zombie.y, zombie.radius, 0, Math.PI * 2);
        ctx.fill();

        // Special zombie effects
        if (zombie.type === 'boss') {
            ctx.shadowColor = '#8B0000';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(zombie.x, zombie.y, zombie.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (zombie.type === 'spitter') {
            ctx.shadowColor = '#90EE90';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(zombie.x, zombie.y, zombie.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (zombie.type === 'mutant' && zombie.mutationLevel > 0) {
            ctx.shadowColor = '#FF69B4';
            ctx.shadowBlur = 5 + zombie.mutationLevel * 3;
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

        // Special zombie indicators
        if (zombie.type === 'tank' && zombie.armor > 0) {
            ctx.strokeStyle = '#444444';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(zombie.x, zombie.y, zombie.radius + 2, 0, Math.PI * 2);
            ctx.stroke();
        }

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
    document.getElementById('health').textContent = Math.max(0, Math.floor(player.health));
    document.getElementById('score').textContent = score;
    document.getElementById('ammo').textContent = `${ammo}/${maxAmmo}`;
    document.getElementById('wave').textContent = wave;

    // Create or update additional UI elements
    const statsDiv = document.getElementById('stats');
    
    const elements = [
        { id: 'weapon', content: weapons[player.weapon].name },
        { id: 'melee', content: `Melee: ${meleeWeapons[player.meleeWeapon].name}` },
        { id: 'level', content: `Level: ${player.level}` },
        { id: 'stamina', content: `Stamina: ${Math.floor(player.stamina)}/100` },
        { id: 'hunger', content: `Hunger: ${Math.floor(player.hunger)}/100` },
        { id: 'thirst', content: `Thirst: ${Math.floor(player.thirst)}/100` },
        { id: 'grenades', content: `Grenades: ${player.grenades || 0}` },
        { id: 'traps', content: `Traps: ${player.traps || 0}` },
        { id: 'killstreak', content: `Kill Streak: ${player.killStreak}` },
        { id: 'weather', content: `${weather.charAt(0).toUpperCase() + weather.slice(1)} ${isDayTime ? '☀️' : '🌙'}` },
        { id: 'skills', content: `Skills: M${Math.floor(player.skills.marksmanship)} A${Math.floor(player.skills.athletics)} S${Math.floor(player.skills.survival)}` }
    ];
    
    elements.forEach(element => {
        let existing = document.getElementById(element.id);
        if (!existing) {
            existing = document.createElement('div');
            existing.id = element.id;
            statsDiv.appendChild(existing);
        }
        existing.textContent = element.content;
        
        // Color coding for survival stats
        if (element.id === 'hunger' && player.hunger < 30) existing.style.color = '#ff6666';
        else if (element.id === 'thirst' && player.thirst < 30) existing.style.color = '#ff6666';
        else if (element.id === 'stamina' && player.stamina < 30) existing.style.color = '#ffaa66';
        else existing.style.color = '#00ff00';
    });
}

let gameIntervals = [];

function clearAllIntervals() {
    gameIntervals.forEach(interval => clearInterval(interval));
    gameIntervals.length = 0;
}

function gameOver() {
    if (!gameRunning) return; // Prevent multiple game over calls
    
    gameRunning = false;
    clearAllIntervals(); // Stop all game intervals
    
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').classList.remove('hidden');
    
    // Clear any remaining animations
    zombies.length = 0;
    bullets.length = 0;
    particles.length = 0;
    explosions.length = 0;
    
    console.log('Game Over - Final Score:', score);
}

function restartGame() {
    console.log('Restarting game...');
    
    // Stop current game immediately
    gameRunning = false;
    clearAllIntervals();
    
    // Clear any existing animation frame
    if (window.gameAnimationId) {
        cancelAnimationFrame(window.gameAnimationId);
    }
    
    // Hide game over screen immediately
    document.getElementById('gameOver').classList.add('hidden');
    
    // Reset canvas size
    setCanvasSize();
    
    // Reset game state completely
    gameTime = 0;
    isDayTime = true;
    weather = 'clear';
    temperature = 70;
    
    // Reset player to initial state
    player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 15,
        health: 100,
        maxHealth: 100,
        speed: 3,
        weapon: 'pistol',
        meleeWeapon: 'knife',
        experience: 0,
        level: 1,
        stamina: 100,
        maxStamina: 100,
        hunger: 100,
        thirst: 100,
        skills: { marksmanship: 0, athletics: 0, survival: 0 },
        killStreak: 0,
        lastMeleeAttack: 0,
        grenades: 2,
        traps: 3
    };

    // Clear and reset all game arrays
    zombies = [];
    bullets = [];
    particles = [];
    powerUps = [];
    explosions = [];
    traps = [];
    environmentObjects = [];
    
    // Reset game variables
    score = 0;
    wave = 1;
    zombiesKilled = 0;
    zombiesPerWave = 5;
    lastShot = 0;
    bossSpawned = false;
    achievementsUnlocked = [];

    // Reset weapon states to original values
    weapons.pistol = {
        damage: 25, fireRate: 300, ammo: 15, maxAmmo: 15, spread: 0.05, bulletSpeed: 8,
        color: '#ffff00', caliber: '9mm Parabellum', width: 20, height: 12,
        name: 'Glock 17', recoil: 0.1, range: 250, durability: 100, maxDurability: 100
    };
    weapons.shotgun = {
        damage: 60, fireRate: 800, ammo: 8, maxAmmo: 8, spread: 0.4, bulletSpeed: 6,
        color: '#ff6600', caliber: '12 Gauge', width: 35, height: 8,
        name: 'Remington 870', recoil: 0.3, range: 150, durability: 100, maxDurability: 100
    };
    weapons.rifle = {
        damage: 45, fireRate: 150, ammo: 30, maxAmmo: 30, spread: 0.02, bulletSpeed: 12,
        color: '#00ffff', caliber: '5.56x45mm NATO', width: 40, height: 6,
        name: 'M4A1', recoil: 0.15, range: 400, durability: 100, maxDurability: 100
    };
    weapons.sniper = {
        damage: 100, fireRate: 1200, ammo: 10, maxAmmo: 10, spread: 0.01, bulletSpeed: 15,
        color: '#ff00ff', caliber: '.308 Winchester', width: 50, height: 8,
        name: 'M24 SWS', recoil: 0.4, range: 600, durability: 100, maxDurability: 100
    };
    weapons.machinegun = {
        damage: 35, fireRate: 80, ammo: 100, maxAmmo: 100, spread: 0.2, bulletSpeed: 10,
        color: '#ff0066', caliber: '7.62x51mm NATO', width: 45, height: 10,
        name: 'M249 SAW', recoil: 0.2, range: 350, durability: 100, maxDurability: 100
    };
    
    // Reset melee weapons
    meleeWeapons.knife = {
        damage: 40, range: 25, attackSpeed: 200, durability: 80, maxDurability: 80,
        name: 'Combat Knife', color: '#C0C0C0', critChance: 0.15
    };
    meleeWeapons.bat = {
        damage: 60, range: 35, attackSpeed: 400, durability: 60, maxDurability: 60,
        name: 'Baseball Bat', color: '#8B4513', critChance: 0.1
    };
    meleeWeapons.katana = {
        damage: 80, range: 40, attackSpeed: 300, durability: 50, maxDurability: 50,
        name: 'Katana', color: '#FFD700', critChance: 0.25
    };
    meleeWeapons.axe = {
        damage: 75, range: 30, attackSpeed: 500, durability: 70, maxDurability: 70,
        name: 'Fire Axe', color: '#8B0000', critChance: 0.2
    };
    
    // Set ammo for current weapon
    ammo = weapons[player.weapon].maxAmmo;
    maxAmmo = weapons[player.weapon].maxAmmo;

    // Reset input states
    keys = {};
    joystickActive = false;
    joystickVisible = false;
    isAiming = false;
    isTouching = false;
    touchIdentifiers.clear();
    
    // Reset mouse position
    mousePos = { x: canvas.width / 2, y: canvas.height / 2 };
    
    // Reset joystick position
    joystickKnob.x = 80;
    joystickKnob.y = canvas.height - 80;
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Start fresh game
    gameRunning = true;
    startZombieSpawning();
    updateUI();
    gameLoop(); // Restart the game loop
    
    console.log('Game restarted successfully - Ready to play!');
}

// Spawn zombies periodically - managed interval
function startZombieSpawning() {
    const spawnInterval = setInterval(() => {
        if (gameRunning && zombies.length < wave * 3 + 5) {
            spawnZombie();
        }
        if (!gameRunning) {
            clearInterval(spawnInterval);
        }
    }, Math.max(500, 2000 / wave));
    gameIntervals.push(spawnInterval);
}

// Start zombie spawning
startZombieSpawning();

function gameLoop() {
    if (!gameRunning) return;

    updatePlayer();
    updateZombies();
    updateBullets();
    updateParticles();
    updatePowerUps();
    updateExplosions();
    updateTraps();
    updateSurvivalStats();
    updateWeather();
    render();
    updateUI();

    window.gameAnimationId = requestAnimationFrame(gameLoop);
}

function drawJoystickOverlay() {
    // Only draw joystick overlay on mobile devices
    if (deviceType !== 'mobile') return;
    
    // Save current canvas context state
    ctx.save();

    // Set joystick position relative to canvas (canvas coordinates, not screen)
    const canvasJoystickBaseX = 80;
    const canvasJoystickBaseY = canvas.height - 80;

    // Draw joystick base (less intrusive, only when active or semi-transparent)
    ctx.globalAlpha = joystickActive ? 0.4 : 0.2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillStyle = 'rgba(0, 50, 0, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(canvasJoystickBaseX, canvasJoystickBaseY, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw joystick knob only when active
    if (joystickActive || joystickVisible) {
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(joystickKnob.x, joystickKnob.y, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    // Only draw essential buttons, smaller and less intrusive
    if (deviceType === 'mobile') {
        // Draw weapon switch button (bottom right) - smaller
        const weaponButtonX = canvas.width - 40;
        const weaponButtonY = canvas.height - 40;

        ctx.globalAlpha = 0.4;
        ctx.fillStyle = 'rgba(100, 0, 100, 0.3)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(weaponButtonX, weaponButtonY, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw weapon icon
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('W', weaponButtonX, weaponButtonY + 3);

        // Draw reload button (right side) - smaller
        const reloadButtonX = canvas.width - 25;
        const reloadButtonY = canvas.height / 2;

        ctx.globalAlpha = 0.4;
        ctx.fillStyle = 'rgba(100, 100, 0, 0.3)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(reloadButtonX, reloadButtonY, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw reload icon
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('R', reloadButtonX, reloadButtonY + 4);
    }

    // Restore canvas context state
    ctx.restore();
}

// Mobile UI setup
function setupMobileUI() {
    // Update control instructions based on device type
    const desktopControls = document.getElementById('desktopControls');
    const mobileControls = document.getElementById('mobileControls');

    console.log('Setting up UI for device type:', deviceType);

    if (deviceType === 'mobile') {
        if (desktopControls) desktopControls.style.display = 'none';
        if (mobileControls) mobileControls.style.display = 'block';

        // Adjust canvas size for mobile - larger size
        canvas.width = Math.min(1200, window.innerWidth);
        canvas.height = Math.min(800, window.innerHeight * 0.85);

        // Initialize joystick positions
        joystickBase.x = 80;
        joystickBase.y = canvas.height - 80;
        joystickKnob.x = joystickBase.x;
        joystickKnob.y = joystickBase.y;

    } else if (deviceType === 'tablet') {
        if (desktopControls) {
            desktopControls.textContent = 'Move: WASD or Arrow Keys | Shoot: Click or Tap | Reload: R | Switch Weapon: Q';
            desktopControls.style.display = 'block';
        }
        if (mobileControls) mobileControls.style.display = 'none';
        canvas.width = 1200;
        canvas.height = 800;
    } else {
        // Desktop/Laptop
        if (desktopControls) {
            desktopControls.textContent = 'Move: WASD or Arrow Keys | Shoot: Click | Reload: R | Switch Weapon: Q';
            desktopControls.style.display = 'block';
        }
        if (mobileControls) mobileControls.style.display = 'none';
        canvas.width = 1200;
        canvas.height = 800;
    }

    // Reset player position
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
}



// Window resize handler
window.addEventListener('resize', () => {
    setCanvasSize();
    if (gameRunning) {
        player.x = Math.min(player.x, canvas.width - player.radius);
        player.y = Math.min(player.y, canvas.height - player.radius);
    }
    
    if (deviceType === 'mobile') {
        // Update joystick position
        joystickBase.x = 80;
        joystickBase.y = canvas.height - 80;
        if (!joystickActive) {
            joystickKnob.x = joystickBase.x;
            joystickKnob.y = joystickBase.y;
        }
    }
});

// Initialize game properly
function initializeGame() {
    setupMobileUI();
    
    // Initialize player starting items
    player.grenades = 2;
    player.traps = 3;
    
    // Start zombie spawning
    startZombieSpawning();
    
    // Start the main game loop
    gameLoop();
    
    console.log('Game initialized successfully');
}

// Start the game
initializeGame();
