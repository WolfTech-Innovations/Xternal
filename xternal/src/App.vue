<template>
  <div id="app">
    <canvas ref="sceneCanvas"></canvas>

    <!-- Branding -->
    <div class="branding">
      <h1>WolfTech Innovations</h1>
      <h2>Xternal</h2>
    </div>

    <!-- Eye Tracking Status -->
    <div class="status">
      <p>Eye Tracking: <span :class="{ active: eyeTrackingActive }">{{ eyeTrackingActive ? "Active" : "Waiting..." }}</span></p>
    </div>
  </div>
</template>

<script>
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import WebGazer from 'webgazer';

export default {
  data() {
    return {
      eyeTrackingActive: false,
      model: null,
      video: null,
      avatar: null,
    };
  },
  async mounted() {
    await this.initEyeTracking();
    this.initScene();
  },
  methods: {
    async initEyeTracking() {
      try {
        WebGazer.setRegression('ridge')
          .setTracker('clmtrackr')
          .setGazeListener((data, elapsedTime) => {
            if (data) {
              const normalizedX = (data.x - window.innerWidth / 2) / (window.innerWidth / 2);
              const normalizedY = (data.y - window.innerHeight / 2) / (window.innerHeight / 2);
              this.updateAvatarHead(normalizedX, normalizedY);
            }
          })
          .begin();
        this.eyeTrackingActive = true;
      } catch (error) {
        console.error("Error initializing eye tracking:", error);
      }
    },
    updateAvatarHead(normalizedX, normalizedY) {
      if (!this.avatar) return;
      this.avatar.rotation.y = normalizedX * Math.PI; // Rotate left/right
      this.avatar.rotation.x = normalizedY * Math.PI / 2; // Rotate up/down
    },
    initScene() {
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: this.$refs.sceneCanvas });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      document.body.appendChild(this.renderer.domElement);

      this.setupLighting();
      this.loadAvatar();
      this.animate();
    },
    setupLighting() {
      const light = new THREE.DirectionalLight(0xffffff, 1);
      light.position.set(5, 10, 7.5);
      this.scene.add(light);
    },
    loadAvatar() {
      const loader = new GLTFLoader();
      loader.load(
        'https://models.readyplayer.me/64df6400de95cba2305aaf7d.glb',
        (gltf) => {
          this.avatar = gltf.scene;
          this.avatar.scale.set(2, 2, 2);
          this.scene.add(this.avatar);
        },
        undefined,
        (error) => {
          console.error("Error loading avatar:", error);
        }
      );
    },
    animate() {
      this.renderer.setAnimationLoop(() => {
        this.renderer.render(this.scene, this.camera);
      });
    }
  }
};
</script>

<style>
#app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #20002c, #cbb4d4, #ff0080, #ff8c00);
  background-size: 400% 400%;
  animation: gradientBG 10s ease infinite;
  position: relative;
}

@keyframes gradientBG {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.branding {
  position: absolute;
  top: 20px;
  left: 20px;
  text-align: left;
  color: white;
  font-family: 'Arial', sans-serif;
  text-shadow: 2px 2px 10px rgba(255, 0, 128, 0.7);
}

.branding h1 {
  font-size: 32px;
  margin: 0;
  text-transform: uppercase;
}

.branding h2 {
  font-size: 24px;
  margin-top: 5px;
  opacity: 0.8;
}

.status {
  position: absolute;
  top: 20px;
  right: 20px;
  color: white;
  font-family: 'Arial', sans-serif;
  text-shadow: 2px 2px 10px rgba(255, 0, 128, 0.7);
  font-size: 18px;
}

.status .active {
  color: #0f0;
}
</style>
