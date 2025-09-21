import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import sharp from 'sharp';

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

const baseURL = process.env.BASE_URL || 'https://four-5cvw.onrender.com';

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'form.html'));
});

app.post('/upload', upload.fields([{ name: 'photo' }, { name: 'video' }]), async (req, res) => {
  try {
    if (!req.files['photo'] || !req.files['video']) {
      return res.status(400).send('Нужно загрузить фото и видео');
    }

    const clientId = Date.now().toString();
    const folder = `public/${clientId}`;
    fs.mkdirSync(folder, { recursive: true });

    const photoExt = path.extname(req.files['photo'][0].originalname);
    const videoExt = path.extname(req.files['video'][0].originalname);

    const photoFile = `${folder}/photo${photoExt}`;
    const videoFile = `${folder}/video${videoExt}`;
    const qrFile = `${folder}/qrcode.png`;
    const photoWithQR = `${folder}/photo_with_qr${photoExt}`;
    const htmlFile = `${folder}/index.html`;

    // Перемещаем файлы
    fs.renameSync(req.files['photo'][0].path, photoFile);
    fs.renameSync(req.files['video'][0].path, videoFile);

    // Генерируем QR
    const qrURL = `${baseURL}/${clientId}/index.html`;
    await QRCode.toFile(qrFile, qrURL, { width: 200 });

    // Накладываем QR на фото
    const photoSharp = sharp(photoFile);
    const qrBuffer = await sharp(qrFile).resize(200).toBuffer();
    const { height } = await photoSharp.metadata();
    await photoSharp.composite([{ input: qrBuffer, top: height - 220, left: 20 }]).toFile(photoWithQR);

    // Генерируем HTML с браузерным MindAR
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>AR Фото-видео</title>
  <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.4/dist/mindar-image-aframe.prod.js"></script>
  <style>
    body { margin: 0; background: black; height: 100vh; width: 100vw; overflow: hidden; }
    #container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: black; display: flex; justify-content: center; align-items: center; }
    #startButton { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 20px 40px; font-size: 18px; background: #1e90ff; color: white; border: none; border-radius: 8px; z-index: 10; cursor: pointer; }
    a-scene { width: 100%; height: 100%; object-fit: cover; }
  </style>
</head>
<body>
<div id="container">
  <button id="startButton">Нажмите, чтобы включить камеру</button>

  <a-scene
    mindar-image="imageTargetSrc: ./photo${photoExt}; generateFromImage: true;"
    embedded
    color-space="sRGB"
    renderer="colorManagement: true, physicallyCorrectLights"
    vr-mode-ui="enabled: false"
    device-orientation-permission-ui="enabled: false">

    <a-assets>
      <video id="video1" src="./video${videoExt}" preload="auto" playsinline webkit-playsinline></video>
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
    try {
      videoEl.muted = true;
      await videoEl.play();
      videoEl.pause();
      videoEl.currentTime = 0;
      button.style.display = 'none';
    } catch (err) {
      alert('Не удалось включить камеру. Проверь разрешения.');
      console.error(err);
    }
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
`;

    fs.writeFileSync(htmlFile, htmlTemplate);

    res.send(`
      Готово! <br>
      AR-сайт: <a href="${clientId}/index.html">${clientId}/index.html</a> <br>
      Фото с QR: <a href="${clientId}/${path.basename(photoWithQR)}">Скачать</a>
    `);

  } catch (err) {
    console.error(err);
    res.status(500).send('Ошибка сервера');
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Server started'));