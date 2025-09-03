let img;
let font;
let sound;
let amplitude;

function preload () {
  img = loadImage('spoon.png');
  bg = loadImage('teas.jpg');
  font = loadFont ('Charity.otf');
  sound = loadSound ('chill.mp3');
}
function setup() {
    const c = createCanvas(windowWidth, windowHeight);
  c.parent('sketch');  // attach canvas inside the <div id="sketch">
sound.play();
amplitude = 2
  function setup() {
  const textSizeSlider = document.getElementById('text-size');
  const textSizeDisplay = document.getElementById('textSizeVal');
  textSizeSlider.addEventListener('input', () => {
  textSizeVal = parseInt(textSizeSlider.value);
  textSizeDisplay.textContent = textSizeVal;
  });
}
}

function draw() {
  background(220);
  image(bg, 0, 0,400,400);
  
  let level = amplitude;
  let circleSize = map (level, 0, 0.3, 10, 20);
  fill(255, 255, 255, 50);
  noStroke();
  circle(width / 2, height / 2, circleSize);
  
  
  textFont(font);
  fill(255)
  textSize(50)
  text('Teashop',150,220);
  
  image(img, mouseX, mouseY, 90, 90);
}
function mousePressed () {
  if (!sound.isPlaying()) {
    sound.play();
  } else {
    sound.stop();
  }
}