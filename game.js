
function createUFOMesh() {
    const mesh = new THREE.Object3D();

    // material for the saucer
    var matSaucer = new THREE.MeshPhongMaterial({
        color: Colors.silver, // Metallic look
        flatShading: true,
        side: THREE.DoubleSide,
    });

    // main saucer body (disk)
    const geomSaucerBody = new THREE.CylinderGeometry(25, 80, 20, 32, 1, true);
    const saucerBody = new THREE.Mesh(geomSaucerBody, matSaucer);
    saucerBody.castShadow = true;
    saucerBody.receiveShadow = true;
    mesh.add(saucerBody);

    //dome on top of the saucer
    const matDome = new THREE.MeshPhongMaterial({
        color: Colors.blue, // Could be glass-like or glowing
        flatShading: true,
        side: THREE.DoubleSide,
    });
    const geomDome = new THREE.SphereGeometry(
        25,
        32,
        16,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2
    );
    
    const dome = new THREE.Mesh(geomDome, matDome);
    dome.position.y = 10; // Adjust to sit above the saucer body
    dome.castShadow = true;
    dome.receiveShadow = true;
    mesh.add(dome);

    // base of the saucer (inverted dome)
    const geomBase = new THREE.SphereGeometry(
        30,
        32,
        16,
        0,
        Math.PI * 2,
        Math.PI / 2,
        Math.PI / 2
    );
    const base = new THREE.Mesh(geomBase, matSaucer);
    base.position.y = 0; // Adjust to sit below the saucer body
    base.castShadow = true;
    base.receiveShadow = true;
    mesh.add(base);

    //Lights around the saucer
    const lightMaterial = new THREE.MeshBasicMaterial({
        color: Colors.green,
        emissive: Colors.green,
    });
    for (let i = 0; i < 12; i++) {
        const lightGeom = new THREE.SphereGeometry(2, 16, 16);
        const light = new THREE.Mesh(lightGeom, lightMaterial);
        const angle = (i / 12) * Math.PI * 2;
        light.position.set(Math.cos(angle) * 60, -10, Math.sin(angle) * 60);
        mesh.add(light);
    }

    // finalize UFO
    mesh.rotation.x = Math.PI / 6; // Slight tilt for a dynamic look
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    scene.add(mesh);
    return [mesh];
}

//utilities
const utils = {
    normalize: function (v, vmin, vmax, tmin, tmax) {
        var nv = Math.max(Math.min(v, vmax), vmin);
        var dv = vmax - vmin;
        var pc = (nv - vmin) / dv;
        var dt = tmax - tmin;
        var tv = tmin + pc * dt;
        return tv;
    },

    findWhere: function (list, properties) {
        for (const elem of list) {
            let all = true;
            for (const key in properties) {
                if (elem[key] !== properties[key]) {
                    all = false;
                    break;
                }
            }
            if (all) {
                return elem;
            }
        }
        return null;
    },

    randomOneOf: function (choices) {
        return choices[Math.floor(Math.random() * choices.length)];
    },

    randomFromRange: function (min, max) {
        return min + Math.random() * (max - min);
    },

    collide: function (mesh1, mesh2, tolerance) {
        const diffPos = mesh1.position.clone().sub(mesh2.position.clone());
        const d = diffPos.length();
        return d < tolerance;
    },

    makeTetrahedron: function (a, b, c, d) {
        return [
            a[0],
            a[1],
            a[2],
            b[0],
            b[1],
            b[2],
            c[0],
            c[1],
            c[2],
            b[0],
            b[1],
            b[2],
            c[0],
            c[1],
            c[2],
            d[0],
            d[1],
            d[2],
        ];
    },
};

//scenes manager
class SceneManager {
    constructor() {
        this.list = new Set();
    }

    add(obj) {
        scene.add(obj.mesh);
        this.list.add(obj);
    }

    remove(obj) {
        scene.remove(obj.mesh);
        this.list.delete(obj);
    }

    clear() {
        for (const entry of this.list) {
            this.remove(entry);
        }
    }

    tick(deltaTime) {
        for (const entry of this.list) {
            if (entry.tick) {
                entry.tick(deltaTime);
            }
        }
    }
}

const sceneManager = new SceneManager();

class LoadingProgressManager {
    constructor() {
        this.promises = [];
    }

    add(promise) {
        this.promises.push(promise);
    }

    then(callback) {
        return Promise.all(this.promises).then(callback);
    }

    catch(callback) {
        return Promise.all(this.promises).catch(callback);
    }
}

const loadingProgressManager = new LoadingProgressManager();

class AudioManager {
    constructor() {
        this.buffers = {};
        this.loader = new THREE.AudioLoader();
        this.listener = new THREE.AudioListener();
        this.categories = {};
    }

    setCamera(camera) {
        camera.add(this.listener);
    }

    load(soundId, category, path) {
        const promise = new Promise((resolve, reject) => {
            this.loader.load(
                path,
                (audioBuffer) => {
                    this.buffers[soundId] = audioBuffer;
                    if (category !== null) {
                        if (!this.categories[category]) {
                            this.categories[category] = [];
                        }
                        this.categories[category].push(soundId);
                    }
                    resolve();
                },
                () => {},
                reject
            );
        });
        loadingProgressManager.add(promise);
    }

    play(soundIdOrCategory, options) {
        options = options || {};

        let soundId = soundIdOrCategory;
        const category = this.categories[soundIdOrCategory];
        if (category) {
            soundId = utils.randomOneOf(category);
        }

        const buffer = this.buffers[soundId];
        const sound = new THREE.Audio(this.listener);
        sound.setBuffer(buffer);
        if (options.loop) {
            sound.setLoop(true);
        }
        if (options.volume) {
            sound.setVolume(options.volume);
        }
        sound.play();
    }
}

const audioManager = new AudioManager();

class ModelManager {
    constructor(path) {
        this.path = path;
        this.models = {};
    }

    load(modelName) {
        const promise = new Promise((resolve, reject) => {
            const loader = new THREE.OBJLoader();
            loader.load(
                this.path + "/" + modelName + ".obj",
                (obj) => {
                    this.models[modelName] = obj;
                    resolve();
                },
                function () {},
                reject
            );
        });
        loadingProgressManager.add(promise);
    }

    get(modelName) {
        if (typeof this.models[modelName] === "undefined") {
            throw new Error("Can't find model " + modelName);
        }
        return this.models[modelName];
    }
}

const modelManager = new ModelManager("/models");

var Colors = {
    red: 0xf25346,
    orange: 0xffa500,
    white: 0xd8d0d1,
    brown: 0x59332e,
    brownDark: 0x23190f,
    pink: 0xf5986e,
    yellow: 0xf4ce93,
    blue: 0x68c3c0,
};

const COLOR_GEMS = 0x009df3; // 0x009999
const COLOR_COLLECTIBLE_BUBBLE = COLOR_GEMS;

///////////////
// GAME VARIABLES
var canDie = true;
var world, game;
var newTime = new Date().getTime();
var oldTime = new Date().getTime();

let scene, camera, renderer;

//SCREEN & MOUSE VARIABLES
var MAX_WORLD_X = 1000;

//INIT THREE JS, SCREEN AND MOUSE EVENTS
function createScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, ui.width / ui.height, 0.1, 10000);
    audioManager.setCamera(camera);
    scene.fog = new THREE.Fog(0xf7d9aa, 100, 950);

    renderer = new THREE.WebGLRenderer({
        canvas: ui.canvas,
        alpha: true,
        antialias: true,
    });
    renderer.setSize(ui.width, ui.height);
    renderer.setPixelRatio(
        window.devicePixelRatio ? window.devicePixelRatio : 1
    );

    renderer.shadowMap.enabled = true;

    function setupCamera() {
        renderer.setSize(ui.width, ui.height);
        camera.aspect = ui.width / ui.height;
        camera.updateProjectionMatrix();
    }

    setupCamera();
    ui.onResize(setupCamera);
}

// LIGHTS
var ambientLight;

function createLights() {
    const hemisphereLight = new THREE.HemisphereLight(0xaaaaaa, 0x000000, 0.9);
    ambientLight = new THREE.AmbientLight(0xdc8874, 0.5);
    const shadowLight = new THREE.DirectionalLight(0xffffff, 0.9);
    shadowLight.position.set(150, 350, 350);
    shadowLight.castShadow = true;
    shadowLight.shadow.camera.left = -400;
    shadowLight.shadow.camera.right = 400;
    shadowLight.shadow.camera.top = 400;
    shadowLight.shadow.camera.bottom = -400;
    shadowLight.shadow.camera.near = 1;
    shadowLight.shadow.camera.far = 1000;
    shadowLight.shadow.mapSize.width = 4096;
    shadowLight.shadow.mapSize.height = 4096;

    scene.add(hemisphereLight);
    scene.add(shadowLight);
    scene.add(ambientLight);
}

// LASERS
class SimpleGun {
    constructor() {
        this.mesh = SimpleGun.createMesh();
        this.mesh.position.z = 28;
        this.mesh.position.x = 25;
        this.mesh.position.y = -8;
    }

    static createMesh() {
        const metalMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00, // Bright green for a laser gun
            flatShading: true,
            roughness: 0.3,
            metalness: 0.8,
        });
        const BODY_RADIUS = 3;
        const BODY_LENGTH = 20;
        const full = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(BODY_RADIUS, BODY_RADIUS, BODY_LENGTH),
            metalMaterial
        );
        body.rotation.z = Math.PI / 2;
        full.add(body);

        const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(
                BODY_RADIUS / 2,
                BODY_RADIUS / 2,
                BODY_LENGTH
            ),
            metalMaterial
        );
        barrel.rotation.z = Math.PI / 2;
        barrel.position.x = BODY_LENGTH;
        // full.add(barrel);
        return full;
    }

    downtime() {
        return 0.2;
    }

    damage() {
        return 1;
    }

    shoot(direction) {
        const LASER_SPEED = 0.5;
        const RECOIL_DISTANCE = 4;
        const RECOIL_DURATION = this.downtime() / 1.5;

        const position = new THREE.Vector3();
        this.mesh.getWorldPosition(position);
        position.add(new THREE.Vector3(5, 0, 0));
        spawnProjectile(
            this.damage(),
            position,
            direction,
            LASER_SPEED,
            0.5, //bullet size
            3
        );

        // audio
        audioManager.play("laser-soft", { volume: 0.3 });

        // Recoil of laser
        const initialX = this.mesh.position.x;
        TweenMax.to(this.mesh.position, {
            duration: RECOIL_DURATION / 2,
            x: initialX - RECOIL_DISTANCE,
            onComplete: () => {
                TweenMax.to(this.mesh.position, {
                    duration: RECOIL_DURATION / 2,
                    x: initialX,
                });
            },
        });
    }
}

class DoubleGun {
    constructor() {
        this.gun1 = new SimpleGun();
        this.gun2 = new SimpleGun();

        this.gun1.mesh.position.add(new THREE.Vector3(-7, 0, 0)); // Shift left
        this.gun2.mesh.position.add(new THREE.Vector3(7, 0, 0)); // Shift right

        this.mesh = new THREE.Group();
        this.mesh.add(this.gun1.mesh);
        this.mesh.add(this.gun2.mesh);
    }

    downtime() {
        return 0.15;
    }

    damage() {
        return this.gun1.damage() + this.gun2.damage();
    }

    shoot(direction) {
        this.gun1.shoot(direction);
        this.gun2.shoot(direction);
    }
}

class BetterGun {
    constructor() {
        this.mesh = BetterGun.createMesh();
        this.mesh.position.z = 28;
        this.mesh.position.x = -3;
        this.mesh.position.y = -5;
    }

    static createMesh() {
        const metalMaterial = new THREE.MeshStandardMaterial({
            color: 0x0088ff,
            flatShading: true,
            roughness: 0.2,
            metalness: 0.9,
        });
        const BODY_RADIUS = 5;
        const BODY_LENGTH = 30;
        const full = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(BODY_RADIUS, BODY_RADIUS, BODY_LENGTH),
            metalMaterial
        );
        body.rotation.z = Math.PI / 2;
        body.position.x = BODY_LENGTH / 2;
        full.add(body);

        const BARREL_RADIUS = BODY_RADIUS / 2;
        const BARREL_LENGTH = BODY_LENGTH * 0.66;
        const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(
                BARREL_RADIUS,
                BARREL_RADIUS,
                BARREL_LENGTH
            ),
            metalMaterial
        );
        barrel.rotation.z = Math.PI / 2;
        barrel.position.x = BODY_LENGTH + BARREL_LENGTH / 2;
        full.add(barrel);

        const TIP_RADIUS = BARREL_RADIUS * 1.3;
        const TIP_LENGTH = BODY_LENGTH / 4;
        const tip = new THREE.Mesh(
            new THREE.CylinderGeometry(TIP_RADIUS, TIP_RADIUS, TIP_LENGTH),
            metalMaterial
        );
        tip.rotation.z = Math.PI / 2;
        tip.position.x = BODY_LENGTH + BARREL_LENGTH + TIP_LENGTH / 2;
        full.add(tip);
        return full;
    }

    downtime() {
        return 0.1;
    }

    damage() {
        return 5;
    }

    shoot(direction) {
        const LASER_SPEED = 0.5;
        const RECOIL_DISTANCE = 4;
        const RECOIL_DURATION = this.downtime() / 3;

        const position = new THREE.Vector3();
        this.mesh.getWorldPosition(position);
        position.add(new THREE.Vector3(12, 0, 0));
        spawnProjectile(
            this.damage(),
            position,
            direction,
            LASER_SPEED,
            0.8, //bullet sie
            6
        );
        +(
            // audio
            audioManager.play("laser-hard", { volume: 0.3 })
        );

        // Recoil of gun
        const initialX = this.mesh.position.x;
        TweenMax.to(this.mesh.position, {
            duration: RECOIL_DURATION,
            x: initialX - RECOIL_DISTANCE,
            onComplete: () => {
                TweenMax.to(this.mesh.position, {
                    duration: RECOIL_DURATION,
                    x: initialX,
                });
            },
        });
    }
}

class UFO {
    constructor() {
        const [mesh] = createUFOMesh();
        this.mesh = mesh;
        this.weapon = null;
        this.lastShot = 0;
    }

    equipWeapon(weapon) {
        if (this.weapon) {
            this.mesh.remove(this.weapon.mesh);
        }
        this.weapon = weapon;
        if (this.weapon) {
            this.mesh.add(this.weapon.mesh);
        }
    }

    shoot() {
        if (!this.weapon) {
            return;
        }

        // rate-limit the shooting
        const nowTime = new Date().getTime() / 1000;
        const ready = nowTime - this.lastShot > this.weapon.downtime();
        if (!ready) {
            return;
        }
        this.lastShot = nowTime;

        // fire the shot
        let direction = new THREE.Vector3(10, 0, 0);
        direction.applyEuler(ufo.mesh.rotation);
        this.weapon.shoot(direction);

        // recoil
        const recoilForce = this.weapon.damage();
        TweenMax.to(this.mesh.position, {
            duration: 0.05,
            x: this.mesh.position.x - recoilForce,
        });
    }

    tick(deltaTime) {
        if (game.status === "playing") {
            game.UFOSpeed = utils.normalize(
                ui.mousePos.x,
                -0.5,
                0.5,
                world.UFOMinSpeed,
                world.UFOMaxSpeed
            );
            let targetX = utils.normalize(
                ui.mousePos.x,
                -1,
                1,
                -world.UFOAmpWidth * 0.7,
                -world.UFOAmpWidth
            );
            let targetY = utils.normalize(
                ui.mousePos.y,
                -0.75,
                0.75,
                world.UFODefaultHeight - world.UFOAmpHeight,
                world.UFODefaultHeight + world.UFOAmpHeight
            );

            game.UFOCollisionDisplacementX += game.UFOCollisionSpeedX;
            targetX += game.UFOCollisionDisplacementX;

            game.UFOCollisionDisplacementY += game.UFOCollisionSpeedY;
            targetY += game.UFOCollisionDisplacementY;

            this.mesh.position.x +=
                (targetX - this.mesh.position.x) *
                deltaTime *
                world.UFOMoveSensivity;
            this.mesh.position.y +=
                (targetY - this.mesh.position.y) *
                deltaTime *
                world.UFOMoveSensivity;

            this.mesh.rotation.x =
                (this.mesh.position.y - targetY) *
                deltaTime *
                world.UFORotXSensivity;
            this.mesh.rotation.z =
                (targetY - this.mesh.position.y) *
                deltaTime *
                world.UFORotXSensivity;

            if (game.fpv) {
                camera.position.y = this.mesh.position.y + 20;
            } else {
                camera.fov = utils.normalize(ui.mousePos.x, -30, 1, 40, 80);
                camera.updateProjectionMatrix();
                camera.position.y +=
                    (this.mesh.position.y - camera.position.y) *
                    deltaTime *
                    world.cameraSensivity;
            }
        }

        game.UFOCollisionSpeedX +=
            (0 - game.UFOCollisionSpeedX) * deltaTime * 0.03;
        game.UFOCollisionDisplacementX +=
            (0 - game.UFOCollisionDisplacementX) * deltaTime * 0.01;
        game.UFOCollisionSpeedY +=
            (0 - game.UFOCollisionSpeedY) * deltaTime * 0.03;
        game.UFOCollisionDisplacementY +=
            (0 - game.UFOCollisionDisplacementY) * deltaTime * 0.01;
    }

    gethit(position) {
        const diffPos = this.mesh.position.clone().sub(position);
        const d = diffPos.length();
        game.UFOCollisionSpeedX = (100 * diffPos.x) / d;
        game.UFOCollisionSpeedY = (100 * diffPos.y) / d;
        ambientLight.intensity = 2;
        audioManager.play("ufo-crash");
    }
}

function rotateAroundPlanet(object, deltaTime, speed) {
    object.angle += deltaTime * game.speed * world.collectiblesSpeed;
    if (object.angle > Math.PI * 2) {
        object.angle -= Math.PI * 2;
    }
    object.mesh.position.x = Math.cos(object.angle) * object.distance;
    object.mesh.position.y =
        -world.planetRadius + Math.sin(object.angle) * object.distance;
}

class Collectible {
    constructor(mesh, onApply) {
        this.angle = 0;
        this.distance = 0;
        this.onApply = onApply;

        this.mesh = new THREE.Object3D();
        const bubble = new THREE.Mesh(
            new THREE.SphereGeometry(10, 100, 100),
            new THREE.MeshPhongMaterial({
                color: COLOR_COLLECTIBLE_BUBBLE,
                transparent: true,
                opacity: 0.4,
                flatShading: true,
            })
        );
        this.mesh.add(bubble);
        this.mesh.add(mesh);
        this.mesh.castShadow = true;

        this.angle = Math.PI * 2 * 0.1;
        this.distance =
            world.planetRadius +
            world.UFODefaultHeight +
            (-1 + 2 * Math.random()) * (world.UFOAmpHeight - 20);
        this.mesh.position.y =
            -world.planetRadius + Math.sin(this.angle) * this.distance;
        this.mesh.position.x = Math.cos(this.angle) * this.distance;

        sceneManager.add(this);
    }

    tick(deltaTime) {
        rotateAroundPlanet(this, deltaTime, world.collectiblesSpeed);

        // rotate collectible for visual effect
        this.mesh.rotation.y += deltaTime * 0.002 * Math.random();
        this.mesh.rotation.z += deltaTime * 0.002 * Math.random();

        // collision?
        if (
            utils.collide(
                ufo.mesh,
                this.mesh,
                world.collectibleDistanceTolerance
            )
        ) {
            this.onApply();
            this.explode();
        }
        // passed-by?
        else if (this.angle > Math.PI) {
            sceneManager.remove(this);
        }
    }

    explode() {
        spawnParticles(
            this.mesh.position.clone(),
            15,
            COLOR_COLLECTIBLE_BUBBLE,
            3
        );
        sceneManager.remove(this);
        audioManager.play("bubble");

        const DURATION = 1;

        setTimeout(() => {
            const itemMesh = new THREE.Group();
            for (let i = 1; i < this.mesh.children.length; i += 1) {
                itemMesh.add(this.mesh.children[i]);
            }
            scene.add(itemMesh);
            itemMesh.position.y = 120;
            itemMesh.position.z = 50;

            const initialScale = itemMesh.scale.clone();
            TweenMax.to(itemMesh.scale, {
                duration: DURATION / 2,
                x: initialScale.x * 4,
                y: initialScale.y * 4,
                z: initialScale.z * 4,
                ease: "Power2.easeInOut",
                onComplete: () => {
                    TweenMax.to(itemMesh.scale, {
                        duration: DURATION / 2,
                        x: 0,
                        y: 0,
                        z: 0,
                        ease: "Power2.easeInOut",
                        onComplete: () => {
                            scene.remove(itemMesh);
                        },
                    });
                },
            });
        }, 200);
    }
}

function spawnSimpleGunCollectible() {
    const gun = SimpleGun.createMesh();
    gun.scale.set(0.25, 0.25, 0.25);
    gun.position.x = -2;

    new Collectible(gun, () => {
        ufo.equipWeapon(new SimpleGun());
    });
}

function spawnBetterGunCollectible() {
    const gun = BetterGun.createMesh();
    gun.scale.set(0.25, 0.25, 0.25);
    gun.position.x = -7;

    new Collectible(gun, () => {
        ufo.equipWeapon(new BetterGun());
    });
}

function spawnDoubleGunCollectible() {
    const guns = new THREE.Group();

    const gun1 = SimpleGun.createMesh();
    gun1.scale.set(0.25, 0.25, 0.25);
    gun1.position.x = -2;
    gun1.position.y = -2;
    guns.add(gun1);

    const gun2 = SimpleGun.createMesh();
    gun2.scale.set(0.25, 0.25, 0.25);
    gun2.position.x = -2;
    gun2.position.y = 2;
    guns.add(gun2);

    new Collectible(guns, () => {
        ufo.equipWeapon(new DoubleGun());
    });
}

function spawnLifeCollectible() {
    const heart = modelManager.get("heart");
    heart.traverse(function (child) {
        if (child instanceof THREE.Mesh) {
            child.material.color.setHex(0xff0000);
        }
    });
    heart.position.set(0, -1, -3);
    heart.scale.set(5, 5, 5);

    new Collectible(heart, () => {
        addLife();
    });
}

class Cloud {
    constructor() {
        this.mesh = new THREE.Object3D();
        const geom = new THREE.SphereGeometry(2, 64, 64); // Small sphere for the star
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
        });
        const nBlocs = 5 + Math.floor(Math.random() * 3);
        for (let i = 0; i < nBlocs; i++) {
            const m = new THREE.Mesh(geom.clone(), mat);
            m.position.x = i * 15;
            m.position.y = Math.random() * -500;
            m.position.z = Math.random() * 100;
            m.rotation.y = Math.random() * Math.PI * 2;
            m.rotation.z = Math.random() * Math.PI * 2;
            const s = 0.1 + Math.random() * 0.9;
            m.scale.set(s, s, s);
            this.mesh.add(m);
            m.castShadow = true;
            m.receiveShadow = true;
        }
    }

    tick(deltaTime) {
        const l = this.mesh.children.length;
        for (let i = 0; i < l; i++) {
            let m = this.mesh.children[i];
            m.rotation.y += Math.random() * 0.002 * (i + 1);
            m.rotation.z += Math.random() * 0.005 * (i + 1);
        }
    }
}

class Sky {
    constructor() {
        this.mesh = new THREE.Object3D();
        this.nClouds = 20;
        this.clouds = [];
        const stepAngle = (Math.PI * 2) / this.nClouds;
        for (let i = 0; i < this.nClouds; i++) {
            const c = new Cloud();
            this.clouds.push(c);
            var a = stepAngle * i;
            var h = world.planetRadius + 150 + Math.random() * 200;
            c.mesh.position.y = Math.sin(a) * h;
            c.mesh.position.x = Math.cos(a) * h;
            c.mesh.position.z = -300 - Math.random() * 500;
            c.mesh.rotation.z = a + Math.PI / 2;
            const scale = 1 + Math.random() * 2;
            c.mesh.scale.set(scale, scale, scale);
            this.mesh.add(c.mesh);
        }
    }

    tick(deltaTime) {
        for (var i = 0; i < this.nClouds; i++) {
            var c = this.clouds[i];
            c.tick(deltaTime);
            const PROJECTILE_COLOR = 0xff0000; // Bright red for a laser tracer
            const PROJECTILE_EMISSIVE_COLOR = 0xff4444; // Slightly brighter red for the glow
        }
        this.mesh.rotation.z += game.speed * deltaTime;
    }
}

const COLOR_PLANET_LEVEL = [
    0x2e2e2e, // Dark grey (e.g., asteroid or distant planet)
    0x6f2da8, // Purple (e.g., Neptune or a gas giant)
    0xffcc00, // Yellow (e.g., a star or a desert planet)
    0x8b0000, // Dark red (e.g., Mars or a rocky planet)
    0x228b22, // Green (e.g., an Earth-like planet)
    0x0000ff, // Blue (e.g., an ocean planet or Earth)
    0xa52a2a, // Brown (e.g., a barren or volcanic planet)
    0x8a2be2, // Violet (e.g., a mysterious or alien world)
    0xf4a460, // Sandy (e.g., a dune-covered planet)
    0xffffff, // White (e.g., an icy or frozen planet)
];
class Planet {
    constructor() {
        var geom = new THREE.SphereGeometry(world.planetRadius, 100, 100);
        this.craters = [];
        const arr = geom.attributes.position.array;

        for (let i = 0; i < arr.length / 3; i++) {
            this.craters.push({
                x: arr[i * 3 + 0],
                y: arr[i * 3 + 1],
                z: arr[i * 3 + 2],
                ang: Math.random() * Math.PI * 2,
                amp:
                    world.craterMinAmp +
                    Math.random() * (world.craterMaxAmp - world.craterMinAmp),
                speed:
                    world.craterMinSpeed +
                    Math.random() *
                        (world.craterMaxSpeed - world.craterMinSpeed),
                craterDepth: Math.random() * 5 + 1, // Depth of the crater
                craterRadius: Math.random() * 10 + 5, // Radius of the crater
            });
        }

        var mat = new THREE.MeshPhongMaterial({
            color: COLOR_PLANET_LEVEL[0],
            transparent: true,
            opacity: 0.8,
            flatShading: true,
        });
        this.mesh = new THREE.Mesh(geom, mat);
        this.mesh.receiveShadow = true;
    }

    tick(deltaTime) {
        const arr = this.mesh.geometry.attributes.position.array;
        for (let i = 0; i < arr.length / 3; i++) {
            const crater = this.craters[i];

            // Calculate distance from the crater center (simulate craters)
            const dist = Math.sqrt(
                crater.x * crater.x + crater.y * crater.y + crater.z * crater.z
            );

            const normalizedDist =
                (dist - world.planetRadius) / crater.craterRadius;

            const craterEffect =
                Math.exp(-normalizedDist * normalizedDist) * crater.craterDepth;

            // Apply crater indentation
            arr[i * 3 + 0] = crater.x - craterEffect * (crater.x / dist);
            arr[i * 3 + 1] = crater.y - craterEffect * (crater.y / dist);
            arr[i * 3 + 2] = crater.z - craterEffect * (crater.z / dist);

            // Update angle for dynamic effect (if desired)
            crater.ang += crater.speed * deltaTime;
        }
        this.mesh.geometry.attributes.position.needsUpdate = true;
    }

    updateColor() {
        this.mesh.material = new THREE.MeshPhongMaterial({
            color: COLOR_PLANET_LEVEL[
                (game.level - 1) % COLOR_PLANET_LEVEL.length
            ],
            flatShading: true,
        });
    }
}

function spawnParticles(pos, count, color, scale) {
    for (let i = 0; i < count; i++) {
        const geom = new THREE.TetrahedronGeometry(3, 0);
        const mat = new THREE.MeshPhongMaterial({
            color: 0x009999,
            shininess: 0,
            specular: 0xffffff,
            flatShading: true,
        });
        const mesh = new THREE.Mesh(geom, mat);
        scene.add(mesh);

        mesh.visible = true;
        mesh.position.copy(pos);
        mesh.material.color = new THREE.Color(color);
        mesh.material.needsUpdate = true;
        mesh.scale.set(scale, scale, scale);
        const targetX = pos.x + (-1 + Math.random() * 2) * 50;
        const targetY = pos.y + (-1 + Math.random() * 2) * 50;
        const targetZ = pos.z + (-1 + Math.random() * 2) * 50;
        const speed = 0.6 + Math.random() * 0.2;
        TweenMax.to(mesh.rotation, speed, {
            x: Math.random() * 12,
            y: Math.random() * 12,
        });
        TweenMax.to(mesh.scale, speed, { x: 0.1, y: 0.1, z: 0.1 });
        TweenMax.to(mesh.position, speed, {
            x: targetX,
            y: targetY,
            z: targetZ,
            delay: Math.random() * 0.1,
            ease: Power2.easeOut,
            onComplete: () => {
                scene.remove(mesh);
            },
        });
    }
}

// ENEMIES
class Enemy {
    constructor() {
        var geom = new THREE.TetrahedronGeometry(8, 2);
        var mat = new THREE.MeshPhongMaterial({
            color: "#7a5322",
            shininess: 0,
            specular: 0xffffff,
            flatShading: true,
        });
        this.mesh = new THREE.Mesh(geom, mat);
        this.mesh.castShadow = true;
        this.angle = 0;
        this.distance = 0;
        this.hitpoints = 3;
        sceneManager.add(this);
    }

    tick(deltaTime) {
        rotateAroundPlanet(this, deltaTime, world.enemiesSpeed);
        this.mesh.rotation.y += Math.random() * 0.1;
        this.mesh.rotation.z += Math.random() * 0.1;

        // collision?
        if (
            utils.collide(ufo.mesh, this.mesh, world.enemyDistanceTolerance) &&
            game.status !== "finished"
        ) {
            this.explode();
            ufo.gethit(this.mesh.position);
            removeLife();
        }
        // passed-by?
        else if (this.angle > Math.PI) {
            sceneManager.remove(this);
        }

        const thisAabb = new THREE.Box3().setFromObject(this.mesh);
        for (const projectile of allProjectiles) {
            const projectileAabb = new THREE.Box3().setFromObject(
                projectile.mesh
            );
            if (thisAabb.intersectsBox(projectileAabb)) {
                spawnParticles(
                    projectile.mesh.position.clone(),
                    5,
                    Colors.brownDark,
                    1
                );
                projectile.remove();
                this.hitpoints -= projectile.damage;
                audioManager.play("bullet-impact", { volume: 0.3 });
            }
        }
        if (this.hitpoints <= 0) {
            this.explode();
        }
    }

    explode() {
        audioManager.play("rock-shatter", { volume: 3 });
        spawnParticles(this.mesh.position.clone(), 15, "#8a581a", 3);
        sceneManager.remove(this);
        game.statistics.enemiesKilled += 1;
    }
}

function spawnEnemies(count) {
    for (let i = 0; i < count; i++) {
        const enemy = new Enemy();
        enemy.angle = -(i * 0.1);
        enemy.distance =
            world.planetRadius +
            world.UFODefaultHeight +
            (-1 + Math.random() * 2) * (world.UFOAmpHeight - 20);
        enemy.mesh.position.x = Math.cos(enemy.angle) * enemy.distance;
        enemy.mesh.position.y =
            -world.planetRadius + Math.sin(enemy.angle) * enemy.distance;
    }
    game.statistics.enemiesSpawned += count;
}

// COINS
class Coin {
    constructor() {
        // Replace CylinderGeometry with OctahedronGeometry for a diamond shape
        var geom = new THREE.OctahedronGeometry(4, 0); // The first parameter is the size, the second is the detail level
        var mat = new THREE.MeshPhongMaterial({
            color: COLOR_GEMS,
            shininess: 50, // Increase shininess for a sparkling effect
            specular: 0xffffff,
            flatShading: true,
        });
        this.mesh = new THREE.Mesh(geom, mat);
        this.mesh.castShadow = true;
        this.angle = 0;
        this.dist = 0;
        sceneManager.add(this);
    }

    tick(deltaTime) {
        rotateAroundPlanet(this, deltaTime, world.coinsSpeed);

        this.mesh.rotation.z += Math.random() * 0.1;
        this.mesh.rotation.y += Math.random() * 0.1;

        // collision?
        if (utils.collide(ufo.mesh, this.mesh, world.coinDistanceTolerance)) {
            spawnParticles(this.mesh.position.clone(), 5, COLOR_GEMS, 0.8);
            addCoin();
            audioManager.play("orb", { volume: 0.5 });
            sceneManager.remove(this);
        }
        // passed-by?
        else if (this.angle > Math.PI) {
            sceneManager.remove(this);
        }
    }
}

function spawnCoins() {
    const nCoins = 1 + Math.floor(Math.random() * 10);
    const d =
        world.planetRadius +
        world.UFODefaultHeight +
        utils.randomFromRange(-1, 1) * (world.UFOAmpHeight - 20);
    const amplitude = 10 + Math.round(Math.random() * 10);
    for (let i = 0; i < nCoins; i++) {
        const coin = new Coin();
        coin.angle = -(i * 0.02);
        coin.distance = d + Math.cos(i * 0.5) * amplitude;
        coin.mesh.position.y =
            -world.planetRadius + Math.sin(coin.angle) * coin.distance;
        coin.mesh.position.x = Math.cos(coin.angle) * coin.distance;
    }
    game.statistics.coinsSpawned += nCoins;
}

// SHOOTING
let allProjectiles = [];

class Projectile {
    constructor(damage, initialPosition, direction, speed, radius, length) {
        const PROJECTILE_COLOR = 0xff0000; // Bright red for a laser tracer
        const PROJECTILE_EMISSIVE_COLOR = 0xff4444; // Slightly brighter red for the glow

        this.damage = damage;
        this.mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, 25),
            new THREE.LineBasicMaterial({
                color: PROJECTILE_COLOR,
                emissive: PROJECTILE_EMISSIVE_COLOR,
            })
        );
        this.mesh.position.copy(initialPosition);
        this.mesh.rotation.z = Math.PI / 2;
        this.direction = direction.clone();
        this.direction.setLength(1);
        this.speed = speed;
        sceneManager.add(this);

        game.statistics.shotsFired += 1;
    }

    tick(deltaTime) {
        this.mesh.position.add(
            this.direction.clone().multiplyScalar(this.speed * deltaTime)
        );
        this.mesh.position.z *= 0.9;
        // out of screen? => remove
        if (this.mesh.position.x > MAX_WORLD_X) {
            this.remove();
        }
    }

    remove() {
        sceneManager.remove(this);
        allProjectiles.splice(allProjectiles.indexOf(this), 1);
    }
}

function spawnProjectile(
    damage,
    initialPosition,
    direction,
    speed,
    radius,
    length
) {
    allProjectiles.push(
        new Projectile(
            damage,
            initialPosition,
            direction,
            speed,
            radius,
            length
        )
    );
}

// 3D Models
let planet, planet2;
let ufo;

function createUFO() {
    ufo = new UFO();
    ufo.mesh.scale.set(0.25, 0.25, 0.25);
    ufo.mesh.position.y = world.UFODefaultHeight;
    scene.add(ufo.mesh);
}

function createPlanet() {
    planet = new Planet();
    planet.mesh.position.y = -world.planetRadius;
    scene.add(planet.mesh);

    planet2 = new Planet();
    planet2.mesh.position.y = -world.planetRadius;
    scene.add(planet2.mesh);
}

function createSky() {
    sky = new Sky();
    sky.mesh.position.y = -world.planetRadius;
    scene.add(sky.mesh);
}

function loop() {
    newTime = new Date().getTime();
    const deltaTime = newTime - oldTime;
    oldTime = newTime;

    if (game.status == "playing") {
        if (!game.paused) {
            // Add coins
            if (
                Math.floor(game.distance) % world.distanceForCoinsSpawn == 0 &&
                Math.floor(game.distance) > game.coinLastSpawn
            ) {
                game.coinLastSpawn = Math.floor(game.distance);
                spawnCoins();
            }
            if (
                Math.floor(game.distance) % world.distanceForSpeedUpdate == 0 &&
                Math.floor(game.distance) > game.speedLastUpdate
            ) {
                game.speedLastUpdate = Math.floor(game.distance);
                game.targetBaseSpeed += world.incrementSpeedByTime * deltaTime;
            }
            if (
                Math.floor(game.distance) % world.distanceForEnemiesSpawn ==
                    0 &&
                Math.floor(game.distance) > game.enemyLastSpawn
            ) {
                game.enemyLastSpawn = Math.floor(game.distance);
                spawnEnemies(game.level);
            }
            if (
                Math.floor(game.distance) % world.distanceForLevelUpdate == 0 &&
                Math.floor(game.distance) > game.levelLastUpdate
            ) {
                game.levelLastUpdate = Math.floor(game.distance);
                game.level += 1;
                if (game.level === world.levelCount) {
                    game.status = "finished";
                    setFollowView();
                    ui.showScoreScreen();
                } else {
                    ui.informNextLevel(game.level);
                    planet.updateColor();
                    planet2.updateColor();
                    ui.updateLevelCount();
                    game.targetBaseSpeed =
                        world.initSpeed +
                        world.incrementSpeedByLevel * game.level;
                }
            }

            // span collectibles
            if (
                game.lifes < world.maxLifes &&
                game.distance - game.lastLifeSpawn > world.pauseLifeSpawn &&
                Math.random() < 0.01
            ) {
                game.lastLifeSpawn = game.distance;
                spawnLifeCollectible();
            }
            if (
                !game.spawnedSimpleGun &&
                game.distance >
                    world.simpleGunLevelDrop * world.distanceForLevelUpdate
            ) {
                spawnSimpleGunCollectible();
                game.spawnedSimpleGun = true;
            }
            if (
                !game.spawnedDoubleGun &&
                game.distance >
                    world.doubleGunLevelDrop * world.distanceForLevelUpdate
            ) {
                spawnDoubleGunCollectible();
                game.spawnedDoubleGun = true;
            }
            if (
                !game.spawnedBetterGun &&
                game.distance >
                    world.betterGunLevelDrop * world.distanceForLevelUpdate
            ) {
                spawnBetterGunCollectible();
                game.spawnedBetterGun = true;
            }

            if (game.status != "gameover") {
                if (ui.mouseButtons[0] || ui.keysDown["Space"]) {
                    ufo.shoot();
                }
            }

            ufo.tick(deltaTime);
            game.distance += game.speed * deltaTime * world.ratioSpeedDistance;
            game.baseSpeed +=
                (game.targetBaseSpeed - game.baseSpeed) * deltaTime * 0.02;
            game.speed = game.baseSpeed * game.UFOSpeed;
            ui.updateDistanceDisplay();

            if (game.lifes <= 0 && canDie) {
                game.status = "gameover";
            }
        }
    } else if (game.status == "gameover") {
        game.speed *= 0.99;
        ufo.mesh.rotation.z +=
            (-Math.PI / 2 - ufo.mesh.rotation.z) * 0.0002 * deltaTime;
        ufo.mesh.rotation.x += 0.0003 * deltaTime;
        game.UFOFallSpeed *= 1.05;
        // game.UFOFallSpeed *= 1.5;

        ufo.mesh.position.y -= game.UFOFallSpeed * deltaTime;

        // Shrink UFO as it falls
        const shrinkRate = 0.0001 * deltaTime;
        ufo.mesh.scale.x = Math.max(ufo.mesh.scale.x - shrinkRate, 0);
        ufo.mesh.scale.y = Math.max(ufo.mesh.scale.y - shrinkRate, 0);
        ufo.mesh.scale.z = Math.max(ufo.mesh.scale.z - shrinkRate, 0);

        if (ufo.mesh.position.y < -200) {
            ui.showReplay();
            game.status = "waitingReplay";
            audioManager.play("ufo-explode");
        }
    } else if (game.status == "waitingReplay") {
        // nothing to do
        ufo.mesh.scale.set(0.25, 0.25, 0.25);
    }

    if (!game.paused) {
        ufo.tick(deltaTime);

        planet.mesh.rotation.z += game.speed * deltaTime;
        if (planet.mesh.rotation.z > 2 * Math.PI) {
            planet.mesh.rotation.z -= 2 * Math.PI;
        }
        ambientLight.intensity +=
            (0.5 - ambientLight.intensity) * deltaTime * 0.005;

        sceneManager.tick(deltaTime);

        sky.tick(deltaTime);
        planet.tick(deltaTime);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
}

// COINS
function addCoin() {
    game.coins += 1;
    ui.updateCoinsCount(game.coins);

    game.statistics.coinsCollected += 1;
}

function addLife() {
    game.lifes = Math.min(world.maxLifes, game.lifes + 1);
    ui.updateLifesDisplay();
}

function removeLife() {
    game.lifes = Math.max(0, game.lifes - 1);
    ui.updateLifesDisplay();

    game.statistics.lifesLost += 1;
}

function setSideView() {
    game.fpv = false;
    camera.position.set(0, world.UFODefaultHeight, 200);
    camera.setRotationFromEuler(new THREE.Euler(0, 0, 0));
}

function setFollowView() {
    game.fpv = true;
    camera.position.set(-89, ufo.mesh.position.y + 50, 0);
    camera.setRotationFromEuler(
        new THREE.Euler(-1.490248, -1.4124514, -1.48923231)
    );
    camera.updateProjectionMatrix();
}

class UI {
    constructor(onStart) {
        this._elemDistanceCounter = document.getElementById("distValue");
        this._elemReplayMessage = document.getElementById("replayMessage");
        this._elemLevelCounter = document.getElementById("levelValue");
        this._elemLevelCircle = document.getElementById("levelCircleStroke");
        this._elemsLifes = document.querySelectorAll("#lifes img");
        this._elemCoinsCount = document.getElementById("coinsValue");

        document.querySelector("#intro-screen button").onclick = () => {
            document.getElementById("intro-screen").classList.remove("visible");
            document.getElementById("score").classList.add("visible");
            onStart();
        };

        document.addEventListener(
            "keydown",
            this.handleKeyDown.bind(this),
            false
        );
        document.addEventListener("keyup", this.handleKeyUp.bind(this), false);
        document.addEventListener(
            "mousedown",
            this.handleMouseDown.bind(this),
            false
        );
        document.addEventListener(
            "mouseup",
            this.handleMouseUp.bind(this),
            false
        );
        document.addEventListener(
            "mousemove",
            this.handleMouseMove.bind(this),
            false
        );
        document.addEventListener("blur", this.handleBlur.bind(this), false);

        document.oncontextmenu = document.body.oncontextmenu = function () {
            return false;
        };

        window.addEventListener(
            "resize",
            this.handleWindowResize.bind(this),
            false
        );

        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.mousePos = { x: 0, y: 0 };
        this.canvas = document.getElementById("threejs-canvas");

        this.mouseButtons = [false, false, false];
        this.keysDown = {};

        this._resizeListeners = [];
    }

    onResize(callback) {
        this._resizeListeners.push(callback);
    }

    handleWindowResize(event) {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        for (const listener of this._resizeListeners) {
            listener();
        }
    }

    handleMouseMove(event) {
        var tx = -1 + (event.clientX / this.width) * 2;
        var ty = 1 - (event.clientY / this.height) * 2;
        this.mousePos = { x: tx, y: ty };
    }

    handleTouchMove(event) {
        event.preventDefault();
        var tx = -1 + (event.touches[0].pageX / this.width) * 2;
        var ty = 1 - (event.touches[0].pageY / this.height) * 2;
        this.mousePos = { x: tx, y: ty };
    }

    handleMouseDown(event) {
        this.mouseButtons[event.button] = true;

        if (event.button === 1 && game.status === "playing") {
            ufo.shoot();
        }
    }

    handleKeyDown(event) {
        this.keysDown[event.code] = true;
        if (event.code === "KeyP") {
            game.paused = !game.paused;
        }
        if (event.code === "Space") {
            ufo.shoot();
        }
        if (event.code === "Enter") {
            if (game.fpv) {
                setSideView();
            } else {
                setFollowView();
            }
        }
    }

    handleKeyUp(event) {
        this.keysDown[event.code] = false;
    }

    handleMouseUp(event) {
        this.mouseButtons[event.button] = false;
        event.preventDefault();

        if (game && game.status == "waitingReplay") {
            resetMap();
            ui.informNextLevel(1);
            game.paused = false;
            planet.updateColor();
            planet2.updateColor();

            ui.updateDistanceDisplay();
            ui.updateLevelCount();
            ui.updateLifesDisplay();
            ui.updateCoinsCount();

            ui.hideReplay();
        }
    }

    handleBlur(event) {
        this.mouseButtons = [false, false, false];
    }

    showReplay() {
        this._elemReplayMessage.style.display = "block";
    }

    hideReplay() {
        this._elemReplayMessage.style.display = "none";
    }

    updateLevelCount() {
        this._elemLevelCounter.innerText = game.level;
    }

    updateCoinsCount() {
        this._elemCoinsCount.innerText = game.coins;
    }

    updateDistanceDisplay() {
        this._elemDistanceCounter.innerText = Math.floor(game.distance);
        const d =
            502 *
            (1 -
                (game.distance % world.distanceForLevelUpdate) /
                    world.distanceForLevelUpdate);
        this._elemLevelCircle.setAttribute("stroke-dashoffset", d);
    }

    updateLifesDisplay() {
        for (let i = 0, len = this._elemsLifes.length; i < len; i += 1) {
            const hasThisLife = i < game.lifes;
            const elem = this._elemsLifes[i];
            if (hasThisLife && !elem.classList.contains("visible")) {
                elem.classList.remove("invisible");
                elem.classList.add("visible");
            } else if (!hasThisLife && !elem.classList.contains("invisible")) {
                elem.classList.remove("visible");
                elem.classList.add("invisible");
            }
        }
    }

    informNextLevel(level) {
        const ANIMATION_DURATION = 1.0;

        const elem = document.getElementById("new-level");
        elem.style.visibility = "visible";
        elem.style.animationDuration =
            Math.round(ANIMATION_DURATION * 1000) + "ms";
        elem.children[1].innerText = level;
        elem.classList.add("animating");
        setTimeout(() => {
            document.getElementById("new-level").style.visibility = "hidden";
            elem.classList.remove("animating");
        }, 1000);
    }

    showScoreScreen() {
        const elemScreen = document.getElementById("score-screen");

        // make visible
        elemScreen.classList.add("visible");

        // fill in statistics
        document.getElementById("score-coins-collected").innerText =
            game.statistics.coinsCollected;
        document.getElementById("score-coins-total").innerText =
            game.statistics.coinsSpawned;
        document.getElementById("score-enemies-killed").innerText =
            game.statistics.enemiesKilled;
        document.getElementById("score-enemies-total").innerText =
            game.statistics.enemiesSpawned;
        document.getElementById("score-shots-fired").innerText =
            game.statistics.shotsFired;
        document.getElementById("score-lifes-lost").innerText =
            game.statistics.lifesLost;
    }

    showError(message) {
        document.getElementById("error").style.visibility = "visible";
        document.getElementById("error-message").innerText = message;
    }
}
let ui;

function createWorld() {
    world = {
        initSpeed: 0.00035,
        incrementSpeedByTime: 0.0000025,
        incrementSpeedByLevel: 0.000005,
        distanceForSpeedUpdate: 100,
        ratioSpeedDistance: 50,

        simpleGunLevelDrop: 1.1,
        doubleGunLevelDrop: 2.3,
        betterGunLevelDrop: 3.5,

        maxLifes: 3,
        pauseLifeSpawn: 400,

        levelCount: 8,
        distanceForLevelUpdate: 1000,

        UFODefaultHeight: 100,
        UFOAmpHeight: 80,
        UFOAmpWidth: 75,
        UFOMoveSensivity: 0.005,
        UFORotXSensivity: 0.0008,
        UFORotZSensivity: 0.0004,
        UFOMinSpeed: 1.2,
        UFOMaxSpeed: 1.6,

        planetRadius: 600,
        planetLength: 800,
        craterMinAmp: 5,
        craterMaxAmp: 20,
        craterMinSpeed: 0.001,
        craterMaxSpeed: 0.003,

        cameraSensivity: 0.002,

        coinDistanceTolerance: 15,
        coinsSpeed: 0.5,
        distanceForCoinsSpawn: 50,

        collectibleDistanceTolerance: 15,
        collectiblesSpeed: 0.6,

        enemyDistanceTolerance: 10,
        enemiesSpeed: 0.6,
        distanceForEnemiesSpawn: 50,
    };

    // create the world
    createScene();
    createPlanet();
    createSky();
    createLights();
    createUFO();

    resetMap();
}

function resetMap() {
    game = {
        status: "playing",

        speed: 0,
        paused: false,
        baseSpeed: 0.00035,
        targetBaseSpeed: 0.00035,
        speedLastUpdate: 0,

        distance: 0,

        coins: 0,
        fpv: false,

        // gun spawning
        spawnedSimpleGun: false,
        spawnedDoubleGun: false,
        spawnedBetterGun: false,

        lastLifeSpawn: 0,
        lifes: world.maxLifes,

        level: 1,
        levelLastUpdate: 0,

        UFOFallSpeed: 0.001,
        UFOSpeed: 0,
        UFOCollisionDisplacementX: 0,
        UFOCollisionSpeedX: 0,
        UFOCollisionDisplacementY: 0,
        UFOCollisionSpeedY: 0,

        coinLastSpawn: 0,
        enemyLastSpawn: 0,

        statistics: {
            coinsCollected: 0,
            coinsSpawned: 0,
            enemiesKilled: 0,
            enemiesSpawned: 0,
            shotsFired: 0,
            lifesLost: 0,
        },
    };

    // update ui
    ui.updateDistanceDisplay();
    ui.updateLevelCount();
    ui.updateLifesDisplay();
    ui.updateCoinsCount();

    sceneManager.clear();

    planet.updateColor();
    planet2.updateColor();

    setSideView();

    ufo.equipWeapon(null);
}

let soundPlaying = false;

function startMap() {
    if (!soundPlaying) {
        audioManager.play("ufo-sound", { loop: true, volume: 0.5 });
        audioManager.play("bg", { loop: true, volume: 0.5 });

        soundPlaying = true;
    }

    createWorld();
    loop();

    ui.informNextLevel(1);
    game.paused = false;
}

function onWebsiteLoaded(event) {
    // load audio
    audioManager.load("bg", null, "/audio/bg.mp3");
    audioManager.load("ufo-sound", null, "/audio/ufo-sound.mp3");

    audioManager.load("orb-1", "orb", "/audio/orb-1.mp3");
    audioManager.load("orb-2", "orb", "/audio/orb-2.mp3");
    audioManager.load("orb-3", "orb", "/audio/orb-3.mp3");

    audioManager.load("ufo-crash-1", "ufo-crash", "/audio/ufo-crash-1.mp3");
    audioManager.load("ufo-crash-2", "ufo-crash", "/audio/ufo-crash-2.mp3");
    audioManager.load("ufo-crash-3", "ufo-crash", "/audio/ufo-crash-3.mp3");

    audioManager.load("laser-soft", "laser-soft", "/audio/laser-soft.mp3");

    audioManager.load("laser-hard", "laser-hard", "/audio/laser-hard.mp3");

    audioManager.load(
        "bullet-impact",
        "bullet-impact",
        "/audio/bullet-impact-rock.mp3"
    );

    audioManager.load("ufo-explode", "ufo-explode", "/audio/ufo-explode.mp3");
    audioManager.load(
        "rock-shatter-1",
        "rock-shatter",
        "/audio/rock-shatter-1.mp3"
    );
    audioManager.load(
        "rock-shatter-2",
        "rock-shatter",
        "/audio/rock-shatter-2.mp3"
    );

    // load models
    modelManager.load("heart");

    ui = new UI(startMap);
    loadingProgressManager.catch((err) => {
        ui.showError(err.message);
    });
}

window.addEventListener("load", onWebsiteLoaded, false);
