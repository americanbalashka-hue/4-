import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import QRCode from 'qrcode';
import sharp from 'sharp';

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

// Базовый URL сервера (Environment Variable на Render)
const baseURL = process.env.BASE_URL || 'https://four-5cvw.onrender.com';

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'form.html'));
});

app.post('/upload', upload.fields([{ name: 'photo' }, { name: 'video' }]), async (req, res) => {
  try {
    const clientId = Date.now().toString();
    const folder = `public/${clientId}`;
    fs.mkdirSync(folder, { recursive: true });

    const photoExt = path.extname(req.files['photo'][0].originalname);
    const videoExt = path.extname(req.files['video'][0].originalname);

    const photoFile = `${folder}/photo${photoExt}`;
    const videoFile = `${folder}/video${videoExt}`;
    const compressedVideo = `${folder}/video_compressed${videoExt}`;
    const mindFile = `${folder}/photo.mind`;
    const qrFile = `${folder}/qrcode.png`;
    const photoWithQR = `${folder}/photo_with_qr${photoExt}`;
    const htmlFile = `${folder}/index.html`;

    fs.renameSync(req.files['photo'][0].path, photoFile);
    fs.renameSync(req.files['video'][0].path, videoFile);

    // 1. Сжимаем видео <25MB
    await new Promise((resolve, reject) => {
      exec(`ffmpeg -i "${videoFile}" -vf "scale=640:-2" -b:v 2M -maxrate 2M -bufsize 2M "${compressedVideo}"`, (err, stdout, stderr) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // 2. Генерируем .mind с локальным mind-ar
    await new Promise((resolve, reject) => {
      exec(`npx mindar-image-compiler -i "${photoFile}" -o "${mindFile}"`, (err, stdout, stderr) => {
        if (err) {
          console.error('MindAR compile error:', stderr);
          return reject(err);
        }
        resolve();
      });
    });

    // 3. Генерируем QR и накладываем на фото
    const qrURL = `${baseURL}/${clientId}/index.html`;
    await QRCode.toFile(qrFile, qrURL, { width: 200 });

    const photoSharp = sharp(photoFile);
    const qrBuffer = await sharp(qrFile).resize(200).toBuffer();
    const { height } = await photoSharp.metadata();
    await photoSharp.composite([{ input: qrBuffer, top: height - 220, left: 20 }]).toFile(photoWithQR);

    // 4. Создаём index.html из шаблона
    const htmlTemplate = fs.readFileSync('template/index.html', 'utf-8')
      .replace(/{{VIDEO}}/g, path.basename(compressedVideo))
      .replace(/{{MIND}}/g, path.basename(mindFile));
    fs.writeFileSync(htmlFile, htmlTemplate);

    // 5. Возвращаем ссылки фотографу
    res.send(`
      Готово! <br>
      Ссылка на AR-сайт: <a href="${clientId}/index.html">${clientId}/index.html</a> <br>
      Фото с QR: <a href="${clientId}/${path.basename(photoWithQR)}">Скачать</a>
    `);

  } catch (err) {
    console.error(err);
    res.status(500).send('Ошибка сервера');
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Server started'));