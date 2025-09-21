import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import sharp from 'sharp';

const app = express();
const PORT = process.env.PORT || 3000;

// Папка public для выдачи файлов
app.use(express.static(path.join(process.cwd(), 'public')));

// Форма загрузки
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'form.html'));
});

// Настройка multer
const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.fields([
  { name: 'photo' },
  { name: 'video' },
  { name: 'mind' }
]), async (req, res) => {
  try {
    const timestamp = Date.now().toString();
    const folder = path.join('public', timestamp);
    fs.mkdirSync(folder, { recursive: true });

    // Загрузка файлов
    const uploadedPhoto = req.files['photo'][0];
    const uploadedVideo = req.files['video'][0];
    const uploadedMind = req.files['mind'][0];

    // Генерируем уникальные имена файлов
    const photoFile = path.join(folder, `photo_${timestamp}${path.extname(uploadedPhoto.originalname)}`);
    const videoFile = path.join(folder, `video_${timestamp}${path.extname(uploadedVideo.originalname)}`);
    const mindFile = path.join(folder, `target_${timestamp}.mind`);
    const qrFile = path.join(folder, `qrcode_${timestamp}.png`);
    const photoWithQR = path.join(folder, `photo_with_qr_${timestamp}${path.extname(uploadedPhoto.originalname)}`);
    const htmlFile = path.join(folder, `index.html`);

    // Перемещаем файлы
    fs.renameSync(uploadedPhoto.path, photoFile);
    fs.renameSync(uploadedVideo.path, videoFile);
    fs.renameSync(uploadedMind.path, mindFile);

    // Генерация QR-кода
    const baseURL = process.env.BASE_URL || 'https://your-domain.onrender.com';
    const qrURL = `${baseURL}/${timestamp}/index.html`;
    await QRCode.toFile(qrFile, qrURL, { width: 200 });

    // Наложение QR на фото
    const photoSharp = sharp(photoFile);
    const qrBuffer = await sharp(qrFile).resize(200).toBuffer();
    const { height } = await photoSharp.metadata();
    await photoSharp.composite([{ input: qrBuffer, top: height - 220, left: 20 }])
      .toFile(photoWithQR);

    // Генерация HTML с кнопкой для мобильных
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>AR Фото-видео</title>
  <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.4/dist/mindar-image-aframe.prod.js"></script>
  <style>
    body{margin:0;overflow:hidden;background:black;}
    #startButton{
      position:absolute;top:50%;left:50%;
      transform:translate(-50%, -50%);
      padding:20px 40px;font-size:18px;
      background:#1e90ff;color:white;border:none;border-radius:8px;
      cursor:pointer;z-index:10;
    }
    a-scene{width:100%;height:100%;}
  </style>
</head>
<body>
<button id="startButton">Начать AR</button>
<a-scene mindar-image="imageTargetSrc: ./${path.basename(mindFile)};" embedded vr-mode-ui="enabled:false">
  <a-assets>
    <video id="video1" src="./${path.basename(videoFile)}" preload="auto" playsinline webkit-playsinline></video>
  </a-assets>
  <a-camera position="0 0 0" look-controls="enabled:false"></a-camera>
  <a-entity mindar-image-target="targetIndex:0">
    <a-video id="videoPlane" src="#video1"></a-video>
  </a-entity>
</a-scene>

<script>
const button = document.getElementById('startButton');
const videoEl = document.getElementById('video1');
const videoPlane = document.getElementById('videoPlane');
const targetEntity = document.querySelector('[mindar-image-target]');
let isPlaying = false;

button.addEventListener('click', async () => {
  try{
    videoEl.muted = true;
    await videoEl.play();
    videoEl.pause();
    videoEl.currentTime = 0;
    button.style.display = 'none';
  }catch(err){
    console.error(err);
    alert('Не удалось включить камеру. Проверьте разрешения.');
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
  if(!isPlaying){
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
      <h2>Готово!</h2>
      <p>Ссылка на AR-сайт: <a href="/${timestamp}/index.html">${timestamp}/index.html</a></p>
      <p>Фото с QR-кодом: <a href="/${timestamp}/${path.basename(photoWithQR)}">Скачать</a></p>
    `);

  } catch (err) {
    console.error(err);
    res.status(500).send('Ошибка сервера: ' + err.message);
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));