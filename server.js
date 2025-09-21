import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import sharp from 'sharp';

const app = express();
const PORT = process.env.PORT || 3000;

// Папка public для отдачи файлов
app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'form.html'));
});

// Настройка multer для загрузки файлов (теперь фото, видео и mind)
const upload = multer({ dest: 'uploads/' });

app.post(
  '/upload',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'video', maxCount: 1 },
    { name: 'mind', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const clientId = Date.now().toString();
      const folder = path.join('public', clientId);
      fs.mkdirSync(folder, { recursive: true });

      // Загруженные файлы
      const uploadedPhoto = req.files['photo'][0];
      const uploadedVideo = req.files['video'][0];
      const uploadedMind = req.files['mind'][0];

      const photoFile = path.join(folder, `photo${path.extname(uploadedPhoto.originalname)}`);
      const videoFile = path.join(folder, `video${path.extname(uploadedVideo.originalname)}`);
      const mindFile = path.join(folder, uploadedMind.originalname);
      const qrFile = path.join(folder, 'qrcode.png');
      const photoWithQR = path.join(folder, `photo_with_qr${path.extname(uploadedPhoto.originalname)}`);
      const htmlFile = path.join(folder, 'index.html');

      // Перемещаем файлы в публичную папку
      fs.renameSync(uploadedPhoto.path, photoFile);
      fs.renameSync(uploadedVideo.path, videoFile);
      fs.renameSync(uploadedMind.path, mindFile);

      // Генерация QR-кода для AR-сайта
      const baseURL = process.env.BASE_URL || 'https://your-render-domain.onrender.com';
      const qrURL = `${baseURL}/${clientId}/index.html`;
      await QRCode.toFile(qrFile, qrURL, { width: 200 });

      // Наложение QR на фото
      const photoSharp = sharp(photoFile);
      const qrBuffer = await sharp(qrFile).resize(200).toBuffer();
      const { height } = await photoSharp.metadata();
      await photoSharp.composite([{ input: qrBuffer, top: height - 220, left: 20 }])
        .toFile(photoWithQR);

      // Генерация HTML из шаблона
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
  }
);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));