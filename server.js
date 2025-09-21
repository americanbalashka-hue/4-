import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

app.use('/public', express.static(path.join(process.cwd(), 'public')));

// Главная форма загрузки
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'form.html'));
});

// Загрузка фото и видео
app.post('/upload', upload.fields([{ name: 'photo' }, { name: 'video' }]), async (req, res) => {
  try {
    const clientId = Date.now().toString();
    const folder = `public/${clientId}`;
    fs.mkdirSync(folder, { recursive: true });

    const photoExt = path.extname(req.files['photo'][0].originalname);
    const videoExt = path.extname(req.files['video'][0].originalname);

    const photoFile = `${folder}/photo${photoExt}`;
    const videoFile = `${folder}/video${videoExt}`;

    fs.renameSync(req.files['photo'][0].path, photoFile);
    fs.renameSync(req.files['video'][0].path, videoFile);

    // Генерация QR
    const qrURL = `${req.protocol}://${req.get('host')}/${clientId}/index.html`;
    const qrFile = `${folder}/qrcode.png`;
    await QRCode.toFile(qrFile, qrURL, { width: 200 });

    // Создаём HTML-шаблон, который будет генерировать .mind в браузере
    const htmlContent = `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>AR Фото-видео</title>
<script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.4/dist/mindar-image-aframe.prod.js"></script>
<style>
body { margin:0; background:black; height:100vh; width:100vw; overflow:hidden; }
#container { position:fixed; top:0; left:0; width:100vw; height:100vh; display:flex; justify-content:center; align-items:center; flex-direction:column; }
#startButton { padding:15px 30px; font-size:16px; background:#1e90ff; color:white; border:none; border-radius:8px; cursor:pointer; }
#loader { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); display:none; color:white; font-size:18px; }
#scanner { position:absolute; top:50%; left:50%; width:200px; height:200px; margin:-100px 0 0 -100px; border:3px solid #1e90ff; border-radius:8px; box-sizing:border-box; animation:scan 2s linear infinite; pointer-events:none; display:none; }
@keyframes scan { 0% { transform:translate(-50%,-50%) rotate(0deg); } 100% { transform:translate(-50%,-50%) rotate(360deg); } }
a-scene { width:100%; height:100%; object-fit:cover; }
</style>
</head>
<body>
<div id="container">
  <button id="startButton">Генерировать AR</button>
  <div id="loader">Генерация AR…</div>
  <div id="scanner"></div>
</div>

<script>
const startButton = document.getElementById('startButton');
const loader = document.getElementById('loader');
const scanner = document.getElementById('scanner');

startButton.addEventListener('click', async () => {
  loader.style.display = 'block';
  startButton.disabled = true;

  const photoFile = "${path.basename(photoFile)}";
  const videoFile = "${path.basename(videoFile)}";

  const mindar = new window.MINDAR.ImageTarget();
  await mindar.addImageFile(photoFile);

  const videoURL = videoFile;

  loader.style.display = 'none';
  scanner.style.display = 'block';
  document.getElementById('container').innerHTML = \`
    <a-scene mindar-image="imageTargetSrc: \${mindar.targetSrc}; embedded" 
             color-space="sRGB" renderer="colorManagement: true, physicallyCorrectLights"
             vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false">
      <a-assets>
        <video id="video1" src="\${videoURL}" preload="auto" playsinline webkit-playsinline></video>
      </a-assets>
      <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
      <a-entity mindar-image-target="targetIndex: 0">
        <a-video id="videoPlane" src="#video1"></a-video>
      </a-entity>
    </a-scene>
  \`;

  const videoEl = document.getElementById('video1');
  const targetEntity = document.querySelector('[mindar-image-target]');
  let isPlaying = false;

  targetEntity.addEventListener('targetFound', () => {
    if (!isPlaying) {
      videoEl.currentTime = 0;
      videoEl.play();
      isPlaying = true;
      scanner.style.display = 'none';
    }
  });

  targetEntity.addEventListener('targetLost', () => {
    videoEl.pause();
    videoEl.currentTime = 0;
    isPlaying = false;
    scanner.style.display = 'block';
  });
});
</script>
</body>
</html>
`;

    fs.writeFileSync(`${folder}/index.html`, htmlContent);

    res.send(`
      AR-сайт готов! <br>
      <a href="/${clientId}/index.html" target="_blank">Открыть AR</a>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('Ошибка сервера');
  }
});

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));