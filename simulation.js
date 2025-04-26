// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x111111); // Darker background
document.body.appendChild(renderer.domElement);

// Camera controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
camera.position.set(0, 30, 30);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.update();

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

// Add hemisphere light for more natural lighting
const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5);
scene.add(hemisphereLight);

// Goal marker
let goalPosition = new THREE.Vector3(0, 0, 0);
const goalGeometry = new THREE.SphereGeometry(0.5, 16, 16);
const goalMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffff00,
    transparent: true,
    opacity: 0.5
});
const goalMarker = new THREE.Mesh(goalGeometry, goalMaterial);
goalMarker.visible = false;
scene.add(goalMarker);

// Environment setup
const floorSize = 50; // Increased floor size
const floorGeometry = new THREE.PlaneGeometry(floorSize, floorSize);
const floorMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x808080,
    side: THREE.DoubleSide
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Grid helper
const gridHelper = new THREE.GridHelper(floorSize, 20);
scene.add(gridHelper);

// Obstacles
const obstacles = [];
const obstacleCount = 8; // Increased number of obstacles
const obstacleTypes = [
    { type: 'box', size: 2, color: 0xff0000 },
    { type: 'cylinder', radius: 1, height: 3, color: 0x00ff00 },
    { type: 'sphere', radius: 1.5, color: 0x0000ff }
];

function createObstacle(type, position) {
    let geometry, material, mesh;
    
    switch(type.type) {
        case 'box':
            geometry = new THREE.BoxGeometry(type.size, type.size, type.size);
            break;
        case 'cylinder':
            geometry = new THREE.CylinderGeometry(type.radius, type.radius, type.height, 16);
            break;
        case 'sphere':
            geometry = new THREE.SphereGeometry(type.radius, 16, 16);
            break;
    }
    
    material = new THREE.MeshStandardMaterial({ color: type.color });
    mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.position.y = type.type === 'box' ? type.size/2 : 
                     type.type === 'cylinder' ? type.height/2 : 
                     type.radius;
    
    return mesh;
}

// Place obstacles with better distribution
for (let i = 0; i < obstacleCount; i++) {
    const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    const position = new THREE.Vector3(
        (Math.random() - 0.5) * (floorSize - 4),
        0,
        (Math.random() - 0.5) * (floorSize - 4)
    );
    
    const obstacle = createObstacle(type, position);
    obstacles.push(obstacle);
    scene.add(obstacle);
}

// Particle system for trails
class ParticleTrail {
    constructor(robot) {
        this.robot = robot;
        this.particles = [];
        this.maxParticles = 30; // Increased for smoother trails
        this.particleLifetime = 3.0; // Increased lifetime
        this.particleSize = 0.2;
        
        // Create particle geometry and material
        this.particleGeometry = new THREE.SphereGeometry(this.particleSize, 8, 8);
        this.particleMaterial = new THREE.MeshBasicMaterial({
            color: robot.color,
            transparent: true,
            opacity: 0.8
        });
        
        // Create point light for glow effect
        this.light = new THREE.PointLight(robot.color, 1, 3);
        this.light.position.copy(robot.position);
        scene.add(this.light);
    }
    
    update(deltaTime) {
        // Add new particle at robot's position
        if (this.particles.length < this.maxParticles) {
            const particle = new THREE.Mesh(this.particleGeometry, this.particleMaterial.clone());
            particle.position.copy(this.robot.position);
            particle.userData = {
                lifetime: this.particleLifetime,
                initialOpacity: 0.8
            };
            this.particles.push(particle);
            scene.add(particle);
        }
        
        // Update existing particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.userData.lifetime -= deltaTime;
            
            if (particle.userData.lifetime <= 0) {
                scene.remove(particle);
                this.particles.splice(i, 1);
            } else {
                // Fade out particle
                const progress = particle.userData.lifetime / this.particleLifetime;
                particle.material.opacity = particle.userData.initialOpacity * progress;
                
                // Add slight upward drift
                particle.position.y += deltaTime * 0.1;
            }
        }
        
        // Update light position and intensity
        this.light.position.copy(this.robot.position);
        this.light.intensity = 0.5 + Math.random() * 0.5;
    }
    
    dispose() {
        this.particles.forEach(particle => scene.remove(particle));
        scene.remove(this.light);
    }
}

// Robot class
class Robot {
    constructor() {
        // Create robot body parts
        const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.8, 16);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        
        // Create robot head
        const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const headMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });
        this.head = new THREE.Mesh(headGeometry, headMaterial);
        this.head.position.y = 0.6;
        
        // Create robot wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        
        this.wheels = [
            new THREE.Mesh(wheelGeometry, wheelMaterial),
            new THREE.Mesh(wheelGeometry, wheelMaterial),
            new THREE.Mesh(wheelGeometry, wheelMaterial),
            new THREE.Mesh(wheelGeometry, wheelMaterial)
        ];
        
        // Position wheels
        this.wheels[0].position.set(0.3, -0.4, 0.3);
        this.wheels[1].position.set(-0.3, -0.4, 0.3);
        this.wheels[2].position.set(0.3, -0.4, -0.3);
        this.wheels[3].position.set(-0.3, -0.4, -0.3);
        
        // Rotate wheels to correct orientation
        this.wheels.forEach(wheel => wheel.rotation.x = Math.PI / 2);
        
        // Create robot group
        this.mesh = new THREE.Group();
        this.mesh.add(this.body);
        this.mesh.add(this.head);
        this.wheels.forEach(wheel => this.mesh.add(wheel));
        
        // Random initial position
        this.position = new THREE.Vector3(
            (Math.random() - 0.5) * (floorSize - 4),
            0.4,
            (Math.random() - 0.5) * (floorSize - 4)
        );
        this.mesh.position.copy(this.position);
        
        // Movement properties
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            0,
            (Math.random() - 0.5) * 0.1
        );
        this.maxSpeed = 0.2; // Slightly faster for goal seeking
        this.maxForce = 0.03;
        
        // Add unique color for each robot
        const hue = Math.random();
        this.color = new THREE.Color().setHSL(hue, 1.0, 0.5);
        
        // Apply emissive material to robot parts
        const emissiveMaterial = new THREE.MeshStandardMaterial({
            color: this.color,
            emissive: this.color,
            emissiveIntensity: 0.5
        });
        
        this.body.material = emissiveMaterial.clone();
        this.head.material = new THREE.MeshStandardMaterial({
            color: this.color,
            emissive: this.color,
            emissiveIntensity: 0.8
        });
        
        // Create particle trail
        this.trail = new ParticleTrail(this);
        
        // Goal seeking properties
        this.goalWeight = 0.5;
        
        scene.add(this.mesh);
    }

    update(robots) {
        // Separation
        const separation = this.separate(robots);
        // Cohesion
        const cohesion = this.cohere(robots);
        // Alignment
        const alignment = this.align(robots);
        // Obstacle avoidance
        const avoidance = this.avoidObstacles();
        // Goal seeking
        const goalSeek = this.seek(goalPosition).multiplyScalar(this.goalWeight);

        // Apply force
        this.velocity.add(separation.multiplyScalar(1.5));
        this.velocity.add(cohesion.multiplyScalar(0.5));
        this.velocity.add(alignment.multiplyScalar(0.5));
        this.velocity.add(avoidance.multiplyScalar(2.0));
        this.velocity.add(goalSeek);

        // Limit velocity
        if (this.velocity.length() > this.maxSpeed) {
            this.velocity.normalize().multiplyScalar(this.maxSpeed);
        }

        // Update position
        this.position.add(this.velocity);
        
        // Keep within bounds
        const halfFloor = floorSize / 2;
        this.position.x = Math.max(-halfFloor + 2, Math.min(halfFloor - 2, this.position.x));
        this.position.z = Math.max(-halfFloor + 2, Math.min(halfFloor - 2, this.position.z));
        this.position.y = 0.4;

        // Update mesh position
        this.mesh.position.copy(this.position);

        // Update rotation to face movement direction
        if (this.velocity.length() > 0) {
            this.mesh.rotation.y = Math.atan2(this.velocity.x, this.velocity.z);
        }
        
        // Rotate wheels based on movement
        const wheelRotationSpeed = this.velocity.length() * 5;
        this.wheels.forEach(wheel => {
            wheel.rotation.z += wheelRotationSpeed;
        });
        
        // Update particle trail
        this.trail.update(0.016);
    }

    separate(robots) {
        const desiredSeparation = 3.0;
        const steer = new THREE.Vector3();
        let count = 0;

        for (const other of robots) {
            if (other !== this) {
                const d = this.position.distanceTo(other.position);
                if (d < desiredSeparation) {
                    const diff = new THREE.Vector3().subVectors(this.position, other.position);
                    diff.normalize();
                    diff.divideScalar(d);
                    steer.add(diff);
                    count++;
                }
            }
        }

        if (count > 0) {
            steer.divideScalar(count);
            if (steer.length() > 0) {
                steer.normalize().multiplyScalar(this.maxSpeed).sub(this.velocity);
                if (steer.length() > this.maxForce) {
                    steer.normalize().multiplyScalar(this.maxForce);
                }
            }
        }

        return steer;
    }

    cohere(robots) {
        const neighborDist = 8.0;
        const sum = new THREE.Vector3();
        let count = 0;

        for (const other of robots) {
            if (other !== this) {
                const d = this.position.distanceTo(other.position);
                if (d < neighborDist) {
                    sum.add(other.position);
                    count++;
                }
            }
        }

        if (count > 0) {
            sum.divideScalar(count);
            return this.seek(sum);
        }

        return new THREE.Vector3();
    }

    align(robots) {
        const neighborDist = 8.0;
        const sum = new THREE.Vector3();
        let count = 0;

        for (const other of robots) {
            if (other !== this) {
                const d = this.position.distanceTo(other.position);
                if (d < neighborDist) {
                    sum.add(other.velocity);
                    count++;
                }
            }
        }

        if (count > 0) {
            sum.divideScalar(count);
            sum.normalize().multiplyScalar(this.maxSpeed);
            const steer = new THREE.Vector3().subVectors(sum, this.velocity);
            if (steer.length() > this.maxForce) {
                steer.normalize().multiplyScalar(this.maxForce);
            }
            return steer;
        }

        return new THREE.Vector3();
    }

    seek(target) {
        const desired = new THREE.Vector3().subVectors(target, this.position);
        desired.normalize().multiplyScalar(this.maxSpeed);
        const steer = new THREE.Vector3().subVectors(desired, this.velocity);
        if (steer.length() > this.maxForce) {
            steer.normalize().multiplyScalar(this.maxForce);
        }
        return steer;
    }

    avoidObstacles() {
        const avoidRadius = 4.0;
        const steer = new THREE.Vector3();
        let count = 0;

        for (const obstacle of obstacles) {
            const d = this.position.distanceTo(obstacle.position);
            if (d < avoidRadius) {
                const diff = new THREE.Vector3().subVectors(this.position, obstacle.position);
                diff.normalize();
                diff.divideScalar(d);
                steer.add(diff);
                count++;
            }
        }

        if (count > 0) {
            steer.divideScalar(count);
            if (steer.length() > 0) {
                steer.normalize().multiplyScalar(this.maxSpeed).sub(this.velocity);
                if (steer.length() > this.maxForce) {
                    steer.normalize().multiplyScalar(this.maxForce);
                }
            }
        }

        return steer;
    }

    dispose() {
        this.trail.dispose();
        scene.remove(this.mesh);
    }
}

// Create robots
let robots = [];
let animationId = null;
let isRunning = false;

// UI Controls
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const addRobotBtn = document.getElementById('addRobotBtn');
const robotCountInput = document.getElementById('robotCount');

function initializeRobots(count) {
    // Remove existing robots and their trails
    robots.forEach(robot => robot.dispose());
    robots = [];
    
    // Create new robots
    for (let i = 0; i < count; i++) {
        robots.push(new Robot());
    }
}

function startSimulation() {
    if (!isRunning) {
        isRunning = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        animate();
    }
}

function stopSimulation() {
    if (isRunning) {
        isRunning = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
    }
}

// Add click handler for goal setting
function onMouseClick(event) {
    // Calculate mouse position in normalized device coordinates
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    
    // Create raycaster
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    // Calculate intersection with floor
    const intersects = raycaster.intersectObject(floor);
    
    if (intersects.length > 0) {
        // Update goal position
        goalPosition.copy(intersects[0].point);
        goalPosition.y = 0.4; // Same height as robots
        
        // Update goal marker
        goalMarker.position.copy(goalPosition);
        goalMarker.visible = true;
        
        // Add pulse animation to goal marker
        goalMarker.scale.set(1, 1, 1);
        const pulse = () => {
            goalMarker.scale.multiplyScalar(0.95);
            if (goalMarker.scale.x > 0.1) {
                requestAnimationFrame(pulse);
            }
        };
        pulse();
    }
}

// Add event listener for mouse clicks
renderer.domElement.addEventListener('click', onMouseClick);

// Animation loop
let lastTime = 0;
function animate(currentTime) {
    if (!isRunning) return;
    
    animationId = requestAnimationFrame(animate);
    
    // Calculate deltaTime
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    // Update robots
    for (const robot of robots) {
        robot.update(robots);
    }
    
    // Update camera controls
    controls.update();
    
    // Render scene
    renderer.render(scene, camera);
}

// Event listeners
startBtn.addEventListener('click', startSimulation);
stopBtn.addEventListener('click', stopSimulation);
addRobotBtn.addEventListener('click', () => {
    const count = parseInt(robotCountInput.value);
    if (count >= 3 && count <= 7) {
        initializeRobots(count);
        if (isRunning) {
            stopSimulation();
            startSimulation();
        }
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize with default number of robots
initializeRobots(3); 
