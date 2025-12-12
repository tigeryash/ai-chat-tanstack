#pragma glslify: noise = require('glsl-noise/simplex/3d')

uniform float uTime;
uniform vec3 uColors[5]; // Array of 5 colors

varying vec2 vUv;
varying vec3 vColor;

void main() {
  vec2 noiseCoord = uv * vec2(5.0, 6.0);
  vec3 noiseInput = vec3(noiseCoord.x +uTime * 0.02, noiseCoord.y , uTime * 0.05);
  float n = noise(noiseInput);
  n = n * 0.5 + 0.5;
  
  vec3 newPosition = position;
  newPosition.z += n;

  vColor = uColors[4];
  
  for(int i = 0; i < 4; i++) {
    // Each layer has progressively different parameters
    float noiseFlow = 0.05 + float(i) * 0.05;      // Speed multiplier
    float noiseSpeed = 0.05 + float(i) * 0.03;     // Z-axis speed
    float noiseSeed = 1.0 + float(i) * 10.0;       // Offset in noise space
    float noiseCeiling = 0.6 + float(i) * 0.08;    // Upper threshold
    
    vec3 noiseCoord = vec3(
      position.x * 0.3 + uTime * noiseFlow,
      position.y * 0.6,
      uTime * noiseSpeed + noiseSeed
    );
    
    float n = noise(noiseCoord);
    n = n * 0.5 + 0.5; // Normalize to [0,1]
    n = smoothstep(0.1, noiseCeiling, n);
    
    vColor = mix(vColor, uColors[i], n);
  }

  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(newPosition, 1.0);
}