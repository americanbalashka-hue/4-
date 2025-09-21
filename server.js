import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { exec } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3000;

// Папка public доступна
app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'form.html'));
});

const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.fields([{ name: 'photo' }, { name: 'video' }]), async (req, res) => {
  try {
    const clientId = Date.now().toString();
    const folder = path.join('public', clientId);
    fs.mkdirSync(folder, { recursive: true });

    const uploadedPhoto = req.files['photo'][0];
    const uploadedVideo = req.files['video'][0];

    const photoFile = path.join(folder, `photo${path.extname(uploadedPhoto.originalname)}`);
    const videoFile = path.join(folder, `video${path.extname(uploadedVideo.originalname)}`);
    const qrFile = path.join(folder, 'qrcode.png');
    const photoWithQR = path.join(folder, `photo_with_qr${path.extname(uploadedPhoto.originalname)}`);
    const mindFile = path.join(folder, 'target.mind');
    const htmlFile = path.join(folder, 'index.html');

    // Перемещаем файлы
    fs.renameSync(uploadedPhoto.path, photoFile);

    // Сжимаем видео до 25 МБ, если нужно
    await new Promise((resolve, reject) => {
      ffmpeg(videoFile)
        .outputOptions('-fs', '25M') // ограничение размера файла
        .save(`${folder}/video_compressed${path.extname(uploadedVideo.originalname)}`)
        .on('end', () => {
          fs.renameSync(`${folder}/video_compressed${path.extname(uploadedVideo.originalname)}`, videoFile);
          resolve();
        })
        .on('error', reject);
    });

    // Генерация .mind из фото
    await new Promise((resolve, reject) => {
      const mindarPath = path.join(process.cwd(), 'node_modules', '.bin', 'mindar');
      exec(`${mindarPath} build "${photoFile}" -o "${mindFile}"`, (error, stdout, stderr) => {
        if (error) return reject(error);
        if (stderr) console.error(stderr);
        console.log(stdout);
        resolve();
      });
    });

    // Генерация QR-кода
    const baseURL = process.env.BASE_URL || 'https://your-render-domain.onrender.com';
    const qrURL = `${baseURL}/${clientId}/index.html`;
    await QRCode.toFile(qrFile, qrURL, { width: 200 });

    // Наложение QR на фото
    const photoSharp = sharp(photoFile);
    const qrBuffer = await sharp(qrFile).resize(200).toBuffer();
    const { height } = await photoSharp.metadata();
    await photoSharp.composite([{ input: qrBuffer, top: height - 220, left: 20 }]).toFile(photoWithQR);

    // Генерация HTML
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AR Client</title>
  <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mind-ar@1.1.4/dist/mindar-image-aframe.prod.js"></script>
</head>
<body>
<a-scene mindar-image="imageTargetSrc: ./${path.basename(mindFile)};" embedded color-space="sRGB" vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: true">
  <a-assets>
    <video id="video1" src="./${path.basename(videoFile)}" preload="auto" crossorigin="anonymous"></video>
  </a-assets>
  <a-image mindar-image-target="targetIndex: 0" src="./${path.basename(photoFile)}"></a-image>
  <a-video src="#video1" width="1.2" height="0.8" position="0 0.4 0" rotation="-90 0 0" mindar-image-target="targetIndex: 0" autoplay="true" loop="true"></a-video>
  <a-camera position="0 0 0"></a-camera>
</a-scene>
</body>
</html>
    `;
    fs.writeFileSync(htmlFile, htmlTemplate);

    res.send(`
      <h2>Готово!</h2>
      <p>AR-сайт: <a href="/${clientId}/index.html">${clientId}/index.html</a></p>
      <p>Фото с QR: <a href="/${clientId}/${path.basename(photoWithQR)}">Скачать</a></p>
    `);

  } catch (err) {
    console.error(err);
    res.status(500).send('Ошибка сервера: ' + err.message);
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));