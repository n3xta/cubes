// DOM 
var playButton;
var tempoSlider;
var randomButton;
var modal;
var closeBtn;
var timeSlider;
var pitchSlider;
var timeValue;
var pitchValue;
var addNoteBtn;

// Sequencer
var bpm = 80;
var numberOfBars = 4;
var beatsPerBar = 4;
var nSteps = numberOfBars * beatsPerBar;
var beats = 0;

// Try changing the number of octaves to get more or less notes to choose from
var numberOfOctaves = 4;
var nTracks = 7 * numberOfOctaves;
var baseOctave = 1;
var currentStep = 0;
var cells = [];

// Sound
var noteNames = ["C", "D", "E", "F", "G", "A", "B"];
var player = new Tone.Sampler(
    {
      "A1" : "samples/casio/A1.mp3",
      "C2" : "samples/casio/C2.mp3",
      "E2" : "samples/casio/E2.mp3",
      "G2" : "samples/casio/G2.mp3"
    }
);
player.toDestination();
Tone.Transport.scheduleRepeat(onBeat, "16n");
updateTempo(bpm);

// Three.js variables
var scene, camera, renderer, controls;
var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();
var cubes = [];
var activeCubes = [];
var originalMaterials = [];
var floor;

function setup() {
  // DOM Elements
  playButton = createButton("<i class='fas fa-play'></i>");
  playButton.parent('play-button');
  playButton.addClass('play-btn');
  playButton.mouseClicked(togglePlay);
  
  tempoSlider = createSlider(20, 240, 80);
  tempoSlider.parent('tempo-slider');
  tempoSlider.input(updateTempo);
  updateTempo(); // 初始化显示
  
  randomButton = select('#random-btn');
  randomButton.mouseClicked(addRandomNote);
  
  // Modal elements
  modal = select('#note-modal');
  if (!modal) {
    console.error("Could not find modal element #note-modal");
  }
  
  closeBtn = select('.close-btn');
  if (!closeBtn) {
    console.error("Could not find close button .close-btn");
  } else {
    closeBtn.mouseClicked(closeModal);
  }
  
  timeSlider = select('#time-slider');
  if (!timeSlider) {
    console.error("Could not find time slider #time-slider");
  }
  
  pitchSlider = select('#pitch-slider');
  if (!pitchSlider) {
    console.error("Could not find pitch slider #pitch-slider");
  }
  
  timeValue = select('#time-value');
  if (!timeValue) {
    console.error("Could not find time value display #time-value");
  }
  
  pitchValue = select('#pitch-value');
  if (!pitchValue) {
    console.error("Could not find pitch value display #pitch-value");
  }
  
  addNoteBtn = select('#add-note-btn');
  if (!addNoteBtn) {
    console.error("Could not find add note button #add-note-btn");
  } else {
    addNoteBtn.mouseClicked(addNoteFromModal);
  }
  
  timeSlider.input(updateTimeValue);
  pitchSlider.input(updatePitchValue);
  
  // Initialize keyboard visual in the modal
  createKeyboardVisual();
  
  // 添加键盘空格键控制播放/暂停
  window.addEventListener('keydown', function(e) {
    if (e.code === 'Space') {
      e.preventDefault(); // 防止页面滚动
      togglePlay();
    }
    
    // ESC key to close modal
    if (e.code === 'Escape' && modal.style('display') === 'flex') {
      closeModal();
    }
  });
  
  // Visuals
  var p5Canvas = createCanvas(windowWidth * 0.8, windowHeight * 0.65);
  p5Canvas.parent('p5-container');
  
  // Initialize cells array
  for(var track = 0; track < nTracks; track++){
    cells[track] = [];
    for(var step = 0; step < nSteps; step++){
        cells[track][step] = 0;
    }
  }
  
  // Initialize Three.js
  initThree();
  
  // Add a few random notes at startup for visual appeal
  for (let i = 0; i < 5; i++) {
    addRandomNote();
  }
}

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  
  // Create camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(15, 12, 18);
  camera.lookAt(0, 0, 0);
  
  // Create renderer
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  const container = document.getElementById('three-container');
  container.appendChild(renderer.domElement);
  
  // Add orbit controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 10;
  controls.maxDistance = 50;
  controls.maxPolarAngle = Math.PI / 2;
  
  // Clean up old event listeners if they exist
  if (renderer.domElement._clickHandler) {
    renderer.domElement.removeEventListener('pointerdown', renderer.domElement._clickHandler);
    renderer.domElement.removeEventListener('pointermove', renderer.domElement._moveHandler);
    renderer.domElement.removeEventListener('pointerup', renderer.domElement._upHandler);
  }
  
  let isDragging = false;
  let pointerDownTime = 0;
  
  // Create the pointer down handler
  renderer.domElement._clickHandler = function(event) {
    event.preventDefault();
    isDragging = false;
    pointerDownTime = Date.now();
  };
  
  // Create the pointer move handler
  renderer.domElement._moveHandler = function(event) {
    if (Date.now() - pointerDownTime > 100) { // If mouse moved after 100ms, consider it a drag
      isDragging = true;
    }
  };
  
  // Create the pointer up handler
  renderer.domElement._upHandler = function(event) {
    event.preventDefault();
    
    // Only process click if it wasn't a drag operation
    if (!isDragging && Date.now() - pointerDownTime < 300) { // Only consider clicks shorter than 300ms
      console.log("Click detected (not drag)");
      
      // Calculate mouse position in normalized coordinates (-1 to +1)
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      console.log("Mouse coordinates:", mouse.x, mouse.y);
      
      // Update the raycaster
      raycaster.setFromCamera(mouse, camera);
      
      // Check for intersections with the floor
      const intersects = raycaster.intersectObject(floor);
      console.log("Floor intersections:", intersects.length);
      
      if (intersects.length > 0) {
        const point = intersects[0].point;
        console.log("Intersection point:", point);
        
        const angle = Math.atan2(point.z, point.x);
        const normalizedAngle = (angle + Math.PI) / (Math.PI * 2);
        const timeStep = Math.floor(normalizedAngle * nSteps);
        console.log("Opening modal with time step:", timeStep);
        
        openModal(timeStep);
      }
    }
  };
  
  // Add the event listeners
  renderer.domElement.addEventListener('pointerdown', renderer.domElement._clickHandler);
  renderer.domElement.addEventListener('pointermove', renderer.domElement._moveHandler);
  renderer.domElement.addEventListener('pointerup', renderer.domElement._upHandler);
  
  // Add lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);
  
  const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.7);
  directionalLight1.position.set(5, 8, 5);
  scene.add(directionalLight1);
  
  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
  directionalLight2.position.set(-5, 3, -5);
  scene.add(directionalLight2);
  
  const pointLight1 = new THREE.PointLight(0xffffff, 0.5, 20);
  pointLight1.position.set(0, 10, 0);
  scene.add(pointLight1);
  
  // Floor
  const floorGeometry = new THREE.CircleGeometry(15, 32);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.9,
    metalness: 0.1,
    emissive: 0x000000
  });
  floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.1;
  scene.add(floor);
  
  // Grid lines
  const gridLines = new THREE.GridHelper(30, 30, 0x333333, 0x222222);
  gridLines.position.y = 0;
  scene.add(gridLines);
  
  // addTimeMarkings();
  
  // Start animation loop
  animate();
}

function addTimeMarkings() {
  // Create time markings in a circle around the floor
  const radius = 15;
  const timeSegments = nSteps;
  
  for (let i = 0; i < timeSegments; i++) {
    const angle = (i / timeSegments) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    
    // Create time marker with varying height for beat emphasis
    const height = i % 4 === 0 ? 1.0 : 0.5; // Taller markers for beats
    const markerGeometry = new THREE.BoxGeometry(0.2, height, 0.2);
    const markerMaterial = new THREE.MeshBasicMaterial({ 
      color: i % 4 === 0 ? 0xFFFFFF : 0x555555 
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    
    marker.position.set(x, height/2, z);
    marker.lookAt(0, 0, 0);
    scene.add(marker);
    
    // Instead of text, create a small platform with color for major beats
    if (i % 4 === 0) {
      const platformGeometry = new THREE.BoxGeometry(0.6, 0.1, 0.6);
      const platformMaterial = new THREE.MeshBasicMaterial({ color: 0x444444 });
      const platform = new THREE.Mesh(platformGeometry, platformMaterial);
      
      platform.position.set(x * 1.05, 0.05, z * 1.05);
      scene.add(platform);
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  
  // Update controls
  if (controls) {
    controls.update();
  }
  
  renderer.render(scene, camera);
}

// Modal functions
function openModal(timeValue) {
  console.log("Opening modal...");
  
  // Get modal elements using vanilla JavaScript
  const modalElement = document.getElementById('note-modal');
  const timeSliderElement = document.getElementById('time-slider');
  
  if (!modalElement || !timeSliderElement) {
    console.error("Modal elements not found!");
    return;
  }
  
  // Set the time slider value
  timeSliderElement.value = timeValue;
  console.log("Time slider value set to:", timeValue);
  
  // Update displays
  updateTimeValue();
  updatePitchValue();
  
  // Show the modal
  modalElement.style.display = 'flex';
  console.log("Modal display style set to flex");
}

function closeModal() {
  modal.style('display', 'none');
}

function updateTimeValue() {
  const time = parseInt(timeSlider.value());
  const bar = Math.floor(time / 4) + 1;
  const beat = (time % 4) + 1;
  timeValue.html(`${bar}.${beat}`);
}

function updatePitchValue() {
  const pitch = parseInt(pitchSlider.value());
  const notePos = (nTracks - 1) - pitch;
  const octave = baseOctave + Math.floor(notePos / 7);
  const noteName = noteNames[notePos % 7];
  
  pitchValue.html(`${noteName}${octave}`);
  
  // Update keyboard visual
  updateKeyboardHighlight(pitch);
}

function createKeyboardVisual() {
  const keyboardVisual = select('.keyboard-visual');
  keyboardVisual.html('');
  
  // Create a visual representation of the keyboard
  for (let i = 0; i < 28; i++) {
    const isBlackKey = [1, 3, 6, 8, 10].includes(i % 12);
    const keyElement = createDiv();
    keyElement.addClass(isBlackKey ? 'piano-key black' : 'piano-key white');
    keyElement.style('display', 'inline-block');
    keyElement.style('height', '100%');
    keyElement.style('width', isBlackKey ? '10px' : '14px');
    keyElement.style('background-color', isBlackKey ? '#333' : '#FFF');
    keyElement.style('border', '1px solid #000');
    keyElement.style('box-sizing', 'border-box');
    keyElement.style('vertical-align', 'top');
    keyElement.attribute('data-index', i);
    
    // Click event to set pitch slider value
    keyElement.mouseClicked(() => {
      pitchSlider.value(i);
      updatePitchValue();
    });
    
    keyboardVisual.child(keyElement);
  }
}

function updateKeyboardHighlight(pitchValue) {
  // Remove highlight from all keys
  selectAll('.piano-key').forEach(key => {
    key.style('box-shadow', 'none');
  });
  
  // Add highlight to selected key
  const keys = selectAll('.piano-key');
  if (keys[pitchValue]) {
    keys[pitchValue].style('box-shadow', '0 0 10px #FFF, 0 0 5px #FFF inset');
  }
}

function addNoteFromModal() {
  const time = parseInt(timeSlider.value());
  const pitch = parseInt(pitchSlider.value());
  
  // Set the cell to 1 (ON)
  cells[pitch][time] = 1;
  
  // Create the cube
  createSingleCube(pitch, time);
  
  // Close the modal
  closeModal();
}

function addRandomNote() {
  // Generate random time step and pitch
  const randomTime = Math.floor(Math.random() * nSteps);
  const randomPitch = Math.floor(Math.random() * nTracks);
  
  // Check if this note position is already occupied
  if (cells[randomPitch][randomTime] === 1) {
    // Try again if position is occupied
    return addRandomNote();
  }
  
  // Set the cell to 1 (ON)
  cells[randomPitch][randomTime] = 1;
  
  // Create the cube
  createSingleCube(randomPitch, randomTime);
}

// Resize event handler
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
  // Update camera
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  
  // Update renderer
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Create cube based on time and pitch
function createSingleCube(track, step) {
  // 计算音符属性
  var notePos = (nTracks - 1) - track;
  var colorIndex = notePos % 7;
  
  // 基于音高决定立方体高度
  const height = 0.5 + (notePos / nTracks) * 3;
  const width = 1.2 - (notePos / nTracks) * 0.7;
  
  // 创建立方体几何体
  const geometry = new THREE.BoxGeometry(width, height, width);
  
  // 创建材质
  const baseColor = new THREE.Color(colors[colorIndex]);
  const material = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.8,
    metalness: 0.1,
    emissive: 0x000000
  });
  
  // 创建网格
  const cube = new THREE.Mesh(geometry, material);
  
  // 计算位置 - 根据时间步骤计算圆上的位置
  const radius = 5 + Math.random() * 3; // 随机半径营造一些变化
  const angle = (step / nSteps) * Math.PI * 2;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const y = height / 2; // 立方体底部在地面上
  
  cube.position.set(x, y, z);
  scene.add(cube);
  
  // 保存引用
  if (!cubes[track]) cubes[track] = [];
  cubes[track][step] = cube;
  activeCubes.push(cube);
  
  // 保存原始材质颜色
  originalMaterials.push({
    cube: cube,
    emissive: new THREE.Color(0x000000),
    color: baseColor
  });
  
  console.log(`创建音符立方体 [${track},${step}]，位置:(${x}, ${y}, ${z})`);
  return cube;
}

// Remove a cube
function removeSingleCube(track, step) {
  const cube = cubes[track][step];
  if (cube) {
    // Remove from scene
    scene.remove(cube);
    
    // Remove from arrays
    const cubeIndex = activeCubes.indexOf(cube);
    if (cubeIndex !== -1) {
      activeCubes.splice(cubeIndex, 1);
    }
    
    const materialIndex = originalMaterials.findIndex(m => m.cube === cube);
    if (materialIndex !== -1) {
      originalMaterials.splice(materialIndex, 1);
    }
    
    // Clear reference
    cubes[track][step] = null;
    
    console.log(`删除音符立方体 [${track},${step}]`);
  }
}

// Animate a cube when it plays
function animateCube(track, step) {
  const cube = cubes[track][step];
  if (cube) {
    // Find the original material for this cube
    const materialData = originalMaterials.find(m => m.cube === cube);
    if (materialData) {
      // 轻微的动画
      const originalY = cube.position.y;
      const jumpHeight = 1.5;
      
      // 简单的跳跃动画
      const frames = 20;
      let frame = 0;
      
      const jumpAnimation = () => {
        if (frame < frames) {
          // 上升和下降的正弦曲线
          const progress = frame / frames;
          const height = Math.sin(progress * Math.PI) * jumpHeight;
          cube.position.y = originalY + height;
          
          frame++;
          requestAnimationFrame(jumpAnimation);
        } else {
          cube.position.y = originalY;
        }
      };
      
      jumpAnimation();
    }
  }
}

function onBeat(time){
  // If the current beat is on, play it
  for(var track = 0; track < nTracks; track++){
    if(cells[track][currentStep] == 1){
      // The bottom track should have the lowest note
      var notePos = (nTracks - 1) - track; 
      var octave = baseOctave + Math.floor(notePos / 7);
      var noteName = noteNames[notePos % 7];
      
      var pitch = noteName + octave;
      player.triggerAttack(pitch, time);
      
      // Animate the corresponding cube
      animateCube(track, currentStep);
    }
  }
  beats++;
  currentStep = beats % nSteps;
}

// Colors for the cubes
var colors = ["#FFFFFF", "#EEEEEE", "#DDDDDD", "#CCCCCC", "#BBBBBB", "#AAAAAA", "#999999"];

// Empty draw function since we don't need p5 rendering anymore
function draw() {}

async function togglePlay() {
  // Start audio context on first click
  if (Tone.context.state !== 'running') {
    await Tone.start();
  }
  
  // 切换播放/暂停状态和按钮图标
  if (Tone.Transport.state === 'started') {
    Tone.Transport.pause();
    playButton.html("<i class='fas fa-play'></i>");
  } else {
    Tone.Transport.start();
    playButton.html("<i class='fas fa-pause'></i>");
  }
}

function updateTempo(){
  let tempoValue = tempoSlider ? tempoSlider.value() : bpm;
  
  // 更新音频引擎的速度
  Tone.Transport.bpm.rampTo(tempoValue, 0.1);
  
  // 更新显示
  document.querySelector('.tempo-value').innerText = tempoValue + " BPM";
}