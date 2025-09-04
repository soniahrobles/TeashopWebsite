let img;
let bg;
let font;
let sound;
let amplitude;

function preload () {
  img = loadImage('spoon.png');
  bg = loadImage('teashop.jpeg');
  font = loadFont ('Charity.otf');
  sound = loadSound ('chill.mp3');
}
function setup() {
const c = createCanvas(windowWidth, windowHeight); 

c.parent('sketch');

sound.play();
amplitude = new p5.Amplitude();
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
  clear();
  image(bg, 0, 0, width, height);
  
 let level = amplitude.getLevel(); 
 let circleSize = map(level, 0, 0.3, 50, 300);
 fill(255, 255, 255, 100);
 noStroke();
 circle(width / 2, height / 2, circleSize);
  
  
  textFont(font);
  fill(255)
  textSize(50)
  text('Welcome...',10,10, width, height);
  
  image(img, mouseX, mouseY, 90, 90);
}
function mousePressed () {
  if (!sound.isPlaying()) {
    sound.play();
  } else {
    sound.stop();
  }
}
