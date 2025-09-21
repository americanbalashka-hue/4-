import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

// Папка для статических файлов
app.use('/public', express.static(path.join(__dirname, 'public')));

// Настройка multer для загрузки
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const clientDir = path.join(__dirname, 'public', 'uploads', req.body.clientId);
    cb(null, clientDir);
  },
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// Загрузка файлов
app.post('/upload', upload.fields([{ name: 'photo' }, { name: 'video' }]), (req, res) => {
  // Здесь можно добавить генерацию .mind через браузерный компилятор
  res.send('Файлы загружены успешно');
});

// Генерация страницы для клиента
app.get('/client/:id', (req, res) => {
  const clientId = req.params.id;
  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>AR Фото-видео</title>
      <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.4/dist/mindar-image-aframe.prod.js"></script>
      <style>
        body { margin:0; background:black; height:100vh; width:100vw; overflow:hidden; }
        #container { position:fixed; top:0; left:0; width:100vw; height:100vh; display:flex; justify-content:center; align-items:center; }
        #startButton { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); padding:20px 40px; font-size:18px; background:#1e90ff; color:white; border:none; border-radius:8px; cursor:pointer; z-index:10; }
        a-scene { width:100%; height:100%; object-fit:cover; }
      </style>
    </head>
    <body>
      <div id="container">
        <button id="startButton">Включить камеру</button>
        <a-scene
          mindar-image="imageTargetSrc: ./public/uploads/${clientId}/photo.mind;"
          embedded
          color-space="sRGB"
          renderer="colorManagement: true, physicallyCorrectLights"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false">
          <a-assets>
            <video id="video1" src="./public/uploads/${clientId}/video.mp4" preload="auto" playsinline webkit-playsinline></video>
          </a-assets>
          <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
          <a-entity mindar-image-target="targetIndex: 0">
            <a-video id="videoPlane" src="#video1"></a-video>
          </a-entity>
        </a-scene>
      </div>

      <script>
        const button = document.getElementById('startButton');
        const videoEl = document.getElementById('video1');
        const videoPlane = document.getElementById('videoPlane');
        const targetEntity = document.querySelector('[mindar-image-target]');
        let isPlaying = false;

        button.addEventListener('click', async () => {
          videoEl.muted = true;
          await videoEl.play().catch(e => console.log(e));
          videoEl.pause();
          videoEl.currentTime = 0;
          button.style.display = 'none';
        });

        videoEl.addEventListener('loadedmetadata', () => {
          const aspect = videoEl.videoWidth / videoEl.videoHeight;
          const baseWidth = 1;
          const baseHeight = baseWidth / aspect;
          videoPlane.setAttribute('width', baseWidth);
          videoPlane.setAttribute('height', baseHeight);
        });

        targetEntity.addEventListener('targetFound', () => {
          if (!isPlaying) {
            videoEl.muted = false;
            videoEl.currentTime = 0;
            videoEl.play();
            isPlaying = true;
          }
        });

        targetEntity.addEventListener('targetLost', () => {
          videoEl.pause();
          videoEl.currentTime = 0;
          isPlaying = false;
        });
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));