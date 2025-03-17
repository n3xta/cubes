// DOM 
var playButton;
var tempoSlider;
var numberOfBarsInput;
var beatsPerBarInput;

// Sequencer

// Try changing this number to change the tempo. BPM stands for Beats Per Minute. 
// 60 BPM means we play one beat every second (since there are 60 seconds in a minute)
var bpm = 80;

// Try changing these numbers to change the length and structure of your grid
var numberOfBars = 4;
var beatsPerBar = 4;
var splitBeatsInto = 2;
var nSteps = numberOfBars * beatsPerBar * splitBeatsInto;
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


// Visuals
var t = 30;
var l = 25;
var gridWidth, gridHeight, cellWidth, cellHeight;
var blue;
var colors = ["#df365d", "#f2924d", "#ebd64e", "#97c348", "#4ab4a1", "#4f64d5", "#bd51a6"];

// Three.js variables
var scene, camera, renderer;
var cubes = [];
var activeCubes = [];
var originalMaterials = [];

// 调试变量
var axesHelper;
var gridHelper;
var forceCreateCubes = true;

function setup() {
  // DOM
  playButton = createButton("play");
  playButton.mouseClicked(togglePlay);
  createElement("span", "tempo");
  tempoSlider = createSlider(20, 240, 60);
  tempoSlider.input(updateTempo);
  
  // Visuals
  var p5Canvas = createCanvas(600, 300);
  p5Canvas.parent('p5-container');
  gridWidth = width - 2*l;
  gridHeight = height - 2*t;
  cellWidth = gridWidth / nSteps;
  cellHeight = gridHeight / nTracks;
  blue =  color(178, 223, 247);
  
  // Sequencer
  // Initialize all sequencer cells.ON: 1. OFF: 0.
  for(var track = 0; track < nTracks; track++){
    cells[track] = [];
    for(var step = 0; step < nSteps; step++){
        cells[track][step] = 0;
    }
  }
  
  // 添加一些默认音符以便测试
  if (forceCreateCubes) {
    cells[10][0] = 1;
    cells[15][4] = 1;
    cells[20][8] = 1;
    cells[5][12] = 1;
  }
  
  // Initialize Three.js
  initThree();
}

function initThree() {
  console.log("初始化Three.js...");
  
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0); // 稍微灰一点的背景，便于区分
  
  // Create camera with fixed position - 减少透视效果，拉近相机
  camera = new THREE.PerspectiveCamera(50, 600 / 300, 0.1, 1000); // 降低FOV从75到50，减少透视变形
  camera.position.z = 8;
  camera.position.y = 4;
  camera.position.x = 0;
  camera.lookAt(0, 1, 0); // 略微抬高视线
  console.log("相机位置:", camera.position);
  
  // Create renderer with clear settings
  renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true,
    powerPreference: "high-performance" 
  });
  renderer.setSize(600, 300);
  renderer.setClearColor(0xf0f0f0, 1);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.getElementById('three-container').appendChild(renderer.domElement);
  
  // 隐藏调试元素
  // axesHelper = new THREE.AxesHelper(10);
  // scene.add(axesHelper);
  
  // gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0x444444);
  // scene.add(gridHelper);
  
  // 自然光照效果
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(1, 2, 1);
  scene.add(directionalLight);
  
  // 创建基于音序器的立方体
  createCubes();
  
  // 开始动画循环
  animate();
}

// 创建基于音序器的立方体
function createCubes() {
  console.log("创建立方体...");
  
  // 清除所有立方体
  activeCubes.forEach(cube => {
    if (cube && scene.children.includes(cube)) {
      scene.remove(cube);
    }
  });
  
  cubes = [];
  activeCubes = [];
  originalMaterials = [];
  
  // 创建基于音序器的立方体
  let activeCellCount = 0;
  for(var track = 0; track < nTracks; track++) {
    for(var step = 0; step < nSteps; step++) {
      if(cells[track][step] == 1) {
        activeCellCount++;
        
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
          roughness: 0.7,
          metalness: 0.1
        });
        
        // 创建网格并放置
        const cube = new THREE.Mesh(geometry, material);
        
        // 放置在一个网格中，确保可见
        const spacing = 2; // 间距
        const maxPerRow = 5; // 每行最多5个
        const row = Math.floor(activeCellCount / maxPerRow);
        const col = activeCellCount % maxPerRow;
        
        const xPos = (col - 2) * spacing;
        const zPos = -row * spacing; // 视野内分布
        const yPos = height / 2; // 立方体底部在地面上
        
        cube.position.set(xPos, yPos, zPos);
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
        
        console.log(`创建音符立方体 [${track},${step}]，位置:(${xPos}, ${yPos}, ${zPos})`);
      }
    }
  }
  
  console.log(`创建了 ${activeCellCount} 个音符立方体`);
}

function animate() {
  requestAnimationFrame(animate);
  
  // Render scene
  renderer.render(scene, camera);
}

function onBeat(time){
  // If the current beat is on, play it
  for(var track = 0; track < nTracks; track++){
    if(cells[track][currentStep] == 1){
      // The bottom track should have the lowest note
      var notePos = (nTracks - 1) - track; 
      var octave = baseOctave + floor(notePos / 7);
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

function animateCube(track, step) {
  const cube = cubes[track][step];
  if (cube) {
    // Find the original material for this cube
    const materialData = originalMaterials.find(m => m.cube === cube);
    if (materialData) {
      // 激活发光效果，乘以1.5让亮度更高
      const glowColor = materialData.color.clone().multiplyScalar(1.5);
      cube.material.emissive = glowColor;
      
      // 轻微的动画
      const originalY = cube.position.y;
      const jumpHeight = 0.8; // 减小跳跃高度
      
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
      
      // 逐渐淡出发光效果
      setTimeout(() => {
        if (cube) {
          // Create fade animation
          const fadeOut = () => {
            // Reduce emissive intensity
            const currentEmissive = cube.material.emissive;
            currentEmissive.r *= 0.9;
            currentEmissive.g *= 0.9;
            currentEmissive.b *= 0.9;
            
            if (currentEmissive.r > 0.01 || currentEmissive.g > 0.01 || currentEmissive.b > 0.01) {
              requestAnimationFrame(fadeOut);
            } else {
              cube.material.emissive.set(0x000000);
            }
          };
          fadeOut();
        }
      }, 100);
    }
  }
}

function draw(){
  background(255);
  
  // Draw cells that are on
  for(var step = 0; step < nSteps; step++){
    for(var track = 0; track < nTracks; track++){
      if(cells[track][step] == 1){
        var notePos = nTracks - 1 - track; 
        var col = colors[notePos % 7];
        fill(col);
        rect(l+ step*cellWidth, t + track*cellHeight, cellWidth, cellHeight);
      }
    }
  }
  
  stroke(blue);
  // Draw horizontal lines
  for(var i = 0; i <= nTracks; i++){
    var y = t + i*cellHeight;
    right = width - l;
    
    // If we are at the end of the octave, draw a thicker line. 
    if(i % 7 == 0 && 0 < i && i < nTracks){
      strokeWeight(2);
    }
    else{
      strokeWeight(0.5);
    }
    
    line(l, y, right, y);
  }
  
  // Draw vertical lines
  for(var i = 0; i <= nSteps; i++){
    
    // If a step is on an odd bar, draw a shading rect
    var bar = floor(i / beatsPerBar);
    if( bar % 2 == 1 & i < nSteps){
      //shade
      noStroke();
      fill(0, 10);
      rect(l + i*cellWidth, t, cellWidth, gridHeight);
    }
    
    stroke(blue);
    // If a step is a beat, draw a thicker line. If it is a subdivision, draw a thinner line
    if(i % splitBeatsInto == 0){
      strokeWeight(1);
    }
    else{
      strokeWeight(0.5);
    }
    var x = i*cellWidth;
    line(l + x, t, l + x, t + gridHeight);
  }
  
  // Highlight current step
  if(beats > 0){
  	var highlight = (beats - 1) % nSteps;
    fill(178, 223, 247, 50);
    noStroke();
    rect(l + highlight * cellWidth, t, cellWidth, gridHeight)
  }
}

function mousePressed(){
  // If the mouse is within the bounds of the canvas
  if( l < mouseX && mouseX < l + gridWidth &&
      t < mouseY && mouseY < t + gridHeight){
    // Account for margins
    var x = mouseX - l;
    var y = mouseY - t;
    
    // Determine which cell the mouse is on
    var i = floor(y / cellHeight);
    var j = floor(x / cellWidth);
    
    // Toggle cell on/off
    cells[i][j] = !cells[i][j];
    
    // Update the 3D visualization
    createCubes();
  }
}

function togglePlay() {
  Tone.Transport.toggle();
}

function updateTempo(){
  if(tempoSlider){
    Tone.Transport.bpm.rampTo(tempoSlider.value(), 0.1);
  }
}