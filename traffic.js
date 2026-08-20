/*
 * ===================================================================
 * RADIN RACER 3D — SMART TRAFFIC & AI DRIVERS SYSTEM
 * Zero-Garbage Object Pooling, Spatial Grid, AI Personalities,
 * Distance LOD & Traffic Lights
 * ===================================================================
 */

class TrafficManager {
    constructor(game) {
        this.game = game;
        this.POOL_SIZE = 40; // Max active pre-allocated vehicle pool size
        this.activeVehicles = [];
        this.pooledVehicles = [];

        // Spatial Grid for O(1) Neighbor Lookups (Cell size: 30m along Z-axis)
        this.CELL_SIZE = 30;
        this.spatialGrid = new Map();

        // Traffic Light Nodes (Every 350 meters)
        this.trafficLights = [];
        this.trafficLightTimer = 0;

        // Shared Vehicle Geometries & Materials (Zero Allocation)
        this.sharedGeometries = {};
        this.sharedMaterials = {};

        this.init();
    }

    init() {
        this.createSharedAssets();
        this.initObjectPool();
        this.initTrafficLights();
    }

    createSharedAssets() {
        // Shared Geometries
        this.sharedGeometries.sedanBody = new THREE.BoxGeometry(1.7, 0.75, 3.8);
        this.sharedGeometries.suvBody = new THREE.BoxGeometry(1.95, 0.95, 4.2);
        this.sharedGeometries.sportsBody = new THREE.BoxGeometry(1.85, 0.65, 3.9);
        this.sharedGeometries.truckBody = new THREE.BoxGeometry(2.1, 1.3, 5.0);
        this.sharedGeometries.roof = new THREE.BoxGeometry(1.4, 0.55, 2.0);
        this.sharedGeometries.wheel = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 12);
        this.sharedGeometries.wheel.rotateZ(Math.PI / 2);

        // Shared Materials (Fixed Palette)
        const colors = [0xffffff, 0x111218, 0xcc0022, 0x0088ff, 0xffaa00, 0x555555, 0x002288];
        this.sharedMaterials.carPalette = colors.map(c => new THREE.MeshStandardMaterial({
            color: c, metalness: 0.6, roughness: 0.25
        }));

        this.sharedMaterials.glass = new THREE.MeshStandardMaterial({ color: 0x080a14, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.85 });
        this.sharedMaterials.wheel = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
        this.sharedMaterials.headlight = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.sharedMaterials.taillight = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xaa0000, emissiveIntensity: 1.0 });
        this.sharedMaterials.indicatorOff = new THREE.MeshStandardMaterial({ color: 0x332200, emissive: 0x000000 });
        this.sharedMaterials.indicatorOn = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff8800, emissiveIntensity: 2.0 });

        // Police Siren Lights
        this.sharedMaterials.policeBlue = new THREE.MeshBasicMaterial({ color: 0x0066ff });
        this.sharedMaterials.policeRed = new THREE.MeshBasicMaterial({ color: 0xff0022 });
    }

    initObjectPool() {
        const types = ['SEDAN', 'SUV', 'SPORTS', 'TRUCK', 'TAXI', 'POLICE'];

        for (let i = 0; i < this.POOL_SIZE; i++) {
            const type = types[i % types.length];
            const vehicle = this.buildPooledVehicleMesh(type, i);
            vehicle.visible = false;
            this.pooledVehicles.push(vehicle);
        }
    }

    buildPooledVehicleMesh(type, id) {
        const group = new THREE.Group();
        group.name = `AI_Vehicle_${id}`;

        let bodyGeo = this.sharedGeometries.sedanBody;
        let mat = this.sharedMaterials.carPalette[id % this.sharedMaterials.carPalette.length];

        if (type === 'SUV') bodyGeo = this.sharedGeometries.suvBody;
        else if (type === 'SPORTS') bodyGeo = this.sharedGeometries.sportsBody;
        else if (type === 'TRUCK') bodyGeo = this.sharedGeometries.truckBody;
        else if (type === 'TAXI') mat = this.sharedMaterials.carPalette[4]; // Yellow
        else if (type === 'POLICE') mat = this.sharedMaterials.carPalette[1]; // Black

        // Main Body Mesh
        const bodyMesh = new THREE.Mesh(bodyGeo, mat);
        bodyMesh.position.y = 0.5;
        bodyMesh.castShadow = true;
        group.add(bodyMesh);

        // Roof Mesh
        const roofMesh = new THREE.Mesh(this.sharedGeometries.roof, this.sharedMaterials.glass);
        roofMesh.position.set(0, 0.95, -0.1);
        group.add(roofMesh);

        // Headlights
        const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.05), this.sharedMaterials.headlight);
        hl1.position.set(-0.65, 0.5, -1.9);
        const hl2 = hl1.clone();
        hl2.position.x = 0.65;
        group.add(hl1);
        group.add(hl2);

        // Taillights
        const tl1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.05), this.sharedMaterials.taillight);
        tl1.position.set(-0.65, 0.55, 1.9);
        const tl2 = tl1.clone();
        tl2.position.x = 0.65;
        group.add(tl1);
        group.add(tl2);

        // Indicator Lights
        const indLeft = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.05), this.sharedMaterials.indicatorOff);
        indLeft.position.set(-0.85, 0.5, -1.91);
        const indRight = indLeft.clone();
        indRight.position.x = 0.85;
        group.add(indLeft);
        group.add(indRight);

        // Wheels
        const wheelPositions = [[-0.85, 0.32, -1.2], [0.85, 0.32, -1.2], [-0.85, 0.32, 1.2], [0.85, 0.32, 1.2]];
        wheelPositions.forEach(pos => {
            const w = new THREE.Mesh(this.sharedGeometries.wheel, this.sharedMaterials.wheel);
            w.position.set(pos[0], pos[1], pos[2]);
            group.add(w);
        });

        // Police Siren Light bar
        if (type === 'POLICE') {
            const sirenB = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.12), this.sharedMaterials.policeBlue);
            sirenB.position.set(-0.25, 1.3, 0);
            const sirenR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.12), this.sharedMaterials.policeRed);
            sirenR.position.set(0.25, 1.3, 0);
            group.add(sirenB);
            group.add(sirenR);
        }

        // Attach AI Telemetry Properties to Mesh (Zero Extra Class Allocations)
        group.userData = {
            id: id,
            type: type,
            personality: this.getRandomPersonality(),
            state: 'CRUISING',
            lane: 1, // 0: Left, 1: Center, 2: Right
            targetLane: 1,
            x: 0,
            z: 0,
            speed: 16.0,
            targetSpeed: 20.0,
            accelRate: 1.5,
            brakeRate: 4.0,
            blinkTimer: 0,
            indicatorLeft: indLeft,
            indicatorRight: indRight,
            isCrashed: false,
            tickOffset: Math.floor(Math.random() * 3)
        };

        if (this.game && this.game.scene) {
            this.game.scene.add(group);
        }

        return group;
    }

    getRandomPersonality() {
        const p = ['CALM', 'NORMAL', 'AGGRESSIVE', 'SPORT', 'DRIVER_ERROR'];
        return p[Math.floor(Math.random() * p.length)];
    }

    initTrafficLights() {
        this.trafficLights = [
            { z: -150, state: 'GREEN', timer: 0 },
            { z: -500, state: 'RED', timer: 0 },
            { z: -850, state: 'GREEN', timer: 0 }
        ];
    }

    // Spatial Grid Cell Key Generator
    getSpatialCellKey(z) {
        return Math.floor(z / this.CELL_SIZE);
    }

    updateSpatialGrid() {
        this.spatialGrid.clear();
        this.activeVehicles.forEach(v => {
            const key = this.getSpatialCellKey(v.userData.z);
            if (!this.spatialGrid.has(key)) this.spatialGrid.set(key, []);
            this.spatialGrid.get(key).push(v);
        });
    }

    // Main Traffic Update Loop (Invoked inside Game3D.update)
    update(dt, timestamp) {
        if (!this.game) return;

        // 1. Update Traffic Lights Cycle
        this.trafficLightTimer += dt;
        if (this.trafficLightTimer > 6.0) {
            this.trafficLightTimer = 0;
            this.trafficLights.forEach(tl => {
                tl.state = (tl.state === 'GREEN') ? 'RED' : 'GREEN';
            });
        }

        // 2. Dynamic Spawner
        this.manageSpawns();

        // 3. Update Spatial Grid Index
        this.updateSpatialGrid();

        // 4. Update Active Vehicles with Distance LOD & Tick Throttling
        const playerZ = 0; // Relative camera offset
        const playerX = this.game.player ? this.game.player.x : 0;
        const playerSpeed = this.game.speed || 20;

        for (let i = this.activeVehicles.length - 1; i >= 0; i--) {
            const v = this.activeVehicles[i];
            const data = v.userData;

            // Distance LOD calculation
            const distZ = Math.abs(data.z - playerZ);

            // Shadow Culling LOD for distant vehicles to save Draw Calls
            if (v.children[0]) {
                v.children[0].castShadow = (distZ < 30);
            }

            // Despawn if vehicle falls too far behind or ahead
            if (data.z > 35 || data.z < -420) {
                this.despawnVehicle(v, i);
                continue;
            }

            // Distance LOD Tick Optimization
            let shouldUpdateAI = true;
            if (distZ > 100) {
                shouldUpdateAI = (this.game.frameCount % 6 === data.tickOffset);
            } else if (distZ > 45) {
                shouldUpdateAI = (this.game.frameCount % 3 === data.tickOffset);
            }

            if (shouldUpdateAI) {
                this.updateAILogic(v, data, dt, playerX, playerSpeed);
            }

            // Physics Movement (Every frame for smooth render)
            data.z += (playerSpeed - data.speed) * dt * 10.0;
            data.x += (this.game.laneX[data.targetLane] - data.x) * dt * 3.5;

            v.position.set(data.x, 0, data.z);

            // Blink Turn Indicators
            if (data.state === 'LANE_CHANGE' || data.state === 'OVERTAKING') {
                data.blinkTimer += dt * 8.0;
                const isBlinking = Math.floor(data.blinkTimer) % 2 === 0;
                const activeInd = (data.targetLane > data.lane) ? data.indicatorRight : data.indicatorLeft;
                if (activeInd) {
                    activeInd.material = isBlinking ? this.sharedMaterials.indicatorOn : this.sharedMaterials.indicatorOff;
                }
            } else {
                if (data.indicatorLeft) data.indicatorLeft.material = this.sharedMaterials.indicatorOff;
                if (data.indicatorRight) data.indicatorRight.material = this.sharedMaterials.indicatorOff;
            }

            // Player Collision Proxy Check
            if (Math.abs(data.z - 0) < 2.2 && Math.abs(data.x - playerX) < 1.4) {
                if (!data.isCrashed) {
                    data.isCrashed = true;
                    data.speed *= 0.3;
                    if (window.audioMgr) window.audioMgr.playCrash();
                    if (this.game.player.hasShield) {
                        this.game.player.hasShield = false;
                        this.despawnVehicle(v, i);
                    } else {
                        this.game.gameOver('تصادف با خودرو در آزادراه!');
                        return;
                    }
                }
            }
        }
    }

    // AI Driver Decision Logic
    updateAILogic(v, data, dt, playerX, playerSpeed) {
        if (data.isCrashed) return;

        // Check Vehicle Ahead in same Spatial Cell or Next Cell
        const currentCell = this.getSpatialCellKey(data.z);
        const cellVehicles = (this.spatialGrid.get(currentCell) || []).concat(this.spatialGrid.get(currentCell - 1) || []);

        let vehicleAhead = null;
        let minAheadDist = 999;

        cellVehicles.forEach(other => {
            if (other === v) return;
            const oData = other.userData;
            if (oData.lane === data.lane && oData.z < data.z) {
                const dist = data.z - oData.z;
                if (dist < minAheadDist) {
                    minAheadDist = dist;
                    vehicleAhead = other;
                }
            }
        });

        // Traffic Light Check
        let isRedLightAhead = false;
        this.trafficLights.forEach(tl => {
            if (tl.state === 'RED' && data.z > tl.z && (data.z - tl.z) < 35) {
                isRedLightAhead = true;
            }
        });

        // Personality Speed Adjustments
        let desiredSpeed = 22.0;
        if (data.personality === 'CALM') desiredSpeed = 16.0;
        else if (data.personality === 'AGGRESSIVE') desiredSpeed = 28.0;
        else if (data.personality === 'SPORT') desiredSpeed = 32.0;

        if (isRedLightAhead) {
            data.state = 'BRAKING';
            data.targetSpeed = 0;
            data.speed = Math.max(0, data.speed - data.brakeRate * dt * 10);
        } else if (vehicleAhead && minAheadDist < 18) {
            data.state = 'FOLLOWING';
            data.targetSpeed = vehicleAhead.userData.speed;
            data.speed += (data.targetSpeed - data.speed) * dt * data.brakeRate;

            // Overtake logic for Aggressive / Sport drivers
            if ((data.personality === 'AGGRESSIVE' || data.personality === 'SPORT') && minAheadDist < 12) {
                const nextLane = (data.lane === 0) ? 1 : (data.lane === 2 ? 1 : (Math.random() < 0.5 ? 0 : 2));
                data.targetLane = nextLane;
                data.lane = nextLane;
                data.state = 'OVERTAKING';
            }
        } else {
            data.state = 'CRUISING';
            data.targetSpeed = desiredSpeed;
            data.speed += (data.targetSpeed - data.speed) * dt * data.accelRate;
        }
    }

    // Dynamic Spawner (Reuses Pooled Objects)
    manageSpawns() {
        const targetCount = this.getDesiredDensityCount();
        if (this.activeVehicles.length < targetCount && this.pooledVehicles.length > 0) {
            const spawnZ = -220 - Math.random() * 150;
            const spawnLane = Math.floor(Math.random() * 3);

            // Verify position is clear
            const isClear = !this.activeVehicles.some(v => Math.abs(v.userData.z - spawnZ) < 25 && v.userData.lane === spawnLane);
            if (isClear) {
                this.spawnVehicle(spawnZ, spawnLane);
            }
        }
    }

    getDesiredDensityCount() {
        if (!this.game || !this.game.settingsSystem) return 12;
        const dens = this.game.settingsSystem.data.graphics.trafficDensity || 'MEDIUM';
        if (dens === 'OFF') return 0;
        if (dens === 'LOW') return 4;
        if (dens === 'MEDIUM') return 12;
        if (dens === 'HIGH') return 20;
        if (dens === 'ULTRA') return 30;
        return 12;
    }

    spawnVehicle(z, lane) {
        if (this.pooledVehicles.length === 0) return;

        const vehicle = this.pooledVehicles.pop();
        const data = vehicle.userData;

        data.z = z;
        data.lane = lane;
        data.targetLane = lane;
        data.x = this.game.laneX[lane];
        data.speed = 15 + Math.random() * 10;
        data.isCrashed = false;
        data.state = 'CRUISING';
        data.personality = this.getRandomPersonality();

        vehicle.position.set(data.x, 0, data.z);
        vehicle.visible = true;

        this.activeVehicles.push(vehicle);
    }

    despawnVehicle(vehicle, index) {
        vehicle.visible = false;
        this.activeVehicles.splice(index, 1);
        this.pooledVehicles.push(vehicle);
    }

    reset() {
        for (let i = this.activeVehicles.length - 1; i >= 0; i--) {
            const v = this.activeVehicles[i];
            v.visible = false;
            this.pooledVehicles.push(v);
        }
        this.activeVehicles = [];
        this.spatialGrid.clear();
    }
}
