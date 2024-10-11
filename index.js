import * as THREE from 'three';
import { GLTFLoader } from './extra-libraries/Common/examples/jsm/loaders/GLTFLoader.js';
import { PointerLockControls } from './extra-libraries/Common/examples/jsm/controls/PointerLockControls.js';

let renderer, canvas;
let currentLevel, levelOne, levelTwo;
let paused = true;
let raycaster;

class level {
    scene;
    camera;
    controls;
    
    objects;
    objectCenters;

    moveForward = false;
    moveBackward = false;
    moveLeft = false;
    moveRight = false;

    canJump = true;
    fall = 0;
    fallSpeed;
    jumpSpeed;

    measurement;
    unit;
    heightOffset;

    base;

    constructor(background, fallSpeed, jumpSpeed, measurement, unit, heightOffset) {
        const fov = 70;
        const aspect = 2;
        const near = 0.1;
        const far = 100;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.camera.position.set(0, 3, 0);

        // Load a background texture (environment map) as a 360 panorama
        new THREE.TextureLoader().load( background, ( texture ) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            this.scene.background = texture;
        });

        this.controls = new PointerLockControls(this.camera, document.body);
        this.controls.lookSpeed = 0.1;
        this.scene.add(this.controls.getObject());

        this.objects = [];
        this.objectCenters = [];

        this.fallSpeed = fallSpeed;
        this.jumpSpeed = jumpSpeed;

        // Information for Heads Up Display
        this.measurement = measurement;
        this.unit = unit;
        this.heightOffset = heightOffset;
    }

    reset() {
        this.camera.position.set(0, 5, 0);
    }

    addAmbientLight(color, intensity) {
        let ambient = new THREE.AmbientLight(color, intensity );
        this.scene.add(ambient);
    }

    addHemisphereLight(skyColor, groundColor, intensity) {
        let hemisphere = new THREE.HemisphereLight(skyColor, groundColor, intensity);
        this.scene.add(hemisphere);
    }

    // Adds point lights at the specified positions
    addPointLights(locations, color, intensity, size) {
        let geometry = new THREE.SphereGeometry(size, 32, 16);
        let material = new THREE.MeshBasicMaterial( {color: color} );

        for (let x in locations) {
            let sphere = new THREE.Mesh(geometry, material);
            let pointLight = new THREE.PointLight(color, intensity);
            pointLight.position.set(locations[x][0],locations[x][1],locations[x][2]);
            this.scene.add(pointLight);
    
            sphere.position.set(locations[x][0],locations[x][1],locations[x][2]);
            this.scene.add(sphere);
        }
    }

    // Load the base object for the level
    addBase(model, shadows) {
        new GLTFLoader().load( model, ( gltf ) => {
            gltf.scene.scale.set(15,15,15);
            this.scene.add(gltf.scene);
            this.objects.push(gltf.scene);
            this.objectCenters.push([0,0,0]);

            gltf.scene.traverse( function( node ) {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });

            this.base = gltf.scene;
            }, undefined, function ( error ) {
                console.error( error );
            }
        );
    }

    // Load 30 objects and position them randomly around the scene
    addObjects(model) {
        for ( let i = 0; i < 30; i++ ) {
            new GLTFLoader().load( model, ( gltf ) => {
    
                let xPos, yPos, zPos;
                let overlapping;

                do {
                    overlapping = false;
                    
                    xPos = (Math.random() - 0.5) * 32;
                    yPos = 5 + Math.random() * 40;
                    zPos = (Math.random() - 0.5) * 32;

                    // Ensure the objects are not too closely packed
                    for (let i=0; i<this.objectCenters.length; i++) {
                        if (Math.abs(xPos - this.objectCenters[i][0]) < 10 &&
                            Math.abs(zPos - this.objectCenters[i][2]) < 10 &&
                            Math.abs(yPos - this.objectCenters[i][1]) < 2) {
                                overlapping = true;
                                break;
                        }
                    }
                } while (overlapping === true);
                
                gltf.scene.position.set(xPos, yPos, zPos);
                gltf.scene.scale.set(3,3,3);
                gltf.scene.rotation.y = Math.random() * 2 * Math.PI; // Give objects random rotation on z axis
                this.objectCenters.push([xPos, yPos, zPos]);
        
                // Add object to list of objects for collision detection
                this.objects.push(gltf.scene);
                this.scene.add(gltf.scene);
        
            }, undefined, function ( error ) {
                    console.error( error );
            });
        }
    }
}

function main() {
    canvas = document.getElementById( "gl-canvas" );
    renderer = new THREE.WebGLRenderer({canvas, antialias: true});
    renderer.shadowMap.enabled = true;

    // Make Level 1
    levelOne = new level('./assets/images/level_one_environment_map.png', 0.05, 1, "Altitude: ", ",000 feet", 3);
    levelOne.addObjects('./assets/models/A400m.glb');
    levelOne.addBase('./assets/models/helipad.glb');
    levelOne.addAmbientLight(0x404040, 1);
    levelOne.addHemisphereLight(0xaaccff, 0x729cbc, 1);
    levelOne.scene.fog = new THREE.Fog( 0xdddddd, 0, 50 ); // Sky effect
    levelOne.addPointLights([[16,0.2,-16],[16,0.2,16],[-16,0.2,16],[-16,0.2,-16]], 0x00ff00, 10, 0.4);

    // Make Level 2
    levelTwo = new level('./assets/images/level_two_environment_map.png', 0.025, 0.75, "Depth: ", " metres", 50);
    levelTwo.addObjects('./assets/models/submarine.glb');
    levelTwo.addBase('./assets/models/sand.glb');
    levelTwo.addAmbientLight(0x000040, 1);
    levelTwo.addHemisphereLight(0x00ffff, 0x0000ff, 1);
    levelTwo.scene.fog = new THREE.Fog( 0x0000cc, 0, 50 ); // Underwater effect
    levelTwo.addPointLights([[-0.2,3.6,-7.8],[2.25,3.5,-6.55]], 0xffff00, 15, 0.2);

    currentLevel = levelOne;

    // If a button is pressed, set this level to be the current level, and lock the controls
    document.getElementById('levelOneButton').addEventListener("click", function() {
        currentLevel = levelOne;
        if(currentLevel.base) {
            currentLevel.controls.lock();
        }
    });

    document.getElementById('levelTwoButton').addEventListener("click", function() {
        currentLevel = levelTwo;
        if(currentLevel.base) {
            currentLevel.controls.lock();
        }
    });

    // Hide the menu if controls are locked
    currentLevel.controls.addEventListener('lock', function() {
        currentLevel.controls.connect();
        document.getElementById('blurred').style.display = 'none';
        paused = false;
    });

    // Show menu when paused
    currentLevel.controls.addEventListener('unlock', function() {
        document.getElementById('blurred').style.display = 'block';
        paused = true;

    });

    raycaster = new THREE.Raycaster( new THREE.Vector3(), new THREE.Vector3( 0, -1, 0 ), 0, 3 );

    // Game controls
    const onKeyDown = function ( event ) {
        switch ( event.code ) {
            case 'ArrowUp':
            case 'KeyW':
                currentLevel.moveForward = true;
                break;

            case 'ArrowLeft':
            case 'KeyA':
                currentLevel.moveLeft = true;
                break;

            case 'ArrowDown':
            case 'KeyS':
                currentLevel.moveBackward = true;
                break;

            case 'ArrowRight':
            case 'KeyD':
                currentLevel.moveRight = true;
                break;

            case 'Space':
                if ( currentLevel.canJump === true ) {
                    currentLevel.fall = currentLevel.jumpSpeed;
                    currentLevel.canJump = false;
                }
                break;             
        }
    };

    const onKeyUp = function ( event ) {
        switch ( event.code ) {
            case 'ArrowUp':
            case 'KeyW':
                currentLevel.moveForward = false;
                break;

            case 'ArrowLeft':
            case 'KeyA':
                currentLevel.moveLeft = false;
                break;

            case 'ArrowDown':
            case 'KeyS':
                currentLevel.moveBackward = false;
                break;

            case 'ArrowRight':
            case 'KeyD':
                currentLevel.moveRight = false;
                break;
        }
    };

    document.addEventListener( 'keydown', onKeyDown );
    document.addEventListener( 'keyup', onKeyUp );

    requestAnimationFrame(render);
}

// Recalculate the camera properties if the window is resized
function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;

    if (needResize) {
      renderer.setSize(width, height, false);
    }
}

// Called every frame
function render() {
        resizeRendererToDisplaySize(renderer);

        if (!paused) {
            raycaster.ray.origin.copy( currentLevel.controls.getObject().position );

            // Cast ray to detect if on an object
            const intersections = raycaster.intersectObjects(currentLevel.objects, true);
            const onObject = intersections.length > 0;

            {
                const canvas = renderer.domElement;
                currentLevel.camera.aspect = canvas.clientWidth / canvas.clientHeight;
                currentLevel.camera.updateProjectionMatrix();
            }

            // Fall speed depends on the level (slower in water)
            currentLevel.fall -= currentLevel.fallSpeed;

            if (currentLevel.moveForward) {
                currentLevel.controls.moveForward(0.1)
            }
            if (currentLevel.moveBackward) {
                currentLevel.controls.moveForward(-0.1)
            }
            if (currentLevel.moveLeft) {
                currentLevel.controls.moveRight(-0.1)
            }
            if (currentLevel.moveRight) {
                currentLevel.controls.moveRight(0.1)
            }

            // Can jump if on object
            if (onObject === true ) {
                currentLevel.fall = Math.max( 0, currentLevel.fall);
                currentLevel.canJump = true;

                // Only update score if on an object at that height
                let height = Math.round(currentLevel.controls.getObject().position.y);
                document.getElementById('height').textContent = currentLevel.measurement + (height - currentLevel.heightOffset) + currentLevel.unit;
            }
            else {
                currentLevel.canJump = false; // Stops 'double jumps'
            }

            currentLevel.controls.getObject().position.y += (currentLevel.fall);

            // Reset the game if player has fallen off the platform
            if (currentLevel.controls.getObject().position.y < -100) {
                currentLevel.reset();
            }
        }
        
        renderer.render(currentLevel.scene, currentLevel.camera);
        requestAnimationFrame(render);
    }

main();