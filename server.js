import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: path.join(__dirname, 'uploads') });

// Статика
app.use(express.static(path.join(__dirname, 'public')));

// Базовый URL сервера (через Environment Variable Render)
const baseURL = process.env.BASE_URL || 'https://my-render-app.onrender.com';

// Главная страница — форма загрузки
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'form.html'));
});

// Обработка загрузки
app.post('/upload', upload.fields([{ name: 'photo' }, { name: 'video' }]), async (req, res) => {
  try {
    const clientId = Date.now().toString();
    const folder = path.join(__dirname, 'public', clientId);
    fs.mkdirSync(folder, { recursive: true });

    const photoExt = path.extname(req.files['photo'][0].originalname);
    const videoExt = path.extname(req.files['video'][0].originalname);

    const photoFile = path.join(folder, `photo${photoExt}`);
    const videoFile = path.join(folder, `video${videoExt}`);
    const compressedVideo = path.join(folder, `video_compressed${videoExt}`);
    const mindFile = path.join(folder, 'photo.mind');
    const qrFile = path.join(folder, 'qrcode.png');
    const photoWithQR = path.join(folder, `photo_with_qr${photoExt}`);
    const htmlFile = path.join(folder, 'index.html');

    // Перемещаем файлы
    fs.renameSync(req.files['photo'][0].path, photoFile);
    fs.renameSync(req.files['video'][0].path, videoFile);

    // Сжимаем видео
    await new Promise(resolve => {
      exec(`ffmpeg -i "${videoFile}" -vf "scale=640:-2" -b:v 2M -maxrate 2M -bufsize 2M "${compressedVideo}"`, resolve);
    });

    // Генерация .mind
    await new Promise(resolve => {
      exec(`npx @zappar/mindar-image-compiler -i "${photoFile}" -o "${mindFile}"`, resolve);
    });

    // Генерация QR и наложение на фото
    const qrURL = `${baseURL}/${clientId}/index.html`;
    await QRCode.toFile(qrFile, qrURL, { width: 200 });

    const photoSharp = sharp(photoFile);
    const qrBuffer = await sharp(qrFile).resize(200).toBuffer();
    const { height } = await photoSharp.metadata();
    await photoSharp.composite([{ input: qrBuffer, top: height - 220, left: 20 }]).toFile(photoWithQR);

    // Создаём index.html
    const htmlTemplate = fs.readFileSync(path.join(__dirname, 'template', 'index.html'), 'utf-8')
      .replace(/{{VIDEO}}/g, path.basename(compressedVideo))
      .replace(/{{MIND}}/g, path.basename(mindFile));
    fs.writeFileSync(htmlFile, htmlTemplate);

    // Возвращаем ссылки
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

// Запуск сервера
app.listen(process.env.PORT || 3000, () => console.log('Server started'));