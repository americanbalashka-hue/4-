import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { exec } from 'child_process';

const app = express();
const PORT = process.env.PORT || 3000;

// Папка public для отдачи файлов
app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'form.html'));
});

// Настройка multer для загрузки файлов
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

    // Перемещаем загруженные файлы
    fs.renameSync(uploadedPhoto.path, photoFile);
    fs.renameSync(uploadedVideo.path, videoFile);

    // Генерация .mind из оригинального фото
    await new Promise((resolve, reject) => {
      const mindarPath = path.join(process.cwd(), 'node_modules', '.bin', 'mindar');
      exec(`${mindarPath} build "${photoFile}" -o "${mindFile}"`, (error, stdout, stderr) => {
        if (error) return reject(error);
        if (stderr) console.error(stderr);
        console.log(stdout);
        resolve();
      });
    });

    // Генерация QR-кода для AR-сайта
    const baseURL = process.env.BASE_URL || `https://four-5cvw.onrender.com`;
    const qrURL = `${baseURL}/${clientId}/index.html`;
    await QRCode.toFile(qrFile, qrURL, { width: 200 });

    // Наложение QR на фото для пользователя
    const photoSharp = sharp(photoFile);
    const qrBuffer = await sharp(qrFile).resize(200).toBuffer();
    const { height } = await photoSharp.metadata();
    await photoSharp.composite([{ input: qrBuffer, top: height - 220, left: 20 }])
      .toFile(photoWithQR);

    // Генерация HTML с MindAR
    const htmlTemplate = fs.readFileSync('template/index.html', 'utf-8')
      .replace(/{{VIDEO}}/g, path.basename(videoFile))
      .replace(/{{PHOTO}}/g, path.basename(photoFile))
      .replace(/{{MIND}}/g, path.basename(mindFile));
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